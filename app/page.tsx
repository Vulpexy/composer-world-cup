'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Crown, Download, LoaderCircle, Medal, Music2, Pause, Play, RotateCcw, Shuffle, Sparkles, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { composers, type Composer, type Work } from '@/lib/composers';
import { createTournament, eliminatedComposers, GROUP_PITCHES, makeRound, restoreTournament, roundLabel, shuffledKnockoutEntrants, type TournamentState } from '@/lib/tournament';

const STORAGE_KEY = 'composer-world-cup-tournament-v2';
const PORTRAIT_CACHE_KEY = 'composer-world-cup-portraits-v1';
const AUDIO_CACHE_KEY = 'composer-world-cup-audio-sources-v1';
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const byId = new Map(composers.map((composer) => [composer.id, composer]));
const groupTitle=(index:number)=>`${GROUP_PITCHES[index]} 音级组`;

function readCache(key:string):Record<string,string>{try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return {}}}

function ComposerPortrait({composer}:{composer:Composer}){
  const [source,setSource]=useState(composer.portrait||'');
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    if(composer.portrait){setSource(composer.portrait);setFailed(false);return}
    const cache=readCache(PORTRAIT_CACHE_KEY);
    if(cache[composer.id]){setSource(cache[composer.id]);setFailed(false);return}
    setSource('');setFailed(false);
    fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=900&titles=${encodeURIComponent(composer.wikipediaSlug)}&format=json&origin=*`)
      .then((response)=>response.json()).then((data)=>{
        const pages=Object.values(data?.query?.pages||{}) as Array<{thumbnail?:{source?:string}}>;
        const portrait=pages[0]?.thumbnail?.source;if(!portrait)throw new Error('No portrait');
        if(!cancelled)setSource(portrait);localStorage.setItem(PORTRAIT_CACHE_KEY,JSON.stringify({...cache,[composer.id]:portrait}));
      }).catch(()=>{if(!cancelled)setFailed(true)});
    return()=>{cancelled=true};
  },[composer]);
  if(!source||failed)return <div className="portrait-fallback"><Music2/><span>{composer.nameZh.slice(0,2)}</span></div>;
  return <img src={source} alt={`${composer.nameZh}肖像`} className="portrait" onError={()=>setFailed(true)}/>;
}

type TrackSource={url:string;provider:'Wikimedia Commons'|'iTunes';detail:string;trackUrl?:string};
type AudioState={active:string|null;loading:string|null;error:string|null;errorDetail?:string;progress:number;sources:Record<string,TrackSource>};
type ItunesTrack={kind?:string;trackName?:string;collectionName?:string;artistName?:string;composerName?:string;primaryGenreName?:string;previewUrl?:string;trackViewUrl?:string};

const AUDIO_STOPWORDS=new Set(['the','and','for','from','major','minor','number','symphony','concerto','suite','opera','mass','quartet','first','second','third','movement','overture']);
const normalizeAudio=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const foldGermanAudio=(value:string)=>normalizeAudio(value).replace(/oe/g,'o').replace(/ae/g,'a').replace(/ue/g,'u');
const audioWords=(value:string)=>normalizeAudio(value).split(/\s+/).filter((word)=>word&&(word.length>1||/^\d+$/.test(word))&&!AUDIO_STOPWORDS.has(word));

function searchItunes(term:string,country='US'):Promise<ItunesTrack[]>{
  return new Promise((resolve,reject)=>{
    const callback=`composerCupItunes${Date.now()}${Math.random().toString(36).slice(2)}`;
    const target=window as unknown as Record<string,unknown>;
    const script=document.createElement('script');
    const cleanup=()=>{delete target[callback];script.remove();clearTimeout(timer)};
    const timer=setTimeout(()=>{cleanup();reject(new Error('iTunes search timed out'))},15000);
    target[callback]=(payload:{results?:ItunesTrack[]})=>{cleanup();resolve(payload.results||[])};
    script.onerror=()=>{cleanup();reject(new Error('iTunes search failed'))};
    script.src=`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&country=${country}&limit=35&callback=${callback}`;
    document.head.appendChild(script);
  });
}

async function resolveTrackSource(composer:Composer,work:Work):Promise<TrackSource>{
  if(work.audioFilename)return {url:`https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(work.audioFilename)}`,provider:'Wikimedia Commons',detail:[work.audioCredit,work.audioLicense].filter(Boolean).join(' · '),trackUrl:`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(work.audioFilename).replace(/%20/g,'_')}`};
  const query=`${composer.nameOriginal} ${work.audioQuery}`;
  const composerWords=audioWords(composer.nameOriginal).filter((word)=>word.length>3);
  const composerAliases=composerWords.length>2?composerWords.slice(-2):composerWords.slice(-1);
  const required=audioWords(work.audioQuery);
  let match:ItunesTrack|undefined;
  let searched=false;
  for(const country of ['US','DE','GB']){
    let results:ItunesTrack[]=[];try{results=await searchItunes(query,country)}catch{continue}
    searched=true;
    const ranked=results.filter((track)=>track.kind==='song'&&track.previewUrl).map((track)=>{
      const rawHaystack=normalizeAudio([track.trackName,track.collectionName,track.composerName,track.artistName].filter(Boolean).join(' '));
      const haystack=`${rawHaystack} ${foldGermanAudio(rawHaystack)}`;
      const matched=required.filter((word)=>haystack.includes(word)||haystack.includes(foldGermanAudio(word)));
      const aliasMatches=composerAliases.filter((alias)=>haystack.includes(alias)||haystack.includes(foldGermanAudio(alias))).length;
      const composerMatched=aliasMatches>0;
      const classical=/classical|opera/i.test(track.primaryGenreName||'')||composerMatched;
      return {track,matched,composerMatched,classical,score:aliasMatches*10+(classical?3:0)+matched.length*4};
    }).filter((item)=>item.composerMatched&&item.classical&&item.matched.length>=Math.max(1,Math.ceil(required.length*.45))).sort((left,right)=>right.score-left.score);
    match=ranked[0]?.track;if(match)break;
  }
  if(!match?.previewUrl)throw new Error(searched?'NO_MATCH':'NETWORK');
  return {url:match.previewUrl.replace(/^http:/,'https:'),provider:'iTunes',detail:[match.trackName,match.artistName].filter(Boolean).join(' · '),trackUrl:match.trackViewUrl};
}

function WorkList({composer,audio,onToggle,compact=false}:{composer:Composer;audio:AudioState;onToggle:(composer:Composer,work:Work,index:number)=>void;compact?:boolean}){
  return <section className={`works ${compact?'compact-works':''}`} aria-label={`${composer.nameZh}代表作`}><div className="section-label"><Music2/>代表作 · 30秒试听</div><ul>{composer.works.map((work,index)=>{
    const trackId=`${composer.id}:${index}`;const playing=audio.active===trackId;const loading=audio.loading===trackId;const failed=audio.error===trackId;const source=audio.sources[trackId];
    return <li key={trackId} className={playing?'is-playing':''}><span className="work-number">0{index+1}</span><div className="work-copy"><button className="work-title-button" onClick={()=>onToggle(composer,work,index)}><strong>{work.nameZh}</strong><small>{work.nameEn}</small></button>{failed&&<em>{audio.errorDetail||'暂未匹配到可用试听，可稍后重试'}</em>}{source&&<a className="audio-credit" href={source.trackUrl} target="_blank" rel="noreferrer">{source.provider} · {source.detail}</a>}</div><button className="play-button" onClick={()=>onToggle(composer,work,index)} disabled={loading} aria-label={`${playing?'暂停':'播放'}${work.nameZh}`}>{loading?<LoaderCircle className="spin"/>:playing?<Pause/>:<Play/>}</button>{playing&&<span className="track-progress" style={{'--track-progress':`${audio.progress*100}%`} as React.CSSProperties}/>}</li>})}</ul></section>;
}

function ComposerCard({composer,selected,audio,onToggleAudio,onPrepareAudio,onSelect}:{composer:Composer;selected:boolean;audio:AudioState;onToggleAudio:(composer:Composer,work:Work,index:number)=>void;onPrepareAudio:(composer:Composer)=>void;onSelect:()=>void}){
  const [showWorks,setShowWorks]=useState(false);
  const selectFromCard=(event:React.MouseEvent<HTMLElement>)=>{if((event.target as HTMLElement).closest('button,a'))return;onSelect()};
  const selectFromKeyboard=(event:React.KeyboardEvent<HTMLElement>)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect()}};
  return <article className={`composer-card ${selected?'is-selected':''} ${showWorks?'is-flipped':''}`} role="checkbox" aria-checked={selected} tabIndex={0} onClick={selectFromCard} onKeyDown={selectFromKeyboard}>
    <div className="mobile-card-content">
      <div className="mobile-card-front"><div className="mobile-portrait"><ComposerPortrait composer={composer}/>{selected&&<span className="mobile-selected-mark"><Check/></span>}</div><div className="mobile-summary"><p className="mobile-period">{composer.period}</p><h2 className={composer.nameZh.length>9?'long-name':''}>{composer.nameZh}</h2><p className="original-name">{composer.nameOriginal}</p><p className="mobile-region">{composer.years} · {composer.region}</p><p className="mobile-bio">{composer.bio}</p><button className="flip-card-button" onClick={()=>{setShowWorks(true);onPrepareAudio(composer)}}><Music2/>我想听听代表作</button></div></div>
      <div className="mobile-card-back"><header><h2 className={composer.nameZh.length>9?'long-name':''}>{composer.nameZh}</h2><small>{composer.nameOriginal}</small></header><WorkList composer={composer} audio={audio} onToggle={onToggleAudio} compact/><button className="flip-card-button back-button" onClick={()=>setShowWorks(false)}><RotateCcw/>返回简介</button></div>
    </div>
  </article>;
}

function DrawView({state,onRedraw,onStart}:{state:TournamentState;onRedraw:()=>void;onStart:()=>void}){
  return <section className="draw-view"><div className="stage-intro"><p className="kicker">GROUP DRAW · 12-TONE EQUAL TEMPERAMENT</p><h1>十二平均律小组抽签</h1><p>48位作曲家随机分为12组，每组对应十二平均律中的一个音级；每组4人同时比较，直接选出2人晋级。</p></div><div className="draw-actions"><Button variant="outline" onClick={onRedraw}><Shuffle/>重新抽签</Button><Button className="primary-action" onClick={onStart}>确认分组，开始选择<ChevronRight/></Button></div><div className="groups-grid">{state.groups.map((group,index)=><article className="group-card" key={GROUP_PITCHES[index]}><header><span>{GROUP_PITCHES[index]}</span><b>音级组</b></header><ol>{group.map((id,slot)=><li key={id}><b>{slot+1}</b><span>{byId.get(id)?.nameZh}</span><small>{byId.get(id)?.period}</small></li>)}</ol></article>)}</div></section>;
}

function GroupView({state,selected,onToggle,onConfirm,audio,onToggleAudio,onPrepareAudio}:{state:TournamentState;selected:string[];onToggle:(id:string)=>void;onConfirm:()=>void;audio:AudioState;onToggleAudio:(composer:Composer,work:Work,index:number)=>void;onPrepareAudio:(composer:Composer)=>void}){
  const group=state.groups[state.activeGroup].map((id)=>byId.get(id)!);
  return <section className="group-view"><div className="match-intro"><p className="kicker">{groupTitle(state.activeGroup)} · {state.activeGroup+1} / 12</p><h1>{GROUP_PITCHES[state.activeGroup]} 音级组 · 选择两位作曲家</h1><p>四人同时比较，可试听代表作；选满两位后确认晋级。</p></div><div className="four-grid">{group.map((composer)=><ComposerCard key={composer.id} composer={composer} selected={selected.includes(composer.id)} audio={audio} onToggleAudio={onToggleAudio} onPrepareAudio={onPrepareAudio} onSelect={()=>onToggle(composer.id)}/>)}</div><div className="group-confirm"><span>已选择 <b>{selected.length}</b> / 2</span><Button className="primary-action" onClick={onConfirm} disabled={selected.length!==2}>确认本组晋级<ChevronRight/></Button></div></section>;
}

function RepechageCard({composer,selected,audio,onToggleAudio,onPrepareAudio,onSelect}:{composer:Composer;selected:boolean;audio:AudioState;onToggleAudio:(composer:Composer,work:Work,index:number)=>void;onPrepareAudio:(composer:Composer)=>void;onSelect:()=>void}){
  return <ComposerCard composer={composer} selected={selected} audio={audio} onToggleAudio={onToggleAudio} onPrepareAudio={onPrepareAudio} onSelect={onSelect}/>;
}

function RepechageView({state,selected,onToggle,onConfirm,audio,onToggleAudio,onPrepareAudio}:{state:TournamentState;selected:string[];onToggle:(id:string)=>void;onConfirm:()=>void;audio:AudioState;onToggleAudio:(composer:Composer,work:Work,index:number)=>void;onPrepareAudio:(composer:Composer)=>void}){
  const eliminated=eliminatedComposers(state).map((id)=>byId.get(id)!);
  return <section className="repechage-view"><div className="stage-intro"><p className="kicker">REPECHAGE · 24 COMPOSERS</p><h1>从24位淘汰者中复活8位</h1><p>点击卡片直接选择；翻到背面可试听代表作。</p></div><div className="selection-status sticky-selection"><span>已选择 <b>{selected.length}</b> / 8</span><Button className="primary-action" disabled={selected.length!==8} onClick={onConfirm}>确认8位复活<ChevronRight/></Button></div><div className="repechage-grid">{eliminated.map((composer)=><RepechageCard key={composer.id} composer={composer} selected={selected.includes(composer.id)} audio={audio} onToggleAudio={onToggleAudio} onPrepareAudio={onPrepareAudio} onSelect={()=>onToggle(composer.id)}/>)}</div></section>;
}

function FinishedView({state,onReset,onStart}:{state:TournamentState;onReset:()=>void;onStart:()=>void}){
  const revived=state.repechagePicks;
  return <section className="finished-view"><div className="result-icon"><Sparkles/></div><p className="kicker">ROUND OF 32 · READY</p><h1>32强名单已经产生</h1><p>24位小组直接晋级者与8位复活者，将随机落位，进入固定签表的单场淘汰赛。</p><div className="knockout-launch"><Button className="primary-action" onClick={onStart}><Swords/>抽取32强对阵<ChevronRight/></Button><small>抽签后每轮不再重新排列，胜者沿同一签表路径晋级。</small></div><h2>小组直接晋级 · 24人</h2><div className="qualifiers-grid">{state.groups.map((_,index)=><article key={index}><header>{groupTitle(index)}</header>{state.groupPicks[index].map((id,rank)=><div key={id}><span>{rank+1}</span><strong>{byId.get(id)?.nameZh}</strong></div>)}</article>)}</div><h2>复活晋级 · 8人</h2><div className="revived-grid">{revived.map((id)=><span key={id}><Sparkles/><strong>{byId.get(id)?.nameZh}</strong></span>)}</div><Button variant="outline" onClick={onReset}><RotateCcw/>重新开始一届比赛</Button></section>;
}

function KnockoutCard({composer,audio,onToggleAudio,onPrepareAudio,onChoose}:{composer:Composer;audio:AudioState;onToggleAudio:(composer:Composer,work:Work,index:number)=>void;onPrepareAudio:(composer:Composer)=>void;onChoose:()=>void}){
  return <ComposerCard composer={composer} selected={false} audio={audio} onToggleAudio={onToggleAudio} onPrepareAudio={onPrepareAudio} onSelect={onChoose}/>;
}

function KnockoutView({state,audio,onToggleAudio,onPrepareAudio,onChoose,onBack}:{state:TournamentState;audio:AudioState;onToggleAudio:(composer:Composer,work:Work,index:number)=>void;onPrepareAudio:(composer:Composer)=>void;onChoose:(id:string)=>void;onBack:()=>void}){
  const knockout=state.knockout!;const round=knockout.rounds[knockout.currentRound];const match=round.matches[knockout.currentMatch];const a=byId.get(match.a)!;const b=byId.get(match.b)!;const completed=round.matches.filter((item)=>item.winner).length;
  return <section className="knockout-view"><div className="knockout-head"><div><p className="kicker">KNOCKOUT · {roundLabel(round.entrants.length)}</p><h1>{roundLabel(round.entrants.length)}</h1><p>本轮第 {knockout.currentMatch+1} / {round.matches.length} 场 · 点击卡片晋级，翻到背面可试听。</p></div><div className="knockout-tools"><Button variant="outline" size="sm" onClick={onBack} disabled={knockout.currentRound===0&&knockout.currentMatch===0}><ArrowLeft/>回到上一步</Button><div className="round-meter"><span>{completed}/{round.matches.length}</span><i><b style={{width:`${completed/round.matches.length*100}%`}}/></i></div></div></div><div className="knockout-match-grid"><KnockoutCard composer={a} audio={audio} onToggleAudio={onToggleAudio} onPrepareAudio={onPrepareAudio} onChoose={()=>onChoose(a.id)}/><div className="knockout-vs">VS</div><KnockoutCard composer={b} audio={audio} onToggleAudio={onToggleAudio} onPrepareAudio={onPrepareAudio} onChoose={()=>onChoose(b.id)}/></div></section>;
}

function RoundTransitionView({state,onContinue,onBack}:{state:TournamentState;onContinue:()=>void;onBack:()=>void}){
  const knockout=state.knockout!;const round=knockout.rounds[knockout.currentRound];const winners=round.matches.map((match)=>match.winner!).filter(Boolean);const winnerIds=new Set(winners);const eliminated=round.entrants.filter((id)=>!winnerIds.has(id));const final=winners.length===1;
  return <section className="round-transition"><div className={`transition-seal ${final?'champion-seal':''}`}>{final?<Crown/>:<ChevronRight/>}</div><p className="kicker">{roundLabel(round.entrants.length)} · COMPLETE</p><h1>{final?`${byId.get(winners[0])?.nameZh} 赢得决赛`:`${winners.length}位作曲家晋级${roundLabel(winners.length)}`}</h1><p>{final?'冠军已经产生，进入最终结果页查看完整晋级路径。':'本轮签表已经锁定，晋级者将沿原有位置进入下一轮。'}</p><div className="transition-columns"><section><h2>晋级 · {winners.length}人</h2><div>{winners.map((id)=><span key={id}><Check/><strong>{byId.get(id)?.nameZh}</strong></span>)}</div></section><section><h2>止步本轮 · {eliminated.length}人</h2><div>{eliminated.map((id)=><span key={id}><small>—</small>{byId.get(id)?.nameZh}</span>)}</div></section></div><div className="transition-actions"><Button variant="outline" onClick={onBack}><ArrowLeft/>修改最后一场</Button><Button className="primary-action transition-next" onClick={onContinue}>{final?'查看最终结果':`进入${roundLabel(winners.length)}`}<ChevronRight/></Button></div></section>;
}

function ResultBracket({state}:{state:TournamentState}){
  const rounds=state.knockout!.rounds;const rootRef=useRef<HTMLDivElement|null>(null);const [connections,setConnections]=useState<{width:number;height:number;paths:string[]}>({width:0,height:0,paths:[]});
  useEffect(()=>{const root=rootRef.current;if(!root)return;const draw=()=>{const rootBox=root.getBoundingClientRect();const paths:string[]=[];rounds.slice(0,-1).forEach((round,roundIndex)=>round.matches.forEach((match,matchIndex)=>{if(!match.winner)return;const nextIndex=rounds[roundIndex+1].matches.findIndex((next)=>next.a===match.winner||next.b===match.winner);if(nextIndex<0)return;const start=root.querySelector<HTMLElement>(`[data-round="${roundIndex}"][data-match="${matchIndex}"]`);const end=root.querySelector<HTMLElement>(`[data-round="${roundIndex+1}"][data-match="${nextIndex}"]`);if(!start||!end)return;const a=start.getBoundingClientRect();const b=end.getBoundingClientRect();const x1=a.right-rootBox.left;const y1=a.top+a.height/2-rootBox.top;const x2=b.left-rootBox.left;const y2=b.top+b.height/2-rootBox.top;const mid=(x1+x2)/2;paths.push(`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`)}));setConnections({width:root.scrollWidth,height:root.scrollHeight,paths})};const frame=requestAnimationFrame(()=>requestAnimationFrame(draw));const observer=new ResizeObserver(draw);observer.observe(root);return()=>{cancelAnimationFrame(frame);observer.disconnect()}},[rounds]);
  return <div className="bracket-scroll"><div className="result-bracket" ref={rootRef}><svg className="bracket-connections" width={connections.width} height={connections.height} viewBox={`0 0 ${connections.width} ${connections.height}`} aria-hidden="true">{connections.paths.map((path,index)=><path d={path} key={index}/>)}</svg>{rounds.map((round,index)=><section className="bracket-round" key={index}><header>{roundLabel(round.entrants.length)}<small>{round.matches.length}场</small></header><div>{round.matches.map((match,matchIndex)=><article key={matchIndex} data-round={index} data-match={matchIndex}><span className={match.winner===match.a?'advanced':''}>{byId.get(match.a)?.nameZh}{match.winner===match.a&&<Check/>}</span><span className={match.winner===match.b?'advanced':''}>{byId.get(match.b)?.nameZh}{match.winner===match.b&&<Check/>}</span></article>)}</div></section>)}</div></div>;
}

function downloadResultImage(state:TournamentState){
  const rounds=state.knockout!.rounds;const final=rounds.at(-1)!.matches[0];const champion=byId.get(state.champion!)!;const runnerUp=byId.get(final.a===state.champion?final.b:final.a)!;const scale=2;const canvas=document.createElement('canvas');canvas.width=1900*scale;canvas.height=1250*scale;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.scale(scale,scale);
  ctx.fillStyle='#f3eee5';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#2e1018';ctx.fillRect(0,0,canvas.width,150);ctx.textAlign='center';ctx.fillStyle='#d7b66d';ctx.font='700 22px Microsoft YaHei, sans-serif';ctx.fillText('COMPOSER WORLD CUP · FINAL RESULT',950,48);ctx.fillStyle='#fff8eb';ctx.font='700 48px Microsoft YaHei, sans-serif';ctx.fillText(`${champion.nameZh} · 冠军`,950,108);ctx.fillStyle='#6d5642';ctx.font='18px Microsoft YaHei, sans-serif';ctx.fillText(`亚军 ${runnerUp.nameZh} · 48位作曲家 · 十二平均律小组赛 · 32强淘汰赛`,950,184);
  const top=245;const areaHeight=900;const columnWidth=320;const gap=48;const left=36;const matchCenter=(roundIndex:number,matchIndex:number)=>{const round=rounds[roundIndex];const slot=areaHeight/round.matches.length;return top+matchIndex*slot+slot/2};ctx.strokeStyle='#b49262';ctx.lineWidth=2;rounds.slice(0,-1).forEach((round,roundIndex)=>round.matches.forEach((match,matchIndex)=>{if(!match.winner)return;const nextIndex=rounds[roundIndex+1].matches.findIndex((next)=>next.a===match.winner||next.b===match.winner);if(nextIndex<0)return;const x1=left+roundIndex*(columnWidth+gap)+columnWidth;const x2=left+(roundIndex+1)*(columnWidth+gap);const mid=(x1+x2)/2;const y1=matchCenter(roundIndex,matchIndex);const y2=matchCenter(roundIndex+1,nextIndex);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(mid,y1);ctx.lineTo(mid,y2);ctx.lineTo(x2,y2);ctx.stroke()}));rounds.forEach((round,roundIndex)=>{const x=left+roundIndex*(columnWidth+gap);ctx.fillStyle='#641d2d';ctx.fillRect(x,top-42,columnWidth,34);ctx.fillStyle='#fff8eb';ctx.font='700 16px Microsoft YaHei, sans-serif';ctx.fillText(roundLabel(round.entrants.length),x+columnWidth/2,top-19);const slot=areaHeight/round.matches.length;round.matches.forEach((match,index)=>{const y=top+index*slot+Math.max(0,(slot-46)/2);ctx.fillStyle='#fffdf8';ctx.strokeStyle='#cfbea8';ctx.lineWidth=1;ctx.fillRect(x,y,columnWidth,44);ctx.strokeRect(x,y,columnWidth,44);[match.a,match.b].forEach((id,row)=>{ctx.fillStyle=match.winner===id?'#641d2d':'#766a60';ctx.font=`${match.winner===id?'700':'400'} 14px Microsoft YaHei, sans-serif`;ctx.textAlign='left';ctx.fillText(`${match.winner===id?'✓ ':''}${byId.get(id)?.nameZh||''}`,x+10,y+17+row*18)});});});ctx.textAlign='center';ctx.fillStyle='#8c7e70';ctx.font='13px Microsoft YaHei, sans-serif';ctx.fillText('由“古典音乐作曲家世界杯”生成',950,1212);
  canvas.toBlob((blob)=>{if(!blob)return;const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`作曲家世界杯-${champion.nameZh}-冠军.png`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)},'image/png');
}

function FinalResultView({state,onReset,onDownload}:{state:TournamentState;onReset:()=>void;onDownload:()=>void}){
  const rounds=state.knockout!.rounds;const final=rounds.at(-1)!.matches[0];const champion=byId.get(state.champion!)!;const runnerUp=byId.get(final.a===state.champion?final.b:final.a)!;const semifinal=rounds.find((round)=>round.entrants.length===4)!.entrants.filter((id)=>id!==champion.id&&id!==runnerUp.id).map((id)=>byId.get(id)!);
  return <section className="final-result"><div className="champion-hero"><div className="champion-crown"><Crown/></div><div className="champion-image"><ComposerPortrait composer={champion}/></div><p className="kicker">COMPOSER WORLD CUP · CHAMPION</p><h1>{champion.nameZh}</h1><p className="champion-original">{champion.nameOriginal}</p><p>{champion.bio}</p></div><div className="podium"><article className="podium-champion"><Crown/><small>冠军</small><strong>{champion.nameZh}</strong></article><article><Medal/><small>亚军</small><strong>{runnerUp.nameZh}</strong></article>{semifinal.map((composer)=><article key={composer.id}><Sparkles/><small>四强</small><strong>{composer.nameZh}</strong></article>)}</div><section className="complete-bracket"><div className="bracket-title"><div><p className="kicker">FULL BRACKET</p><h2>淘汰赛完整对阵</h2></div><span>左右滑动查看完整签表</span></div><ResultBracket state={state}/></section><div className="result-actions"><Button className="primary-action" onClick={onDownload}><Download/>下载结果图片</Button><Button variant="outline" onClick={onReset}><RotateCcw/>重新开始一届比赛</Button></div></section>;
}

export default function Home(){
  const [state,setState]=useState<TournamentState|null>(null);const [selected,setSelected]=useState<string[]>([]);const [audio,setAudio]=useState<AudioState>({active:null,loading:null,error:null,progress:0,sources:{}});
  const audioRef=useRef<HTMLAudioElement|null>(null);const fadeTimerRef=useRef<ReturnType<typeof setInterval>|null>(null);
  useEffect(()=>{try{const saved=restoreTournament(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'));setState(saved||createTournament());const cached=JSON.parse(localStorage.getItem(AUDIO_CACHE_KEY)||'{}');setAudio((value)=>({...value,sources:cached}))}catch{setState(createTournament())}return()=>{audioRef.current?.pause();if(fadeTimerRef.current)clearInterval(fadeTimerRef.current)}},[]);
  useEffect(()=>{if(state)localStorage.setItem(STORAGE_KEY,JSON.stringify(state))},[state]);
  useEffect(()=>{if(Object.keys(audio.sources).length)localStorage.setItem(AUDIO_CACHE_KEY,JSON.stringify(audio.sources))},[audio.sources]);
  useEffect(()=>{if(state?.phase==='group-selection')setSelected(state.groupPicks[state.activeGroup]||[]);if(state?.phase==='repechage')setSelected(state.repechagePicks)},[state?.phase,state?.activeGroup]);
  const progress=useMemo(()=>{if(!state)return 0;if(state.phase==='result')return 100;const knockoutWins=state.knockout?.rounds.flatMap((round)=>round.matches).filter((match)=>match.winner).length||0;if(state.knockout)return Math.round(75+knockoutWins/31*25);return Math.round((state.groupPicks.length/12)*65+(state.repechagePicks.length/8)*10)},[state]);
  const stopAudio=()=>{audioRef.current?.pause();audioRef.current=null;if(fadeTimerRef.current)clearInterval(fadeTimerRef.current);fadeTimerRef.current=null;setAudio((value)=>({...value,active:null,loading:null,progress:0}))};
  const prepareComposerAudio=async(composer:Composer)=>{const pending=composer.works.map(async(work,index)=>{const trackId=`${composer.id}:${index}`;if(audio.sources[trackId])return null;try{return {trackId,source:await resolveTrackSource(composer,work)}}catch{return null}});const prepared=(await Promise.all(pending)).filter((item):item is {trackId:string;source:TrackSource}=>Boolean(item));if(prepared.length)setAudio((value)=>({...value,sources:{...value.sources,...Object.fromEntries(prepared.map((item)=>[item.trackId,item.source]))}}))};
  const toggleAudio=async(composer:Composer,work:Work,index:number)=>{
    const trackId=`${composer.id}:${index}`;
    if(audio.active===trackId&&audioRef.current&&!audioRef.current.paused){stopAudio();return}
    stopAudio();setAudio((value)=>({...value,active:null,loading:trackId,error:null,errorDetail:undefined,progress:0}));const cached=audio.sources[trackId];const player=new Audio(cached?.url||SILENT_WAV);audioRef.current=player;player.preload='auto';player.volume=cached?1:0;const unlock=cached?Promise.resolve():player.play().catch(()=>undefined);
    try{const source=cached||await resolveTrackSource(composer,work);await unlock;if(!cached){player.pause();player.src=source.url;player.volume=1;player.load()}setAudio((value)=>({...value,sources:{...value.sources,[trackId]:source}}));
      player.ontimeupdate=()=>setAudio((value)=>({...value,progress:Math.min(player.currentTime,30)/30}));player.onended=()=>stopAudio();player.onerror=()=>{stopAudio();setAudio((value)=>({...value,active:null,loading:null,error:trackId,progress:0}))};
      await player.play();setAudio((value)=>({...value,active:trackId,loading:null,error:null,progress:0,sources:{...value.sources,[trackId]:source}}));fadeTimerRef.current=setInterval(()=>{if(player.paused)return;const time=player.currentTime;if(time>=27)player.volume=Math.max(0,Math.min(1,(30-time)/3));if(time>=30){player.pause();player.currentTime=0;stopAudio()}},50);
    }catch(error){stopAudio();const detail=error instanceof DOMException&&error.name==='NotAllowedError'?'浏览器阻止播放，请再次点击播放':error instanceof Error&&error.message==='NETWORK'?'网络无法连接试听目录':error instanceof Error&&error.message==='NO_MATCH'?'未找到与该作品相符的试听':'当前地区或音频地址不可用';setAudio((value)=>({...value,active:null,loading:null,error:trackId,errorDetail:detail,progress:0}))}
  };
  const togglePick=(id:string,limit:number)=>setSelected((current)=>current.includes(id)?current.filter((item)=>item!==id):current.length<limit?[...current,id]:current);
  const confirmGroup=()=>{if(!state||selected.length!==2)return;stopAudio();const picks=[...state.groupPicks];picks[state.activeGroup]=selected;if(state.activeGroup===11){setState({...state,phase:'repechage',groupPicks:picks,repechagePicks:[]});setSelected([])}else{setState({...state,activeGroup:state.activeGroup+1,groupPicks:picks});setSelected([])}window.scrollTo({top:0,behavior:'smooth'})};
  const confirmRepechage=()=>{if(!state||selected.length!==8)return;stopAudio();setState({...state,phase:'finished',repechagePicks:selected});window.scrollTo({top:0,behavior:'smooth'})};
  const startKnockout=()=>{if(!state)return;stopAudio();const entrants=shuffledKnockoutEntrants(state);setState({...state,phase:'knockout',knockout:{rounds:[makeRound(entrants)],currentRound:0,currentMatch:0},champion:undefined});window.scrollTo({top:0,behavior:'smooth'})};
  const chooseKnockoutWinner=(id:string)=>{if(!state?.knockout||state.phase!=='knockout')return;stopAudio();const knockout={...state.knockout,rounds:state.knockout.rounds.map((round)=>({...round,matches:round.matches.map((match)=>({...match}))}))};const round=knockout.rounds[knockout.currentRound];const match=round.matches[knockout.currentMatch];if(id!==match.a&&id!==match.b)return;match.winner=id;const next=round.matches.findIndex((item)=>!item.winner);if(next===-1)setState({...state,phase:'round-transition',knockout});else{knockout.currentMatch=next;setState({...state,knockout})}window.scrollTo({top:0,behavior:'smooth'})};
  const undoKnockoutMatch=()=>{if(!state?.knockout)return;stopAudio();const knockout={...state.knockout,rounds:state.knockout.rounds.map((round)=>({...round,matches:round.matches.map((match)=>({...match}))}))};let round=knockout.rounds[knockout.currentRound];if(state.phase==='knockout'&&knockout.currentMatch===0&&knockout.currentRound>0){knockout.rounds.pop();knockout.currentRound-=1;round=knockout.rounds[knockout.currentRound];const target=round.matches.length-1;round.matches[target].winner=undefined;knockout.currentMatch=target}else{const target=state.phase==='round-transition'?round.matches.length-1:knockout.currentMatch-1;if(target<0)return;round.matches[target].winner=undefined;knockout.currentMatch=target}setState({...state,phase:'knockout',knockout,champion:undefined});window.scrollTo({top:0,behavior:'smooth'})};
  const continueKnockout=()=>{if(!state?.knockout)return;const knockout={...state.knockout,rounds:[...state.knockout.rounds]};const round=knockout.rounds[knockout.currentRound];const winners=round.matches.map((match)=>match.winner!).filter(Boolean);if(winners.length===1){setState({...state,phase:'result',champion:winners[0],knockout});window.scrollTo({top:0,behavior:'smooth'});return}knockout.rounds.push(makeRound(winners));knockout.currentRound+=1;knockout.currentMatch=0;setState({...state,phase:'knockout',knockout});window.scrollTo({top:0,behavior:'smooth'})};
  const reset=()=>{stopAudio();setSelected([]);setState(createTournament())};
  if(!state)return <main className="loading-screen"><LoaderCircle className="spin"/><span>正在准备48人名单…</span></main>;
  const stageText=state.phase==='draw'?'等待抽签':state.phase==='group-selection'?`${groupTitle(state.activeGroup)} · 已完成${state.groupPicks.length}/12组`:state.phase==='repechage'?'复活赛 · 选择8人':state.phase==='finished'?'32强待抽签':state.phase==='knockout'&&state.knockout?`${roundLabel(state.knockout.rounds[state.knockout.currentRound].entrants.length)} · 第${state.knockout.currentMatch+1}场`:state.phase==='round-transition'?'本轮完成':'冠军已经产生';
  return <main className="site-shell"><header className="topbar"><a className="brand" href="#top"><span className="brand-mark"><Music2/></span><span><strong>作曲家世界杯</strong><small>COMPOSER WORLD CUP</small></span></a><div className="stage-progress"><span>{stageText}</span><i><b style={{width:`${progress}%`}}/></i></div>{state.phase!=='draw'&&state.phase!=='result'?<Button variant="ghost" size="sm" onClick={reset}><RotateCcw/>重新开始</Button>:<span/>}</header><div id="top">{state.phase==='draw'&&<DrawView state={state} onRedraw={()=>setState(createTournament())} onStart={()=>setState({...state,phase:'group-selection'})}/>} {state.phase==='group-selection'&&<GroupView state={state} selected={selected} onToggle={(id)=>togglePick(id,2)} onConfirm={confirmGroup} audio={audio} onToggleAudio={toggleAudio} onPrepareAudio={prepareComposerAudio}/>} {state.phase==='repechage'&&<RepechageView state={state} selected={selected} onToggle={(id)=>togglePick(id,8)} onConfirm={confirmRepechage} audio={audio} onToggleAudio={toggleAudio} onPrepareAudio={prepareComposerAudio}/>} {state.phase==='finished'&&<FinishedView state={state} onReset={reset} onStart={startKnockout}/>} {state.phase==='knockout'&&<KnockoutView state={state} audio={audio} onToggleAudio={toggleAudio} onPrepareAudio={prepareComposerAudio} onChoose={chooseKnockoutWinner} onBack={undoKnockoutMatch}/>} {state.phase==='round-transition'&&<RoundTransitionView state={state} onContinue={continueKnockout} onBack={undoKnockoutMatch}/>} {state.phase==='result'&&<FinalResultView state={state} onReset={reset} onDownload={()=>downloadResultImage(state)}/>}</div><footer><span className="footer-music"><Music2/>肖像来自 Wikipedia · 试听由 Wikimedia Commons 与 iTunes 提供</span><span>十二平均律12组 · 8人复活 · 32强固定签表 · 决出最终冠军</span></footer></main>;
}

