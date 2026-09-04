'use client';

import { X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

export function LegalNotice({ onClose }: { onClose: () => void }) {
  const { language, text } = useLanguage();
  return (
    <div className="legal-overlay" role="dialog" aria-modal="true" aria-labelledby="legal-title" onClick={onClose}>
      <article className="legal-panel" onClick={(event) => event.stopPropagation()}>
        <button className="legal-close" type="button" onClick={onClose} aria-label={text('关闭', 'Close')}><X /></button>
        <p className="kicker">CREDITS · RIGHTS · PRIVACY</p>
        <h1 id="legal-title">{text('素材、版权与隐私说明', 'Credits, rights & privacy')}</h1>
        {language === 'zh' ? <>
          <section><h2>项目性质</h2><p>MusiCup 是免费、非商业的音乐鉴赏互动项目，与 FIFA、Apple、Wikimedia、作曲家遗产管理机构、表演者或唱片公司不存在隶属、授权或赞助关系。“世界杯”仅用于描述淘汰赛结构。</p></section>
          <section><h2>作曲与文字</h2><p>部分古典作品的乐谱已进入公有领域，但具体演奏和录音可能仍受著作权或邻接权保护。作曲家简介依据公开百科资料重新概述，并非对百科原文的复制。</p></section>
          <section><h2>肖像</h2><p>肖像来自 Wikipedia / Wikimedia Commons。每张图片的作者、版权状态和许可条件以其来源文件页为准；点击或打开图片来源可核验。开放许可图片可能要求署名、许可链接及修改说明。</p></section>
          <section><h2>试听</h2><p>网站优先使用 Wikimedia Commons 中明确标记为公有领域或开放许可的录音，并显示表演者与许可。若使用 Apple Music / iTunes 的商店试听，它仅以流媒体方式帮助识别和发现对应录音，不在本站提供下载；来源文字链接会打开对应商店页面，试听内容由 iTunes 提供。第三方目录可能因地区、授权变更或地址失效而不可用。</p></section>
          <section><h2>隐私</h2><p>比赛进度和语言偏好保存在玩家浏览器。完成比赛后，随机结果编号及冠军、亚军、四强用于匿名汇总。昵称、完整签表和留言仅在玩家主动提交时保存；昵称与具名签表最多保留一年，留言仅供管理员阅读。请勿提交真实姓名、电话、邮箱或其他敏感信息。托管服务可能为安全和运行需要生成常规访问日志。</p></section>
          <section><h2>纠错与权利请求</h2><p>如果你是素材权利人，或发现署名、曲目匹配、授权状态存在问题，请通过项目 GitHub Issues 联系维护者。收到可信请求后，相关内容会被核验、修正或移除。</p></section>
        </> : <>
          <section><h2>Independent project</h2><p>MusiCup is a free, non-commercial music-discovery project. It is not affiliated with, authorised, sponsored, or endorsed by FIFA, Apple, Wikimedia, any composer estate, performer, or record label. “World Cup” describes the tournament format only.</p></section>
          <section><h2>Compositions and text</h2><p>Many scores are in the public domain, but a particular performance or recording may still be protected by copyright or related rights. Composer introductions are newly written summaries based on public reference material.</p></section>
          <section><h2>Portraits</h2><p>Portraits are retrieved from Wikipedia / Wikimedia Commons. The author, copyright status, and licence shown on each source file page govern reuse. Open licences may require attribution, a licence link, and an indication of changes.</p></section>
          <section><h2>Audio previews</h2><p>The site prioritises recordings on Wikimedia Commons that are marked public-domain or openly licensed, with performer and licence details shown. Apple Music / iTunes store previews, where used, are streamed only to identify and discover the corresponding recording and are not downloadable here. The nearby source link opens the relevant store page; preview content is provided courtesy of iTunes. Availability may change by territory, licence, or catalogue URL.</p></section>
          <section><h2>Privacy</h2><p>Tournament progress and language preference stay in your browser. After completion, a random result ID and the champion, runner-up, and semi-finalists are submitted for anonymous totals. A nickname, full bracket, or message is stored only when you actively submit it. Named records are retained for no more than one year; messages are visible only to the administrator. Please do not submit real names, phone numbers, email addresses, or sensitive information. Hosting providers may create routine security and operational logs.</p></section>
          <section><h2>Corrections and rights requests</h2><p>If you own any material or spot an attribution, track-match, or licensing problem, contact the maintainer through the project’s GitHub Issues. Credible reports will be reviewed and the material corrected or removed.</p></section>
        </>}
        <div className="legal-links"><a href="https://github.com/Vulpexy/composer-world-cup/issues" target="_blank" rel="noreferrer">GitHub Issues</a><a href="https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia" target="_blank" rel="noreferrer">Wikimedia reuse guide</a><a href="https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/" target="_blank" rel="noreferrer">Apple Search API terms</a></div>
      </article>
    </div>
  );
}

