'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronRight,
  Crown,
  Download,
  Info,
  LoaderCircle,
  Medal,
  Music2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Swords,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OpeningCover } from '@/components/opening-cover';
import { LanguageSwitch } from '@/components/language-switch';
import { LegalNotice } from '@/components/legal-notice';
import { composerBio, composerPeriod, composerRegion, composerYears, useLanguage, type Language } from '@/lib/i18n';
import {
  composers,
  DEFAULT_COMPOSER_IDS,
  type Composer,
  type Work,
} from '@/lib/composers';
import { AUDIO_CATALOG } from '@/lib/audio-catalog';
import {
  createTournament,
  eliminatedComposers,
  GROUP_PITCHES,
  makeRound,
  restoreTournament,
  roundLabel,
  shuffledKnockoutEntrants,
  type TournamentState,
} from '@/lib/tournament';

const STORAGE_KEY = 'composer-world-cup-tournament-v2';
const PORTRAIT_CACHE_KEY = 'composer-world-cup-portraits-v1';
const AUDIO_CACHE_KEY = 'composer-world-cup-audio-sources-v3';
const statisticsEndpoint = () =>
  window.location.hostname === 'vulpexy.github.io'
    ? 'https://composer-world-cup-48.minervaw59.chatgpt.site/api/results'
    : '/api/results';
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const byId = new Map(composers.map((composer) => [composer.id, composer]));
const groupTitle = (index: number, language: Language = 'zh') =>
  language === 'zh' ? `${GROUP_PITCHES[index]} 音级组` : `Pitch ${GROUP_PITCHES[index]}`;
const roundName = (count: number, language: Language) => language === 'zh'
  ? roundLabel(count)
  : count === 32 ? 'Round of 32' : count === 16 ? 'Round of 16' : count === 8 ? 'Quarterfinals' : count === 4 ? 'Semifinals' : count === 2 ? 'Final' : 'Champion';
const composerName = (composer: Composer | undefined, language: Language) => composer ? (language === 'zh' ? composer.nameZh : composer.nameOriginal) : '';

function readCache(key: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

function ComposerPortrait({ composer }: { composer: Composer }) {
  const { language, text } = useLanguage();
  const [source, setSource] = useState(composer.portrait || '');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (composer.portrait) {
      setSource(composer.portrait);
      setFailed(false);
      return;
    }
    const cache = readCache(PORTRAIT_CACHE_KEY);
    if (cache[composer.id]) {
      setSource(cache[composer.id]);
      setFailed(false);
      return;
    }
    setSource('');
    setFailed(false);
    fetch(
      `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=900&titles=${encodeURIComponent(composer.wikipediaSlug)}&format=json&origin=*`,
    )
      .then((response) => response.json())
      .then((payload) => {
        const data = payload as { query?: { pages?: Record<string, { thumbnail?: { source?: string } }> } };
        const pages = Object.values(data?.query?.pages || {}) as Array<{
          thumbnail?: { source?: string };
        }>;
        const portrait = pages[0]?.thumbnail?.source;
        if (!portrait) throw new Error('No portrait');
        if (!cancelled) setSource(portrait);
        localStorage.setItem(
          PORTRAIT_CACHE_KEY,
          JSON.stringify({ ...cache, [composer.id]: portrait }),
        );
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [composer]);
  if (!source || failed)
    return (
      <div className="portrait-fallback">
        <Music2 />
        <span>{language === 'zh' ? composer.nameZh.slice(0, 2) : composer.nameOriginal.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</span>
      </div>
    );
  return (<>
    <img
      src={source}
      alt={`${composerName(composer, language)} ${text('肖像','portrait')}`}
      className="portrait"
      onError={() => setFailed(true)}
    />
    <a className="portrait-source" href={`https://en.wikipedia.org/wiki/${encodeURIComponent(composer.wikipediaSlug)}`} target="_blank" rel="noreferrer" aria-label={text('查看肖像来源与许可','View portrait source and licensing')} title={text('肖像来源与许可','Portrait source and licensing')}><Info /></a>
  </>);
}

type TrackSource = {
  url: string;
  provider: 'Wikimedia Commons' | 'iTunes';
  detail: string;
  trackUrl?: string;
};
type AudioState = {
  active: string | null;
  loading: string | null;
  error: string | null;
  errorDetail?: string;
  progress: number;
  sources: Record<string, TrackSource>;
};
type ItunesTrack = {
  kind?: string;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  composerName?: string;
  primaryGenreName?: string;
  previewUrl?: string;
  trackViewUrl?: string;
};
type CommonsPage = {
  title?: string;
  canonicalurl?: string;
  imageinfo?: Array<{
    url?: string;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
};

const AUDIO_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'from',
  'major',
  'minor',
  'number',
  'symphony',
  'concerto',
  'suite',
  'opera',
  'mass',
  'quartet',
  'first',
  'second',
  'third',
  'movement',
  'overture',
]);
const normalizeAudio = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const foldGermanAudio = (value: string) =>
  normalizeAudio(value)
    .replace(/oe/g, 'o')
    .replace(/ae/g, 'a')
    .replace(/ue/g, 'u');
const audioWords = (value: string) =>
  normalizeAudio(value)
    .split(/\s+/)
    .filter(
      (word) =>
        word &&
        (word.length > 1 || /^\d+$/.test(word)) &&
        !AUDIO_STOPWORDS.has(word),
    );

function searchItunes(term: string, country = 'US'): Promise<ItunesTrack[]> {
  return new Promise((resolve, reject) => {
    const callback = `composerCupItunes${Date.now()}${Math.random().toString(36).slice(2)}`;
    const target = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');
    const cleanup = () => {
      delete target[callback];
      script.remove();
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('iTunes search timed out'));
    }, 15000);
    target[callback] = (payload: { results?: ItunesTrack[] }) => {
      cleanup();
      resolve(payload.results || []);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('iTunes search failed'));
    };
    script.src = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&country=${country}&limit=35&callback=${callback}`;
    document.head.appendChild(script);
  });
}

const plainMetadata = (value = '') => {
  const node = document.createElement('div');
  node.innerHTML = value;
  return (node.textContent || '').replace(/\s+/g, ' ').trim();
};

async function searchOpenRecording(composer: Composer, work: Work): Promise<TrackSource | null> {
  try {
    const query = `${composer.nameOriginal} ${work.audioQuery} filetype:audio`;
    const endpoint = new URL('https://commons.wikimedia.org/w/api.php');
    endpoint.search = new URLSearchParams({
      action: 'query', generator: 'search', gsrsearch: query, gsrnamespace: '6', gsrlimit: '12',
      prop: 'info|imageinfo', inprop: 'url', iiprop: 'url|mime|extmetadata', format: 'json', origin: '*',
    }).toString();
    const response = await fetch(endpoint);
    if (!response.ok) return null;
    const payload = await response.json() as { query?: { pages?: Record<string, CommonsPage> } };
    const composerWords = audioWords(composer.nameOriginal).filter((word) => word.length > 3);
    const aliases = composerWords.length > 2 ? composerWords.slice(-2) : composerWords.slice(-1);
    const workWords = audioWords(work.audioQuery);
    const candidates = Object.values(payload.query?.pages || {}).map((page) => {
      const info = page.imageinfo?.[0];
      const meta = info?.extmetadata || {};
      const licence = plainMetadata(meta.LicenseShortName?.value || meta.UsageTerms?.value || '');
      const title = normalizeAudio(page.title || '');
      const aliasMatches = aliases.filter((word) => title.includes(word)).length;
      const workMatches = workWords.filter((word) => title.includes(word)).length;
      const openLicence = /public domain|cc0|cc by(?:-|\s)|creative commons attribution|eff open audio/i.test(licence);
      return { page, info, meta, licence, aliasMatches, workMatches, openLicence };
    }).filter((item) => item.info?.url && item.info.mime?.startsWith('audio/') && item.openLicence && item.aliasMatches > 0 && item.workMatches >= Math.max(1, Math.ceil(workWords.length * .45)))
      .sort((a, b) => (b.aliasMatches * 10 + b.workMatches) - (a.aliasMatches * 10 + a.workMatches));
    const best = candidates[0];
    if (!best?.info?.url) return null;
    const performer = plainMetadata(best.meta.Artist?.value || best.meta.Credit?.value || best.meta.Author?.value || 'Wikimedia contributor');
    return {
      url: best.info.url,
      provider: 'Wikimedia Commons',
      detail: [performer, best.licence].filter(Boolean).join(' · '),
      trackUrl: best.page.canonicalurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent((best.page.title || '').replace(/ /g, '_'))}`,
    };
  } catch {
    return null;
  }
}

async function resolveTrackSource(
  composer: Composer,
  work: Work,
): Promise<TrackSource> {
  const workIndex = composer.works.indexOf(work);
  const bundled = AUDIO_CATALOG[`${composer.id}:${workIndex}` as keyof typeof AUDIO_CATALOG];
  if (work.audioFilename)
    return {
      url: `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(work.audioFilename)}`,
      provider: 'Wikimedia Commons',
      detail: [work.audioCredit, work.audioLicense].filter(Boolean).join(' · '),
      trackUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(work.audioFilename).replace(/%20/g, '_')}`,
    };
  if (bundled?.provider === 'Wikimedia Commons') return bundled;
  const openRecording = await searchOpenRecording(composer, work);
  if (openRecording) return openRecording;
  if (bundled) return bundled;
  const query = `${composer.nameOriginal} ${work.audioQuery}`;
  const composerWords = audioWords(composer.nameOriginal).filter(
    (word) => word.length > 3,
  );
  const composerAliases =
    composerWords.length > 2
      ? composerWords.slice(-2)
      : composerWords.slice(-1);
  const required = audioWords(work.audioQuery);
  let match: ItunesTrack | undefined;
  let searched = false;
  for (const country of ['US', 'DE', 'GB']) {
    let results: ItunesTrack[] = [];
    try {
      results = await searchItunes(query, country);
    } catch {
      continue;
    }
    searched = true;
    const ranked = results
      .filter((track) => track.kind === 'song' && track.previewUrl)
      .map((track) => {
        const rawHaystack = normalizeAudio(
          [
            track.trackName,
            track.collectionName,
            track.composerName,
            track.artistName,
          ]
            .filter(Boolean)
            .join(' '),
        );
        const haystack = `${rawHaystack} ${foldGermanAudio(rawHaystack)}`;
        const matched = required.filter(
          (word) =>
            haystack.includes(word) || haystack.includes(foldGermanAudio(word)),
        );
        const aliasMatches = composerAliases.filter(
          (alias) =>
            haystack.includes(alias) ||
            haystack.includes(foldGermanAudio(alias)),
        ).length;
        const composerMatched = aliasMatches > 0;
        const classical =
          /classical|opera/i.test(track.primaryGenreName || '') ||
          composerMatched;
        const arrangementPenalty = (
          haystack.match(
            /guitar|ukulele|cover|remix|karaoke|tribute|arrangement|transcription/g,
          ) || []
        ).length;
        const originalBonus =
          /piano|violin|cello|orchestra|quartet|choir|opera/.test(haystack)
            ? 2
            : 0;
        return {
          track,
          matched,
          composerMatched,
          classical,
          score:
            aliasMatches * 10 +
            (classical ? 3 : 0) +
            matched.length * 4 +
            originalBonus -
            arrangementPenalty * 18,
        };
      })
      .filter(
        (item) =>
          item.composerMatched &&
          item.classical &&
          item.matched.length >= Math.max(1, Math.ceil(required.length * 0.45)),
      )
      .sort((left, right) => right.score - left.score);
    match = ranked[0]?.track;
    if (match) break;
  }
  if (!match?.previewUrl) throw new Error(searched ? 'NO_MATCH' : 'NETWORK');
  return {
    url: match.previewUrl.replace(/^http:/, 'https:'),
    provider: 'iTunes',
    detail: [match.trackName, match.artistName].filter(Boolean).join(' · '),
    trackUrl: match.trackViewUrl,
  };
}

function WorkList({
  composer,
  audio,
  onToggle,
  compact = false,
}: {
  composer: Composer;
  audio: AudioState;
  onToggle: (composer: Composer, work: Work, index: number) => void;
  compact?: boolean;
}) {
  const { language, text } = useLanguage();
  return (
    <section
      className={`works ${compact ? 'compact-works' : ''}`}
      aria-label={`${composerName(composer, language)} ${text('代表作','selected works')}`}
    >
      <div className="section-label">
        <Music2 />
        {text('代表作 · 30秒试听','Selected works · 30-second previews')}
      </div>
      <ul>
        {composer.works.map((work, index) => {
          const trackId = `${composer.id}:${index}`;
          const playing = audio.active === trackId;
          const loading = audio.loading === trackId;
          const failed = audio.error === trackId;
          const source = audio.sources[trackId];
          return (
            <li key={trackId} className={playing ? 'is-playing' : ''}>
              <span className="work-number">0{index + 1}</span>
              <div className="work-copy">
                <button
                  className="work-title-button"
                  onClick={() => onToggle(composer, work, index)}
                >
                  <strong>{language === 'zh' ? work.nameZh : work.nameEn}</strong>
                  {language === 'zh' && <small>{work.nameEn}</small>}
                </button>
                {failed && <div className="audio-error-row"><em>{audio.errorDetail || text('暂未匹配到可用试听，可稍后重试','No suitable preview was found. Please try again later.')}</em><details className="audio-help"><summary aria-label={text('了解试听失败原因','Why did this preview fail?')}><Info /></summary><div><b>{text('为什么会失败？','Why can this happen?')}</b><p>{text('第三方目录可能因地区授权、网络连接、浏览器播放限制、录音地址更新或曲目无法可靠匹配而不可用。你可以重试，或打开来源页面继续试听。','Third-party catalogues may be unavailable because of territorial rights, connectivity, browser playback rules, a changed media URL, or an uncertain track match. Retry or open the source page when available.')}</p></div></details></div>}
                {source && (
                  <a
                    className="audio-credit"
                    href={source.trackUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.provider === 'iTunes'
                      ? `${text('Apple Music 试听','Apple Music preview')} · Provided courtesy of iTunes · ${source.detail} · ${text('在 Apple Music 打开 ↗','Open in Apple Music ↗')}`
                      : `${source.provider} · ${source.detail} · ${text('查看来源与许可 ↗','View source & licence ↗')}`}
                  </a>
                )}
              </div>
              <button
                className="play-button"
                onClick={() => onToggle(composer, work, index)}
                disabled={loading}
                aria-label={`${playing ? text('暂停','Pause') : text('播放','Play')} ${language === 'zh' ? work.nameZh : work.nameEn}`}
              >
                {loading ? (
                  <LoaderCircle className="spin" />
                ) : playing ? (
                  <Pause />
                ) : (
                  <Play />
                )}
              </button>
              {playing && (
                <span
                  className="track-progress"
                  style={
                    {
                      '--track-progress': `${audio.progress * 100}%`,
                    } as React.CSSProperties
                  }
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ComposerCard({
  composer,
  selected,
  audio,
  onToggleAudio,
  onPrepareAudio,
  onSelect,
}: {
  composer: Composer;
  selected: boolean;
  audio: AudioState;
  onToggleAudio: (composer: Composer, work: Work, index: number) => void;
  onPrepareAudio: (composer: Composer) => void;
  onSelect: () => void;
}) {
  const { language, text } = useLanguage();
  const [showWorks, setShowWorks] = useState(false);
  const selectFromCard = (event: React.MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button,a')) return;
    onSelect();
  };
  const selectFromKeyboard = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };
  return (
    <article
      className={`composer-card ${selected ? 'is-selected' : ''} ${showWorks ? 'is-flipped' : ''}`}
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onClick={selectFromCard}
      onKeyDown={selectFromKeyboard}
    >
      <div className="mobile-card-content">
        <div className="mobile-card-front">
          <div className="mobile-portrait">
            <ComposerPortrait composer={composer} />
            {selected && (
              <span className="mobile-selected-mark">
                <Check />
              </span>
            )}
          </div>
          <div className="mobile-summary">
            <p className="mobile-period">{composerPeriod(composer, language)}</p>
            <h2 className={composerName(composer, language).length > 24 ? 'long-name' : ''}>
              {composerName(composer, language)}
            </h2>
            {language === 'zh' && <p className="original-name">{composer.nameOriginal}</p>}
            <p className="mobile-region">
              {composerYears(composer, language)} · {composerRegion(composer, language)}
            </p>
            <p className="mobile-bio">{composerBio(composer, language)}</p>
            <button
              className="flip-card-button"
              onClick={() => {
                setShowWorks(true);
                onPrepareAudio(composer);
              }}
            >
              <Music2 />
              {text('我想听听代表作','Hear selected works')}
            </button>
          </div>
        </div>
        <div className="mobile-card-back">
          <header>
            <h2 className={composerName(composer, language).length > 24 ? 'long-name' : ''}>
              {composerName(composer, language)}
            </h2>
            {language === 'zh' && <small>{composer.nameOriginal}</small>}
          </header>
          <WorkList
            composer={composer}
            audio={audio}
            onToggle={onToggleAudio}
            compact
          />
          <button
            className="flip-card-button back-button"
            onClick={() => setShowWorks(false)}
          >
            <RotateCcw />
            {text('返回简介','Back to profile')}
          </button>
        </div>
      </div>
    </article>
  );
}

function RosterView({ onStart }: { onStart: (ids: string[]) => void }) {
  const { language, text } = useLanguage();
  const [roster, setRoster] = useState<string[]>(DEFAULT_COMPOSER_IDS);
  const selected = new Set(roster);
  const toggle = (id: string) =>
    setRoster((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 48
          ? [...current, id]
          : current,
    );
  return (
    <section className="roster-view">
      <div className="stage-intro">
        <p className="kicker">SELECT YOUR 48 · 61 COMPOSERS</p>
        <h1>{text('选择本届世界杯参赛作曲家','Choose this World Cup’s composers')}</h1>
        <p>
          {text('可以直接使用系统默认48人，也可以从61位候选者中自选48人；选定后再进行十二音级分组抽签。','Use the default field of 48, or choose your own 48 from 61 candidates before the twelve-pitch group draw.')}
        </p>
      </div>
      <div className="roster-toolbar">
        <div>
          <span>
            {text('已选择','Selected')} <b>{roster.length}</b> / 48
          </span>
          <small>
            {roster.length === 48
              ? text('名单已满足抽签人数','The field is ready for the draw')
              : text('请先取消一位默认选手，再加入候补选手','Remove a default composer before adding another candidate')}
          </small>
        </div>
        <Button
          variant="outline"
          onClick={() => setRoster(DEFAULT_COMPOSER_IDS)}
        >
          {text('恢复默认48人','Restore default 48')}
        </Button>
        <Button
          className="primary-action"
          onClick={() => onStart(DEFAULT_COMPOSER_IDS)}
        >
          {text('直接使用默认名单','Use default field')}
        </Button>
        <Button
          className="primary-action"
          disabled={roster.length !== 48}
          onClick={() => onStart(roster)}
        >
          {text('使用自选48人','Use my 48')}
          <ChevronRight />
        </Button>
      </div>
      <div className="roster-grid">
        {composers.map((composer, index) => (
          <article
            key={composer.id}
            className={`roster-card ${selected.has(composer.id) ? 'is-selected' : ''} ${index >= 48 ? 'is-reserve' : ''}`}
            onClick={() => toggle(composer.id)}
            role="checkbox"
            aria-checked={selected.has(composer.id)}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle(composer.id);
              }
            }}
          >
            <div className="roster-portrait">
              <ComposerPortrait composer={composer} />
              {selected.has(composer.id) && (
                <span>
                  <Check />
                </span>
              )}
            </div>
            <div>
              <p>
                {index >= 48 ? text('扩展候选','Additional candidate') : text('默认选手','Default player')} · {composerPeriod(composer, language)}
              </p>
              <h2>{composerName(composer, language)}</h2>
              {language === 'zh' && <small>{composer.nameOriginal}</small>}
              <em>{composerRegion(composer, language)}</em>
            </div>
          </article>
        ))}
      </div>
      <div className="roster-bottom">
        <span>
          {text('已选择','Selected')} <b>{roster.length}</b> / 48
        </span>
        <Button
          className="primary-action"
          disabled={roster.length !== 48}
          onClick={() => onStart(roster)}
        >
          {text('确认名单并进入抽签','Confirm field and draw groups')}
          <ChevronRight />
        </Button>
      </div>
    </section>
  );
}

function DrawView({
  state,
  onRedraw,
  onStart,
}: {
  state: TournamentState;
  onRedraw: () => void;
  onStart: () => void;
}) {
  const { language, text } = useLanguage();
  return (
    <section className="draw-view">
      <div className="stage-intro">
        <p className="kicker">GROUP DRAW · 12-TONE EQUAL TEMPERAMENT</p>
        <h1>{text('十二平均律小组抽签','Twelve-pitch group draw')}</h1>
        <p>
          {text('48位作曲家随机分为12组，每组对应十二平均律中的一个音级；每组4人同时比较，直接选出2人晋级。','The 48 composers are drawn into 12 pitch-named groups. Compare four at once and choose two to advance.')}
        </p>
      </div>
      <div className="draw-actions">
        <Button variant="outline" onClick={onRedraw}>
          <Shuffle />
          {text('重新抽签','Redraw')}
        </Button>
        <Button className="primary-action" onClick={onStart}>
          {text('确认分组，开始选择','Confirm groups and begin')}
          <ChevronRight />
        </Button>
      </div>
      <div className="groups-grid">
        {state.groups.map((group, index) => (
          <article className="group-card" key={GROUP_PITCHES[index]}>
            <header>
              <span>{GROUP_PITCHES[index]}</span>
              <b>{text('音级组','pitch group')}</b>
            </header>
            <ol>
              {group.map((id, slot) => (
                <li key={id}>
                  <b>{slot + 1}</b>
                  <span>{composerName(byId.get(id), language)}</span>
                  <small>{byId.get(id) ? composerPeriod(byId.get(id)!, language) : ''}</small>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}

function GroupView({
  state,
  selected,
  onToggle,
  onConfirm,
  audio,
  onToggleAudio,
  onPrepareAudio,
}: {
  state: TournamentState;
  selected: string[];
  onToggle: (id: string) => void;
  onConfirm: () => void;
  audio: AudioState;
  onToggleAudio: (composer: Composer, work: Work, index: number) => void;
  onPrepareAudio: (composer: Composer) => void;
}) {
  const { language, text } = useLanguage();
  const group = state.groups[state.activeGroup].map((id) => byId.get(id)!);
  return (
    <section className="group-view">
      <div className="match-intro">
        <p className="kicker">
          {groupTitle(state.activeGroup, language)} · {state.activeGroup + 1} / 12
        </p>
        <h1>{groupTitle(state.activeGroup, language)} · {text('选择两位作曲家','Choose two composers')}</h1>
        <p>{text('四人同时比较，可试听代表作；选满两位后确认晋级。','Compare all four, hear their works, then confirm two qualifiers.')}</p>
      </div>
      <div className="four-grid">
        {group.map((composer) => (
          <ComposerCard
            key={composer.id}
            composer={composer}
            selected={selected.includes(composer.id)}
            audio={audio}
            onToggleAudio={onToggleAudio}
            onPrepareAudio={onPrepareAudio}
            onSelect={() => onToggle(composer.id)}
          />
        ))}
      </div>
      <div className="group-confirm">
        <span>
          {text('已选择','Selected')} <b>{selected.length}</b> / 2
        </span>
        <Button
          className="primary-action"
          onClick={onConfirm}
          disabled={selected.length !== 2}
        >
          {text('确认本组晋级','Confirm qualifiers')}
          <ChevronRight />
        </Button>
      </div>
    </section>
  );
}

function RepechageCard({
  composer,
  selected,
  audio,
  onToggleAudio,
  onPrepareAudio,
  onSelect,
}: {
  composer: Composer;
  selected: boolean;
  audio: AudioState;
  onToggleAudio: (composer: Composer, work: Work, index: number) => void;
  onPrepareAudio: (composer: Composer) => void;
  onSelect: () => void;
}) {
  return (
    <ComposerCard
      composer={composer}
      selected={selected}
      audio={audio}
      onToggleAudio={onToggleAudio}
      onPrepareAudio={onPrepareAudio}
      onSelect={onSelect}
    />
  );
}

function RepechageView({
  state,
  selected,
  onToggle,
  onConfirm,
  audio,
  onToggleAudio,
  onPrepareAudio,
}: {
  state: TournamentState;
  selected: string[];
  onToggle: (id: string) => void;
  onConfirm: () => void;
  audio: AudioState;
  onToggleAudio: (composer: Composer, work: Work, index: number) => void;
  onPrepareAudio: (composer: Composer) => void;
}) {
  const { text } = useLanguage();
  const eliminated = eliminatedComposers(state).map((id) => byId.get(id)!);
  return (
    <section className="repechage-view">
      <div className="stage-intro">
        <p className="kicker">REPECHAGE · 24 COMPOSERS</p>
        <h1>{text('从24位淘汰者中复活8位','Revive 8 of the 24 eliminated composers')}</h1>
        <p>{text('点击卡片直接选择；翻到背面可试听代表作。','Select a card directly; flip it to hear selected works.')}</p>
      </div>
      <div className="selection-status sticky-selection">
        <span>
          {text('已选择','Selected')} <b>{selected.length}</b> / 8
        </span>
        <Button
          className="primary-action"
          disabled={selected.length !== 8}
          onClick={onConfirm}
        >
          {text('确认8位复活','Confirm 8 revivals')}
          <ChevronRight />
        </Button>
      </div>
      <div className="repechage-grid">
        {eliminated.map((composer) => (
          <RepechageCard
            key={composer.id}
            composer={composer}
            selected={selected.includes(composer.id)}
            audio={audio}
            onToggleAudio={onToggleAudio}
            onPrepareAudio={onPrepareAudio}
            onSelect={() => onToggle(composer.id)}
          />
        ))}
      </div>
    </section>
  );
}

function FinishedView({
  state,
  onReset,
  onStart,
}: {
  state: TournamentState;
  onReset: () => void;
  onStart: () => void;
}) {
  const { language, text } = useLanguage();
  const revived = state.repechagePicks;
  return (
    <section className="finished-view">
      <div className="result-icon">
        <Sparkles />
      </div>
      <p className="kicker">ROUND OF 32 · READY</p>
      <h1>{text('32强名单已经产生','The Round of 32 is ready')}</h1>
      <p>
        {text('24位小组直接晋级者与8位复活者，将随机落位，进入固定签表的单场淘汰赛。','The 24 group qualifiers and 8 revived composers will be drawn into a fixed single-elimination bracket.')}
      </p>
      <div className="knockout-launch">
        <Button className="primary-action" onClick={onStart}>
          <Swords />
          {text('抽取32强对阵','Draw the Round of 32')}
          <ChevronRight />
        </Button>
        <small>{text('抽签后每轮不再重新排列，胜者沿同一签表路径晋级。','After the draw, winners advance along the same bracket path.')}</small>
      </div>
      <h2>{text('小组直接晋级 · 24人','Group qualifiers · 24')}</h2>
      <div className="qualifiers-grid">
        {state.groups.map((_, index) => (
          <article key={index}>
            <header>{groupTitle(index, language)}</header>
            {state.groupPicks[index].map((id, rank) => (
              <div key={id}>
                <span>{rank + 1}</span>
                <strong>{composerName(byId.get(id), language)}</strong>
              </div>
            ))}
          </article>
        ))}
      </div>
      <h2>{text('复活晋级 · 8人','Revived qualifiers · 8')}</h2>
      <div className="revived-grid">
        {revived.map((id) => (
          <span key={id}>
            <Sparkles />
            <strong>{composerName(byId.get(id), language)}</strong>
          </span>
        ))}
      </div>
      <Button variant="outline" onClick={onReset}>
        <RotateCcw />
        {text('重新开始一届比赛','Start a new tournament')}
      </Button>
    </section>
  );
}

function KnockoutCard({
  composer,
  audio,
  onToggleAudio,
  onPrepareAudio,
  onChoose,
}: {
  composer: Composer;
  audio: AudioState;
  onToggleAudio: (composer: Composer, work: Work, index: number) => void;
  onPrepareAudio: (composer: Composer) => void;
  onChoose: () => void;
}) {
  return (
    <ComposerCard
      composer={composer}
      selected={false}
      audio={audio}
      onToggleAudio={onToggleAudio}
      onPrepareAudio={onPrepareAudio}
      onSelect={onChoose}
    />
  );
}

function KnockoutView({
  state,
  audio,
  onToggleAudio,
  onPrepareAudio,
  onChoose,
  onBack,
}: {
  state: TournamentState;
  audio: AudioState;
  onToggleAudio: (composer: Composer, work: Work, index: number) => void;
  onPrepareAudio: (composer: Composer) => void;
  onChoose: (id: string) => void;
  onBack: () => void;
}) {
  const { language, text } = useLanguage();
  const knockout = state.knockout!;
  const round = knockout.rounds[knockout.currentRound];
  const match = round.matches[knockout.currentMatch];
  const a = byId.get(match.a)!;
  const b = byId.get(match.b)!;
  const completed = round.matches.filter((item) => item.winner).length;
  return (
    <section className="knockout-view">
      <div className="knockout-head">
        <div>
          <p className="kicker">
            KNOCKOUT · {roundName(round.entrants.length, language)}
          </p>
          <h1>{roundName(round.entrants.length, language)}</h1>
          <p>
            {text('本轮第','Match')} {knockout.currentMatch + 1} / {round.matches.length} ·
            {text('点击卡片晋级，翻到背面可试听。','Select a card to advance; flip it to hear the music.')}
          </p>
        </div>
        <div className="knockout-tools">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            disabled={
              knockout.currentRound === 0 && knockout.currentMatch === 0
            }
          >
            <ArrowLeft />
            {text('回到上一步','Undo previous choice')}
          </Button>
          <div className="round-meter">
            <span>
              {completed}/{round.matches.length}
            </span>
            <i>
              <b
                style={{
                  width: `${(completed / round.matches.length) * 100}%`,
                }}
              />
            </i>
          </div>
        </div>
      </div>
      <div className="knockout-match-grid">
        <KnockoutCard
          composer={a}
          audio={audio}
          onToggleAudio={onToggleAudio}
          onPrepareAudio={onPrepareAudio}
          onChoose={() => onChoose(a.id)}
        />
        <div className="knockout-vs">VS</div>
        <KnockoutCard
          composer={b}
          audio={audio}
          onToggleAudio={onToggleAudio}
          onPrepareAudio={onPrepareAudio}
          onChoose={() => onChoose(b.id)}
        />
      </div>
    </section>
  );
}

function RoundTransitionView({
  state,
  onContinue,
  onBack,
}: {
  state: TournamentState;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { language, text } = useLanguage();
  const knockout = state.knockout!;
  const round = knockout.rounds[knockout.currentRound];
  const winners = round.matches.map((match) => match.winner!).filter(Boolean);
  const winnerIds = new Set(winners);
  const eliminated = round.entrants.filter((id) => !winnerIds.has(id));
  const final = winners.length === 1;
  return (
    <section className="round-transition">
      <div className={`transition-seal ${final ? 'champion-seal' : ''}`}>
        {final ? <Crown /> : <ChevronRight />}
      </div>
      <p className="kicker">{roundName(round.entrants.length, language)} · COMPLETE</p>
      <h1>
        {final
          ? `${composerName(byId.get(winners[0]), language)} ${text('赢得决赛','wins the final')}`
          : language === 'zh' ? `${winners.length}位作曲家晋级${roundName(winners.length, language)}` : `${winners.length} composers advance to the ${roundName(winners.length, language)}`}
      </h1>
      <p>
        {final
          ? text('冠军已经产生，进入最终结果页查看完整晋级路径。','The champion is decided. Continue to see the complete bracket.')
          : text('本轮签表已经锁定，晋级者将沿原有位置进入下一轮。','This round is locked; winners advance along the existing bracket path.')}
      </p>
      <div className="transition-columns">
        <section>
          <h2>{text('晋级','Advancing')} · {winners.length}</h2>
          <div>
            {winners.map((id) => (
              <span key={id}>
                <Check />
                <strong>{composerName(byId.get(id), language)}</strong>
              </span>
            ))}
          </div>
        </section>
        <section>
          <h2>{text('止步本轮','Eliminated')} · {eliminated.length}</h2>
          <div>
            {eliminated.map((id) => (
              <span key={id}>
                <small>—</small>
                {composerName(byId.get(id), language)}
              </span>
            ))}
          </div>
        </section>
      </div>
      <div className="transition-actions">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft />
          {text('修改最后一场','Change the last match')}
        </Button>
        <Button className="primary-action transition-next" onClick={onContinue}>
          {final ? text('查看最终结果','View final result') : `${text('进入','Continue to ')}${roundName(winners.length, language)}`}
          <ChevronRight />
        </Button>
      </div>
    </section>
  );
}

function ResultBracket({ state }: { state: TournamentState }) {
  const { language, text } = useLanguage();
  const rounds = state.knockout!.rounds;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [connections, setConnections] = useState<{
    width: number;
    height: number;
    paths: string[];
  }>({ width: 0, height: 0, paths: [] });
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const draw = () => {
      const rootBox = root.getBoundingClientRect();
      const paths: string[] = [];
      rounds.slice(0, -1).forEach((round, roundIndex) =>
        round.matches.forEach((match, matchIndex) => {
          if (!match.winner) return;
          const nextIndex = rounds[roundIndex + 1].matches.findIndex(
            (next) => next.a === match.winner || next.b === match.winner,
          );
          if (nextIndex < 0) return;
          const start = root.querySelector<HTMLElement>(
            `[data-round="${roundIndex}"][data-match="${matchIndex}"]`,
          );
          const end = root.querySelector<HTMLElement>(
            `[data-round="${roundIndex + 1}"][data-match="${nextIndex}"]`,
          );
          if (!start || !end) return;
          const a = start.getBoundingClientRect();
          const b = end.getBoundingClientRect();
          const x1 = a.right - rootBox.left;
          const y1 = a.top + a.height / 2 - rootBox.top;
          const x2 = b.left - rootBox.left;
          const y2 = b.top + b.height / 2 - rootBox.top;
          const mid = (x1 + x2) / 2;
          paths.push(`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`);
        }),
      );
      setConnections({
        width: root.scrollWidth,
        height: root.scrollHeight,
        paths,
      });
    };
    const frame = requestAnimationFrame(() => requestAnimationFrame(draw));
    const observer = new ResizeObserver(draw);
    observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [rounds]);
  return (
    <div className="bracket-scroll">
      <div className="result-bracket" ref={rootRef}>
        <svg
          className="bracket-connections"
          width={connections.width}
          height={connections.height}
          viewBox={`0 0 ${connections.width} ${connections.height}`}
          aria-hidden="true"
        >
          {connections.paths.map((path, index) => (
            <path d={path} key={index} />
          ))}
        </svg>
        {rounds.map((round, index) => (
          <section className="bracket-round" key={index}>
            <header>
              {roundName(round.entrants.length, language)}
              <small>{round.matches.length} {text('场','matches')}</small>
            </header>
            <div>
              {round.matches.map((match, matchIndex) => (
                <article
                  key={matchIndex}
                  data-round={index}
                  data-match={matchIndex}
                >
                  <span className={match.winner === match.a ? 'advanced' : ''}>
                    {composerName(byId.get(match.a), language)}
                    {match.winner === match.a && <Check />}
                  </span>
                  <span className={match.winner === match.b ? 'advanced' : ''}>
                    {composerName(byId.get(match.b), language)}
                    {match.winner === match.b && <Check />}
                  </span>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function downloadResultImage(state: TournamentState, language: Language) {
  const rounds = state.knockout!.rounds;
  const final = rounds.at(-1)!.matches[0];
  const champion = byId.get(state.champion!)!;
  const runnerUp = byId.get(final.a === state.champion ? final.b : final.a)!;
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = 1900 * scale;
  canvas.height = 1250 * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#f3eee5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2e1018';
  ctx.fillRect(0, 0, canvas.width, 150);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d7b66d';
  ctx.font = '700 22px Microsoft YaHei, sans-serif';
  ctx.fillText('大师对位 · MusiCup · FINAL RESULT', 950, 48);
  ctx.fillStyle = '#fff8eb';
  ctx.font = '700 48px Microsoft YaHei, sans-serif';
  ctx.fillText(`${composerName(champion, language)} · ${language === 'zh' ? '冠军' : 'CHAMPION'}`, 950, 108);
  ctx.fillStyle = '#6d5642';
  ctx.font = '18px Microsoft YaHei, sans-serif';
  ctx.fillText(
    language === 'zh' ? `亚军 ${runnerUp.nameZh} · 48位作曲家 · 十二平均律小组赛 · 32强淘汰赛` : `Runner-up ${runnerUp.nameOriginal} · 48 composers · 12 pitch groups · Round of 32`,
    950,
    184,
  );
  const top = 245;
  const areaHeight = 900;
  const columnWidth = 320;
  const gap = 48;
  const left = 36;
  const matchCenter = (roundIndex: number, matchIndex: number) => {
    const round = rounds[roundIndex];
    const slot = areaHeight / round.matches.length;
    return top + matchIndex * slot + slot / 2;
  };
  ctx.strokeStyle = '#b49262';
  ctx.lineWidth = 2;
  rounds.slice(0, -1).forEach((round, roundIndex) =>
    round.matches.forEach((match, matchIndex) => {
      if (!match.winner) return;
      const nextIndex = rounds[roundIndex + 1].matches.findIndex(
        (next) => next.a === match.winner || next.b === match.winner,
      );
      if (nextIndex < 0) return;
      const x1 = left + roundIndex * (columnWidth + gap) + columnWidth;
      const x2 = left + (roundIndex + 1) * (columnWidth + gap);
      const mid = (x1 + x2) / 2;
      const y1 = matchCenter(roundIndex, matchIndex);
      const y2 = matchCenter(roundIndex + 1, nextIndex);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(mid, y1);
      ctx.lineTo(mid, y2);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }),
  );
  rounds.forEach((round, roundIndex) => {
    const x = left + roundIndex * (columnWidth + gap);
    ctx.fillStyle = '#641d2d';
    ctx.fillRect(x, top - 42, columnWidth, 34);
    ctx.fillStyle = '#fff8eb';
    ctx.font = '700 16px Microsoft YaHei, sans-serif';
    ctx.fillText(
      roundName(round.entrants.length, language),
      x + columnWidth / 2,
      top - 19,
    );
    const slot = areaHeight / round.matches.length;
    round.matches.forEach((match, index) => {
      const y = top + index * slot + Math.max(0, (slot - 46) / 2);
      ctx.fillStyle = '#fffdf8';
      ctx.strokeStyle = '#cfbea8';
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, columnWidth, 44);
      ctx.strokeRect(x, y, columnWidth, 44);
      [match.a, match.b].forEach((id, row) => {
        ctx.fillStyle = match.winner === id ? '#641d2d' : '#766a60';
        ctx.font = `${match.winner === id ? '700' : '400'} 14px Microsoft YaHei, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(
          `${match.winner === id ? '✓ ' : ''}${composerName(byId.get(id), language)}`,
          x + 10,
          y + 17 + row * 18,
        );
      });
    });
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8c7e70';
  ctx.font = '13px Microsoft YaHei, sans-serif';
  ctx.fillText(language === 'zh' ? '由“大师对位 · MusiCup｜古典作曲家世界杯”生成' : 'Generated by MusiCup · Classical Composer World Cup', 950, 1212);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = language === 'zh' ? `大师对位-MusiCup-${champion.nameZh}-冠军.png` : `MusiCup-${champion.nameOriginal}-Champion.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, 'image/png');
}

type RankingItem = { id: string; count: number };
type StatisticsData = {
  total: number;
  rankings: {
    champion: RankingItem[];
    runnerUp: RankingItem[];
    topFour: RankingItem[];
  };
  namedSaved?: boolean;
};
function rankingList(items: RankingItem[], total: number, language: Language) {
  return (
    <ol className="ranking-list">
      {items.length ? (
        items.map((item, index) => (
          <li key={item.id}>
            <b>{index + 1}</b>
            <span>{composerName(byId.get(item.id), language) || item.id}</span>
            <strong>
              {item.count}
              <small>
                {total ? ` · ${Math.round((item.count / total) * 100)}%` : ''}
              </small>
            </strong>
          </li>
        ))
      ) : (
        <li className="empty-ranking">{language === 'zh' ? '还没有完整比赛结果' : 'No completed results yet'}</li>
      )}
    </ol>
  );
}

function ResultStatistics({
  state,
  onStateChange,
}: {
  state: TournamentState;
  onStateChange: (state: TournamentState) => void;
}) {
  const { language, text } = useLanguage();
  const [data, setData] = useState<StatisticsData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [name, setName] = useState(state.savedDisplayName || '');
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState('');
  const [playerMessage, setPlayerMessage] = useState(state.savedPlayerMessage || '');
  const [playerMessageStatus, setPlayerMessageStatus] = useState('');
  const submitted = useRef(false);
  const placements = useMemo(() => {
    const rounds = state.knockout!.rounds;
    const final = rounds.at(-1)!.matches[0];
    const champion = state.champion!;
    const runnerUp = final.a === champion ? final.b : final.a;
    const semifinalists = rounds
      .find((round) => round.entrants.length === 4)!
      .entrants.filter((id) => id !== champion && id !== runnerUp);
    return { champion, runnerUp, semifinalists };
  }, [state.champion, state.knockout]);
  const payload = (extra: Record<string, unknown> = {}) => ({
    project: 'composer',
    submissionId: state.statisticsSubmissionId,
    championId: placements.champion,
    runnerUpId: placements.runnerUp,
    semifinalistIds: placements.semifinalists,
    language,
    ...extra,
  });
  const load = async () => {
    setStatus('loading');
    try {
      const response = await fetch(`${statisticsEndpoint()}?project=composer`);
      if (!response.ok) throw new Error();
      setData(await response.json());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };
  useEffect(() => {
    if (!state.statisticsSubmissionId) {
      onStateChange({ ...state, statisticsSubmissionId: crypto.randomUUID() });
      return;
    }
    if (submitted.current) return;
    submitted.current = true;
    (async () => {
      try {
        const response = await fetch(statisticsEndpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload()),
        });
        if (!response.ok) throw new Error();
        setData(await response.json());
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    })();
  }, [state.statisticsSubmissionId]);
  const saveNamed = async () => {
    const displayName = name.trim();
    if (!displayName) {
      setMessage(text('请先输入昵称。','Enter a nickname first.'));
      return;
    }
    if (!consent) {
      setMessage(text('请先勾选自愿记名同意项。','Please confirm the voluntary attribution consent.'));
      return;
    }
    setMessage(text('正在保存…','Saving…'));
    try {
      const bracket = state.knockout!.rounds.map((round) =>
        round.matches.map(({ a, b, winner }) => ({ a, b, winner })),
      );
      const response = await fetch(statisticsEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          payload({ displayName, namedConsent: true, bracket }),
        ),
      });
      if (!response.ok) throw new Error();
      setData(await response.json());
      onStateChange({
        ...state,
        namedResultSaved: true,
        savedDisplayName: displayName,
      });
      setMessage(text('昵称和本届完整签表已保存。','Your nickname and full bracket have been saved.'));
    } catch {
      setMessage(text('保存失败，请检查网络后重试；匿名统计与本地结果不受影响。','Could not save. Check your connection and retry; anonymous totals and your local result are unaffected.'));
    }
  };
  const deleteNamed = async () => {
    if (!confirm(text('确认撤回昵称和完整签表吗？匿名名次仍会保留在汇总统计中。','Remove your nickname and full bracket? Anonymous placements will remain in the totals.')))
      return;
    try {
      const response = await fetch(statisticsEndpoint(), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: 'composer',
          submissionId: state.statisticsSubmissionId,
        }),
      });
      if (!response.ok) throw new Error();
      setName('');
      setConsent(false);
      onStateChange({
        ...state,
        namedResultSaved: false,
        savedDisplayName: '',
      });
      setMessage(text('具名记录已撤回，匿名名次统计仍保留。','Named data removed; anonymous placements remain in the totals.'));
    } catch {
      setMessage(text('撤回失败，请检查网络后重试。','Could not remove the record. Check your connection and retry.'));
    }
  };
  const savePlayerMessage = async () => {
    const messageBody = playerMessage.trim();
    if (!messageBody) {
      setPlayerMessageStatus(text('请先写下想说的话。','Write a message first.'));
      return;
    }
    setPlayerMessageStatus(text('正在送出…','Sending…'));
    try {
      const response = await fetch(statisticsEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload({ playerMessage: messageBody })),
      });
      if (!response.ok) throw new Error();
      onStateChange({ ...state, playerMessageSaved: true, savedPlayerMessage: messageBody });
      setPlayerMessageStatus(text('留言已经送达，谢谢你的建议。','Message received. Thank you for the feedback.'));
    } catch {
      setPlayerMessageStatus(text('留言暂时未能送出，请检查网络后重试。','The message could not be sent. Check your connection and retry.'));
    }
  };
  const championCount =
    data?.rankings.champion.find((item) => item.id === placements.champion)
      ?.count || 0;
  const topFourCount =
    data?.rankings.topFour.find((item) => item.id === placements.champion)
      ?.count || 0;
  return (
    <section className="statistics-section">
      <header>
        <div>
          <p className="kicker">COMMUNITY RESULTS</p>
          <h2>{text('全站结果统计','Community results')}</h2>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <BarChart3 />
          {text('刷新排行','Refresh')}
        </Button>
      </header>
      {status === 'loading' ? (
        <div className="statistics-notice">
          <LoaderCircle className="spin" />
          {text('正在汇总所有玩家的结果…','Loading community results…')}
        </div>
      ) : status === 'error' ? (
        <div className="statistics-notice error">
          <p>{text('统计服务暂时无法连接，本地比赛结果不受影响。','The statistics service is unavailable. Your local result is unaffected.')}</p>
          <Button variant="outline" onClick={load}>
            {text('重新加载','Try again')}
          </Button>
        </div>
      ) : (
        <>
          <div className="personal-stats">
            <article>
              <span>{text('完整结果','Completed results')}</span>
              <strong>{data?.total || 0}</strong>
              <small>{text('份','entries')}</small>
            </article>
            <article>
              <span>{text('同样选择本届冠军','Chose the same champion')}</span>
              <strong>{championCount}</strong>
              <small>
                {data?.total
                  ? `${Math.round((championCount / data.total) * 100)}%`
                  : ''}
              </small>
            </article>
            <article>
              <span>{text('将本届冠军选入四强','Put this champion in the top four')}</span>
              <strong>{topFourCount}</strong>
              <small>
                {data?.total
                  ? `${Math.round((topFourCount / data.total) * 100)}%`
                  : ''}
              </small>
            </article>
          </div>
          <div className="rankings-grid">
            <section>
              <h3>{text('冠军排行','Champion ranking')}</h3>
              {rankingList(data?.rankings.champion || [], data?.total || 0, language)}
            </section>
            <section>
              <h3>{text('亚军排行','Runner-up ranking')}</h3>
              {rankingList(data?.rankings.runnerUp || [], data?.total || 0, language)}
            </section>
            <section>
              <h3>{text('四强排行','Semifinalist ranking')}</h3>
              {rankingList(data?.rankings.topFour || [], data?.total || 0, language)}
            </section>
          </div>
        </>
      )}
      <section className="named-result">
        <div className="named-copy">
          <ShieldCheck />
          <div>
            <h3>{text('自愿记名','Optional attribution')}</h3>
            <p>
              {text('匿名冠军、亚军和四强会自动进入汇总。只有主动填写昵称并勾选同意后，才保存昵称与完整签表；不收集联系方式，具名资料最多保留一年。','Champion, runner-up, and semifinalists enter anonymous totals. A nickname and full bracket are stored only with your explicit consent, for no more than one year.')}
            </p>
          </div>
        </div>
        {state.namedResultSaved ? (
          <div className="named-saved">
            <span>
              {text('已以','Saved as')} “<b>{state.savedDisplayName}</b>”
            </span>
            <Button variant="outline" onClick={deleteNamed}>
              <Trash2 />
              {text('撤回记名','Remove attribution')}
            </Button>
          </div>
        ) : (
          <div className="named-form">
            <label>
              {text('昵称','Nickname')}
              <input
                value={name}
                maxLength={30}
                onChange={(event) => setName(event.target.value)}
                placeholder={text('请勿填写真实姓名、电话等信息','Do not enter your real name, phone number, or contact details')}
              />
            </label>
            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>{text('我自愿提交昵称，并同意保存本届完整签表用于活动统计。','I voluntarily submit this nickname and consent to storing my full bracket for event statistics.')}</span>
            </label>
            <Button className="primary-action" onClick={saveNamed}>
              {text('保存具名结果','Save named result')}
            </Button>
          </div>
        )}
        {message && (
          <p className="named-message" role="status">
            {message}
          </p>
        )}
        <details>
          <summary>{text('数据与隐私说明','Data and privacy')}</summary>
          <p>
            {text('匿名统计只保存随机结果编号和冠军、亚军、四强；昵称不会出现在公开排行榜中。撤回记名后会删除昵称与完整签表，但匿名名次继续用于汇总，避免排行榜计数失真。','Anonymous totals store only a random result ID and the top four. Nicknames never appear publicly. Removing attribution deletes the nickname and full bracket while retaining anonymous placements for accurate totals.')}
          </p>
        </details>
      </section>
      <section className="player-message-box">
        <div className="named-copy">
          <Music2 />
          <div>
            <h3>{text('留下一句话','Leave a message')}</h3>
            <p>{text('你的冠军是谁？还希望加入哪些作曲家、曲目或玩法？留言只在管理员后台显示，不会自动公开。','Tell us about your champion, missing composers, works, or ideas. Messages are visible only to the administrator and are not published automatically.')}</p>
          </div>
        </div>
        <textarea value={playerMessage} maxLength={300} onChange={(event) => setPlayerMessage(event.target.value)} placeholder={text('写下你的感受或建议（最多300字，请勿填写电话、邮箱等个人信息）','Feedback or suggestions (300 characters maximum; do not include contact or sensitive information)')} />
        <div className="player-message-actions"><small>{playerMessage.length}/300 · {text('可以匿名留言','anonymous messages welcome')}</small><Button className="primary-action" onClick={savePlayerMessage}>{state.playerMessageSaved ? text('更新留言','Update message') : text('送出留言','Send message')}</Button></div>
        {playerMessageStatus && <p className="named-message" role="status">{playerMessageStatus}</p>}
      </section>
    </section>
  );
}

function FinalResultView({
  state,
  onStateChange,
  onReset,
  onDownload,
}: {
  state: TournamentState;
  onStateChange: (state: TournamentState) => void;
  onReset: () => void;
  onDownload: () => void;
}) {
  const { language, text } = useLanguage();
  const rounds = state.knockout!.rounds;
  const final = rounds.at(-1)!.matches[0];
  const champion = byId.get(state.champion!)!;
  const runnerUp = byId.get(final.a === state.champion ? final.b : final.a)!;
  const semifinal = rounds
    .find((round) => round.entrants.length === 4)!
    .entrants.filter((id) => id !== champion.id && id !== runnerUp.id)
    .map((id) => byId.get(id)!);
  return (
    <section className="final-result">
      <div className="champion-hero">
        <div className="champion-crown">
          <Crown />
        </div>
        <div className="champion-image">
          <ComposerPortrait composer={champion} />
        </div>
        <p className="kicker">大师对位 · MusiCup · CHAMPION</p>
        <h1>{composerName(champion, language)}</h1>
        {language === 'zh' && <p className="champion-original">{champion.nameOriginal}</p>}
        <p>{composerBio(champion, language)}</p>
      </div>
      <div className="podium">
        <article className="podium-champion">
          <Crown />
          <small>{text('冠军','Champion')}</small>
          <strong>{composerName(champion, language)}</strong>
        </article>
        <article>
          <Medal />
          <small>{text('亚军','Runner-up')}</small>
          <strong>{composerName(runnerUp, language)}</strong>
        </article>
        {semifinal.map((composer) => (
          <article key={composer.id}>
            <Sparkles />
            <small>{text('四强','Semifinalist')}</small>
            <strong>{composerName(composer, language)}</strong>
          </article>
        ))}
      </div>
      <section className="complete-bracket">
        <div className="bracket-title">
          <div>
            <p className="kicker">FULL BRACKET</p>
            <h2>{text('淘汰赛完整对阵','Complete knockout bracket')}</h2>
          </div>
          <span>{text('左右滑动查看完整签表','Swipe sideways to see the full bracket')}</span>
        </div>
        <ResultBracket state={state} />
      </section>
      <ResultStatistics state={state} onStateChange={onStateChange} />
      <div className="result-actions">
        <Button className="primary-action" onClick={onDownload}>
          <Download />
          {text('下载结果图片','Download result image')}
        </Button>
        <Button variant="outline" onClick={onReset}>
          <RotateCcw />
          {text('重新开始一届比赛','Start a new tournament')}
        </Button>
      </div>
    </section>
  );
}

export default function Home() {
  const { language, text } = useLanguage();
  const [state, setState] = useState<TournamentState | null>(null);
  const [showOpening, setShowOpening] = useState(true);
  const [showLegal, setShowLegal] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [audio, setAudio] = useState<AudioState>({
    active: null,
    loading: null,
    error: null,
    progress: 0,
    sources: {},
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    try {
      const saved = restoreTournament(
        JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'),
      );
      setState(saved || createTournament());
      setShowOpening(!saved || saved.phase === 'roster');
      const cached = JSON.parse(localStorage.getItem(AUDIO_CACHE_KEY) || '{}') as Record<string, TrackSource>;
      const openlyLicensed = Object.fromEntries(Object.entries(cached).filter(([, source]) => source.provider === 'Wikimedia Commons'));
      setAudio((value) => ({ ...value, sources: openlyLicensed }));
    } catch {
      setState(createTournament());
    }
    return () => {
      audioRef.current?.pause();
      if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
    };
  }, []);
  useEffect(() => {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);
  useEffect(() => {
    const openlyLicensed = Object.fromEntries(Object.entries(audio.sources).filter(([, source]) => source.provider === 'Wikimedia Commons'));
    localStorage.setItem(AUDIO_CACHE_KEY, JSON.stringify(openlyLicensed));
  }, [audio.sources]);
  useEffect(() => {
    if (state?.phase === 'group-selection')
      setSelected(state.groupPicks[state.activeGroup] || []);
    if (state?.phase === 'repechage') setSelected(state.repechagePicks);
  }, [state?.phase, state?.activeGroup]);
  const progress = useMemo(() => {
    if (!state) return 0;
    if (state.phase === 'result') return 100;
    const knockoutWins =
      state.knockout?.rounds
        .flatMap((round) => round.matches)
        .filter((match) => match.winner).length || 0;
    if (state.knockout) return Math.round(75 + (knockoutWins / 31) * 25);
    return Math.round(
      (state.groupPicks.length / 12) * 65 +
        (state.repechagePicks.length / 8) * 10,
    );
  }, [state]);
  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
    fadeTimerRef.current = null;
    setAudio((value) => ({
      ...value,
      active: null,
      loading: null,
      progress: 0,
    }));
  };
  const prepareComposerAudio = async (composer: Composer) => {
    const pending = composer.works.map(async (work, index) => {
      const trackId = `${composer.id}:${index}`;
      if (audio.sources[trackId]) return null;
      try {
        return { trackId, source: await resolveTrackSource(composer, work) };
      } catch {
        return null;
      }
    });
    const prepared = (await Promise.all(pending)).filter(
      (item): item is { trackId: string; source: TrackSource } => Boolean(item),
    );
    if (prepared.length)
      setAudio((value) => ({
        ...value,
        sources: {
          ...value.sources,
          ...Object.fromEntries(
            prepared.map((item) => [item.trackId, item.source]),
          ),
        },
      }));
  };
  const toggleAudio = async (composer: Composer, work: Work, index: number) => {
    const trackId = `${composer.id}:${index}`;
    if (
      audio.active === trackId &&
      audioRef.current &&
      !audioRef.current.paused
    ) {
      stopAudio();
      return;
    }
    stopAudio();
    setAudio((value) => ({
      ...value,
      active: null,
      loading: trackId,
      error: null,
      errorDetail: undefined,
      progress: 0,
    }));
    const cached = audio.sources[trackId];
    const player = new Audio(cached?.url || SILENT_WAV);
    audioRef.current = player;
    player.preload = 'auto';
    player.volume = cached ? 1 : 0;
    const unlock = cached
      ? Promise.resolve()
      : player.play().catch(() => undefined);
    try {
      const source = cached || (await resolveTrackSource(composer, work));
      await unlock;
      if (!cached) {
        player.pause();
        player.src = source.url;
        player.volume = 1;
        player.load();
      }
      setAudio((value) => ({
        ...value,
        sources: { ...value.sources, [trackId]: source },
      }));
      player.ontimeupdate = () =>
        setAudio((value) => ({
          ...value,
          progress: Math.min(player.currentTime, 30) / 30,
        }));
      player.onended = () => stopAudio();
      player.onerror = () => {
        stopAudio();
        setAudio((value) => {
          const sources = { ...value.sources };
          delete sources[trackId];
          return {
            ...value,
            sources,
            active: null,
            loading: null,
            error: trackId,
            errorDetail: text('当前地区或音频地址不可用，已清除缓存','This preview is unavailable in your region or its media address has changed.'),
            progress: 0,
          };
        });
      };
      await player.play();
      setAudio((value) => ({
        ...value,
        active: trackId,
        loading: null,
        error: null,
        progress: 0,
        sources: { ...value.sources, [trackId]: source },
      }));
      fadeTimerRef.current = setInterval(() => {
        if (player.paused) return;
        const time = player.currentTime;
        if (time >= 27)
          player.volume = Math.max(0, Math.min(1, (30 - time) / 3));
        if (time >= 30) {
          player.pause();
          player.currentTime = 0;
          stopAudio();
        }
      }, 50);
    } catch (error) {
      stopAudio();
      const detail =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? text('浏览器阻止播放，请再次点击播放','Your browser blocked playback. Tap play again.')
          : error instanceof Error && error.message === 'NETWORK'
            ? text('网络无法连接试听目录','The preview catalogue could not be reached.')
            : error instanceof Error && error.message === 'NO_MATCH'
              ? text('未找到与该作品相符的试听','No reliably matching preview was found.')
              : text('当前地区或音频地址不可用','This preview is unavailable in your region or its address has changed.');
      setAudio((value) => ({
        ...value,
        active: null,
        loading: null,
        error: trackId,
        errorDetail: detail,
        progress: 0,
      }));
    }
  };
  const togglePick = (id: string, limit: number) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < limit
          ? [...current, id]
          : current,
    );
  const confirmGroup = () => {
    if (!state || selected.length !== 2) return;
    stopAudio();
    const picks = [...state.groupPicks];
    picks[state.activeGroup] = selected;
    if (state.activeGroup === 11) {
      setState({
        ...state,
        phase: 'repechage',
        groupPicks: picks,
        repechagePicks: [],
      });
      setSelected([]);
    } else {
      setState({
        ...state,
        activeGroup: state.activeGroup + 1,
        groupPicks: picks,
      });
      setSelected([]);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const confirmRepechage = () => {
    if (!state || selected.length !== 8) return;
    stopAudio();
    setState({ ...state, phase: 'finished', repechagePicks: selected });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const startKnockout = () => {
    if (!state) return;
    stopAudio();
    const entrants = shuffledKnockoutEntrants(state);
    setState({
      ...state,
      phase: 'knockout',
      knockout: {
        rounds: [makeRound(entrants)],
        currentRound: 0,
        currentMatch: 0,
      },
      champion: undefined,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const chooseKnockoutWinner = (id: string) => {
    if (!state?.knockout || state.phase !== 'knockout') return;
    stopAudio();
    const knockout = {
      ...state.knockout,
      rounds: state.knockout.rounds.map((round) => ({
        ...round,
        matches: round.matches.map((match) => ({ ...match })),
      })),
    };
    const round = knockout.rounds[knockout.currentRound];
    const match = round.matches[knockout.currentMatch];
    if (id !== match.a && id !== match.b) return;
    match.winner = id;
    const next = round.matches.findIndex((item) => !item.winner);
    if (next === -1)
      setState({ ...state, phase: 'round-transition', knockout });
    else {
      knockout.currentMatch = next;
      setState({ ...state, knockout });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const undoKnockoutMatch = () => {
    if (!state?.knockout) return;
    stopAudio();
    const knockout = {
      ...state.knockout,
      rounds: state.knockout.rounds.map((round) => ({
        ...round,
        matches: round.matches.map((match) => ({ ...match })),
      })),
    };
    let round = knockout.rounds[knockout.currentRound];
    if (
      state.phase === 'knockout' &&
      knockout.currentMatch === 0 &&
      knockout.currentRound > 0
    ) {
      knockout.rounds.pop();
      knockout.currentRound -= 1;
      round = knockout.rounds[knockout.currentRound];
      const target = round.matches.length - 1;
      round.matches[target].winner = undefined;
      knockout.currentMatch = target;
    } else {
      const target =
        state.phase === 'round-transition'
          ? round.matches.length - 1
          : knockout.currentMatch - 1;
      if (target < 0) return;
      round.matches[target].winner = undefined;
      knockout.currentMatch = target;
    }
    setState({ ...state, phase: 'knockout', knockout, champion: undefined });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const continueKnockout = () => {
    if (!state?.knockout) return;
    const knockout = { ...state.knockout, rounds: [...state.knockout.rounds] };
    const round = knockout.rounds[knockout.currentRound];
    const winners = round.matches.map((match) => match.winner!).filter(Boolean);
    if (winners.length === 1) {
      setState({ ...state, phase: 'result', champion: winners[0], knockout });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    knockout.rounds.push(makeRound(winners));
    knockout.currentRound += 1;
    knockout.currentMatch = 0;
    setState({ ...state, phase: 'knockout', knockout });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const reset = () => {
    stopAudio();
    setSelected([]);
    setState(createTournament());
    setShowOpening(true);
  };
  if (!state)
    return (
      <main className="loading-screen">
        <LoaderCircle className="spin" />
        <span>{text('正在准备48人名单…','Preparing the field of 48…')}</span>
      </main>
    );
  if (showOpening)
    return <OpeningCover onStart={() => setShowOpening(false)} />;
  const stageText =
    state.phase === 'roster'
      ? text('选择48位参赛者','Choose 48 composers')
      : state.phase === 'draw'
        ? text('等待抽签','Awaiting the draw')
        : state.phase === 'group-selection'
          ? `${groupTitle(state.activeGroup, language)} · ${text('已完成','completed')} ${state.groupPicks.length}/12`
          : state.phase === 'repechage'
            ? text('复活赛 · 选择8人','Repechage · Choose 8')
            : state.phase === 'finished'
              ? text('32强待抽签','Round of 32 draw')
              : state.phase === 'knockout' && state.knockout
                ? `${roundName(state.knockout.rounds[state.knockout.currentRound].entrants.length, language)} · ${text('第','Match ')}${state.knockout.currentMatch + 1}`
                : state.phase === 'round-transition'
                  ? text('本轮完成','Round complete')
                  : text('冠军已经产生','Champion crowned');
  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top">
          <img
            className="brand-note"
            src="./musicup-note-icon.png"
            alt=""
          />
          <span className="brand-wordmark" aria-label="MusiCup 大师对位">
            <strong>MusiCup</strong>
            <small className="brand-cn" aria-hidden="true">
              <span>大</span><span>师</span><span>对</span><span>位</span>
            </small>
          </span>
        </a>
        <div className="stage-progress">
          <span>{stageText}</span>
          <i>
            <b style={{ width: `${progress}%` }} />
          </i>
        </div>
        <div className="topbar-actions">
          <LanguageSwitch compact />
          {state.phase !== 'roster' && state.phase !== 'result' ? (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw />
              {text('重新开始','Restart')}
            </Button>
          ) : null}
        </div>
        <div className="brand-event-title">{text('古典作曲家世界杯','Classical Composer World Cup')}</div>
      </header>
      <div id="top">
        {state.phase === 'roster' && (
          <RosterView
            onStart={(ids) => setState(createTournament(ids, 'draw'))}
          />
        )}{' '}
        {state.phase === 'draw' && (
          <DrawView
            state={state}
            onRedraw={() =>
              setState(createTournament(state.groups.flat(), 'draw'))
            }
            onStart={() => setState({ ...state, phase: 'group-selection' })}
          />
        )}{' '}
        {state.phase === 'group-selection' && (
          <GroupView
            state={state}
            selected={selected}
            onToggle={(id) => togglePick(id, 2)}
            onConfirm={confirmGroup}
            audio={audio}
            onToggleAudio={toggleAudio}
            onPrepareAudio={prepareComposerAudio}
          />
        )}{' '}
        {state.phase === 'repechage' && (
          <RepechageView
            state={state}
            selected={selected}
            onToggle={(id) => togglePick(id, 8)}
            onConfirm={confirmRepechage}
            audio={audio}
            onToggleAudio={toggleAudio}
            onPrepareAudio={prepareComposerAudio}
          />
        )}{' '}
        {state.phase === 'finished' && (
          <FinishedView state={state} onReset={reset} onStart={startKnockout} />
        )}{' '}
        {state.phase === 'knockout' && (
          <KnockoutView
            state={state}
            audio={audio}
            onToggleAudio={toggleAudio}
            onPrepareAudio={prepareComposerAudio}
            onChoose={chooseKnockoutWinner}
            onBack={undoKnockoutMatch}
          />
        )}{' '}
        {state.phase === 'round-transition' && (
          <RoundTransitionView
            state={state}
            onContinue={continueKnockout}
            onBack={undoKnockoutMatch}
          />
        )}{' '}
        {state.phase === 'result' && (
          <FinalResultView
            state={state}
            onStateChange={setState}
            onReset={reset}
            onDownload={() => downloadResultImage(state, language)}
          />
        )}
      </div>
      <footer>
        <span className="footer-music">
          <Music2 />
          {text('肖像来自 Wikipedia / Wikimedia Commons · 试听优先使用开放录音，部分商店试听由 iTunes 提供','Portraits: Wikipedia / Wikimedia Commons · Open recordings preferred; some store previews provided courtesy of iTunes')}
        </span>
        <button type="button" className="legal-link" onClick={() => setShowLegal(true)}>{text('素材、版权与隐私说明','Credits, rights & privacy')}</button>
        <span>{text('61人候选池 · 自选48人 · 十二音级12组 · 8人复活 · 32强淘汰赛','61 candidates · Choose 48 · 12 pitch groups · Revive 8 · Round of 32')}</span>
      </footer>
      {showLegal && <LegalNotice onClose={() => setShowLegal(false)} />}
    </main>
  );
}


