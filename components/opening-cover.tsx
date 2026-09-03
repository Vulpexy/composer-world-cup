'use client';

import { Music2 } from 'lucide-react';

const steps = [['01','选择48人','组建阵容'],['02','十二音级小组赛','每组四进二'],['03','复活8人','遗珠返场'],['04','32强淘汰赛','两两对决'],['05','冠军','生成结果图']];

export function OpeningCover({ onStart }: { onStart: () => void }) {
  const notes = [[190,84],[238,70],[315,63],[365,56],[445,77],[590,91],[645,77],[720,63],[775,49],[875,70],[980,84],[1035,70],[1145,56],[1200,63],[1300,77]];
  return <section className="opening-cover" aria-labelledby="opening-title">
    <svg className="opening-score" viewBox="0 0 1440 150" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M0 42H1440M0 56H1440M0 70H1440M0 84H1440M0 98H1440"/><path d="M270 42V98M540 42V98M810 42V98M1080 42V98M1350 42V98" strokeWidth="2"/></g><g fill="currentColor"><text x="35" y="103" fontFamily="Bravura, Segoe UI Symbol, serif" fontSize="83">𝄞</text><text x="135" y="72" fontFamily="Georgia,serif" fontSize="27">3</text><text x="135" y="99" fontFamily="Georgia,serif" fontSize="27">4</text>{notes.map(([x,y])=><g key={x}><ellipse cx={x} cy={y} rx="10" ry="7" transform={`rotate(-18 ${x} ${y})`}/><path d={`M${x+9} ${y-2}V${Math.max(17,y-50)}H${x+12}V${y-2}Z`}/></g>)}</g></svg>
    <header className="opening-header"><img src="./musicup-logo-web.png" alt="大师对位 MusiCup"/><div><strong>COMPOSER WORLD CUP</strong><span>古典作曲家世界杯</span></div></header>
    <div className="opening-main"><div className="opening-copy"><p className="opening-kicker">LISTEN · CHOOSE · DISCOVER</p><h1 id="opening-title">让耳朵<br/>决定<span>冠军</span></h1><p className="opening-intro">试听代表作，从61位候选人中组成你的48人阵容。<br/><b>跨越时代与流派，选出属于你的作曲家冠军。</b></p></div><div className="opening-disc" aria-hidden="true"><span className="opening-orbit orbit-bach">巴赫</span><span className="opening-orbit orbit-rach">拉赫玛尼诺夫</span><span className="opening-orbit orbit-debussy">德彪西</span><span className="opening-orbit orbit-tchaikovsky">柴可夫斯基</span><span className="opening-orbit orbit-beethoven">贝多芬</span><div><Music2/></div></div></div>
    <div className="opening-flow" aria-label="赛事流程"><p>TOURNAMENT SCORE · 赛事流程</p><ol>{steps.map(([number,title,detail],index)=><li key={number}><span>{number}</span><div><b>{title}</b><small>{detail}</small></div>{index<steps.length-1&&<i>→</i>}</li>)}</ol></div>
    <div className="opening-action"><button type="button" onClick={onStart}><Music2/>进入序曲</button><small>免费游玩 · 进度自动保存</small></div>
  </section>;
}
