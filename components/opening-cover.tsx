'use client';

import { Music2 } from 'lucide-react';
import { LanguageSwitch } from './language-switch';
import { useLanguage } from '@/lib/i18n';

export function OpeningCover({ onStart }: { onStart: () => void }) {
  const { language, text } = useLanguage();
  const steps = language === 'zh'
    ? [['01','选择48人','组建阵容'],['02','十二音级小组赛','每组四进二'],['03','复活8人','遗珠返场'],['04','32强淘汰赛','两两对决'],['05','冠军','生成结果图']]
    : [['01','Choose 48','Build the field'],['02','12 pitch groups','Choose 2 of 4'],['03','Revive 8','Second chance'],['04','Round of 32','Head to head'],['05','Champion','Download result']];
  const notes = [[190,84],[238,70],[315,63],[365,56],[445,77],[590,91],[645,77],[720,63],[775,49],[875,70],[980,84],[1035,70],[1145,56],[1200,63],[1300,77]];
  return <section className="opening-cover" aria-labelledby="opening-title">
    <svg className="opening-score" viewBox="0 0 1440 150" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M0 42H1440M0 56H1440M0 70H1440M0 84H1440M0 98H1440"/><path d="M270 42V98M540 42V98M810 42V98M1080 42V98M1350 42V98" strokeWidth="2"/></g><g fill="currentColor"><text x="35" y="103" fontFamily="Bravura, Segoe UI Symbol, serif" fontSize="83">𝄞</text><text x="135" y="72" fontFamily="Georgia,serif" fontSize="27">3</text><text x="135" y="99" fontFamily="Georgia,serif" fontSize="27">4</text>{notes.map(([x,y])=><g key={x}><ellipse cx={x} cy={y} rx="10" ry="7" transform={`rotate(-18 ${x} ${y})`}/><path d={`M${x+9} ${y-2}V${Math.max(17,y-50)}H${x+12}V${y-2}Z`}/></g>)}</g></svg>
    <header className="opening-header"><img src="./musicup-logo-web.png" alt="大师对位 MusiCup"/><div><strong>COMPOSER WORLD CUP</strong><span>{text('古典作曲家世界杯','Classical Composer World Cup')}</span></div><LanguageSwitch compact /></header>
    <div className="opening-main"><div className="opening-copy"><p className="opening-kicker">LISTEN · CHOOSE · DISCOVER</p><h1 id="opening-title">{language === 'zh' ? <>让耳朵<br/>决定<span>冠军</span></> : <>LET YOUR EARS<br/>CROWN THE <span>CHAMPION</span></>}</h1><p className="opening-intro">{text('试听代表作，从61位候选人中组成你的48人阵容。','Hear signature works and build your field of 48 from 61 composers.')}<br/><b>{text('跨越时代与流派，选出属于你的作曲家冠军。','Cross eras and styles to choose your own composer champion.')}</b></p></div><div className="opening-disc" aria-hidden="true"><span className="opening-orbit orbit-bach">{text('巴赫','Bach')}</span><span className="opening-orbit orbit-rach">{text('拉赫玛尼诺夫','Rachmaninoff')}</span><span className="opening-orbit orbit-debussy">{text('德彪西','Debussy')}</span><span className="opening-orbit orbit-tchaikovsky">{text('柴可夫斯基','Tchaikovsky')}</span><span className="opening-orbit orbit-beethoven">{text('贝多芬','Beethoven')}</span><div><Music2/></div></div></div>
    <div className="opening-flow" aria-label={text('赛事流程','Tournament format')}><p>TOURNAMENT SCORE · {text('赛事流程','FORMAT')}</p><ol>{steps.map(([number,title,detail],index)=><li key={number}><span>{number}</span><div><b>{title}</b><small>{detail}</small></div>{index<steps.length-1&&<i>→</i>}</li>)}</ol></div>
    <div className="opening-action"><button type="button" onClick={onStart}><Music2/>{text('进入序曲','Begin the Overture')}</button><small>{text('免费游玩 · 进度自动保存','Free to play · Progress saves automatically')}</small></div>
  </section>;
}

