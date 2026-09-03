import { readFile, writeFile } from 'node:fs/promises';

const composerSource = await readFile(new URL('../lib/composers.ts',import.meta.url),'utf8');
const composerExpression = composerSource
  .replace(/^export type .*$/gm,'')
  .replace('export const composers:Composer[] =','return')
  .replace(/^export const /gm,'const ');
const composers = Function(composerExpression)();

const stopwords = new Set(['the','and','for','from','major','minor','no','op','rv','in','of','a','an','suite','symphony','concerto','opera','mass','quartet']);
const normalize = (value='') => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const words = (value='') => normalize(value).split(/\s+/).filter((word) => word && (word.length > 1 || /^\d+$/.test(word)) && !stopwords.has(word));

async function search(term, country) {
  const url = new URL('https://itunes.apple.com/search');
  Object.entries({term, media:'music', entity:'song', country, limit:'35'}).forEach(([key,value]) => url.searchParams.set(key,value));
  const response = await fetch(url, {signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()).results || [];
}

async function resolve(composer, work, index) {
  if (work.audioFilename) return {
    url:`https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(work.audioFilename)}`,
    provider:'Wikimedia Commons',
    detail:[work.audioCredit,work.audioLicense].filter(Boolean).join(' · '),
    trackUrl:`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(work.audioFilename).replace(/%20/g,'_')}`,
  };
  const query = `${composer.nameOriginal} ${work.audioQuery}`;
  const composerWords = words(composer.nameOriginal).filter((word) => word.length > 3);
  const aliases = composerWords.length > 2 ? composerWords.slice(-2) : composerWords.slice(-1);
  const required = words(work.audioQuery);
  for (const country of ['US','DE','GB']) {
    let results;
    try { results = await search(query,country); } catch { continue; }
    const ranked = results.filter((track) => track.kind === 'song' && track.previewUrl).map((track) => {
      const haystack = normalize([track.trackName,track.collectionName,track.composerName,track.artistName].filter(Boolean).join(' '));
      const matched = required.filter((word) => haystack.includes(word));
      const aliasMatches = aliases.filter((word) => haystack.includes(word)).length;
      const classical = /classical|opera/i.test(track.primaryGenreName || '') || aliasMatches > 0;
      const penalty = (haystack.match(/guitar|ukulele|cover|remix|karaoke|tribute|arrangement|transcription/g) || []).length;
      const bonus = /piano|violin|cello|orchestra|quartet|choir|opera/.test(haystack) ? 2 : 0;
      return {track,score:aliasMatches*10+(classical?3:0)+matched.length*4+bonus-penalty*18,matched,aliasMatches,classical};
    }).filter((item) =>
      item.classical &&
      item.matched.length >= Math.max(1,Math.ceil(required.length*.45)) &&
      (item.aliasMatches > 0 || item.matched.length >= Math.max(2,Math.ceil(required.length*.6)))
    ).sort((a,b) => b.score-a.score);
    const track = ranked[0]?.track;
    if (track) return {url:track.previewUrl.replace(/^http:/,'https:'),provider:'iTunes',detail:[track.trackName,track.artistName].filter(Boolean).join(' · '),trackUrl:track.trackViewUrl};
  }
  return null;
}

const tasks = composers.flatMap((composer) => composer.works.map((work,index) => ({composer,work,index})));
const catalog = {};
for (let offset=0; offset<tasks.length; offset+=8) {
  const batch = tasks.slice(offset,offset+8);
  const rows = await Promise.all(batch.map(async ({composer,work,index}) => [
    `${composer.id}:${index}`,
    await resolve(composer,work,index),
  ]));
  for (const [key,value] of rows) if (value) catalog[key]=value;
  process.stdout.write(`\rResolved ${Math.min(offset+8,tasks.length)}/${tasks.length}`);
}
await writeFile(new URL('../public/audio-catalog.json',import.meta.url),JSON.stringify(catalog,null,2));
await writeFile(
  new URL('../lib/audio-catalog.ts',import.meta.url),
  `export const AUDIO_CATALOG = ${JSON.stringify(catalog,null,2)} as const;\n`,
);
console.log(`\nSaved ${Object.keys(catalog).length}/${tasks.length} sources`);
