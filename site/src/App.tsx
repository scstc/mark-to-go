import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { guides, installUrl, repository, text } from './content';
import type { Language, GuideId } from './content';
import type { ClickSparkHandle } from './components/react-bits/ClickSpark';
import LatestRelease from './components/LatestRelease';
import ReleaseHistory from './components/ReleaseHistory';
import UsageDemo from './components/UsageDemo';
import './button-effects.css';
import './header-controls.css';

const TechText = lazy(() => import('./components/react-bits/TechText'));
const CrystalizedBall = lazy(() => import('./components/react-bits/CrystalizedBall'));
const LightRays = lazy(() => import('./components/react-bits/LightRays'));
const AnimatedContent = lazy(() => import('./components/react-bits/AnimatedContent'));
const Magnet = lazy(() => import('./components/react-bits/Magnet'));
const ClickSpark = lazy(() => import('./components/react-bits/ClickSpark'));
const GlareHover = lazy(() => import('./components/react-bits/GlareHover'));
const StarBorder = lazy(() => import('./components/react-bits/StarBorder'));

function initialLanguage(): Language {
  const explicit = new URLSearchParams(location.search).get('lang');
  if (explicit === 'zh' || explicit === 'en') return explicit;
  try { const saved = localStorage.getItem('mark-to-go-language'); if (saved === 'zh' || saved === 'en') return saved; } catch { /* Storage may be disabled. */ }
  return navigator.language.startsWith('zh') ? 'zh' : 'en';
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  return reduced;
}

class EffectBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback ?? <div className="orb-fallback" /> : this.props.children; }
}

function Arrow({ external = false }: { external?: boolean }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d={external ? 'M6 18 18 6M6 6h12v12' : 'M4 12h15m-6-6 6 6-6 6'} /></svg>;
}

function Reveal({ children, motion, className = '' }: { children: ReactNode; motion: boolean; className?: string }) {
  return motion ? <Suspense fallback={<div className={className}>{children}</div>}><AnimatedContent className={className} distance={38} duration={0.75} threshold={0.05}>{children}</AnimatedContent></Suspense> : <div className={className}>{children}</div>;
}

function InstallLink({ language, motion }: { language: Language; motion: boolean }) {
  const label = <>{text(language, '安装到 Obsidian', 'Install in Obsidian')} <Arrow /></>;
  const link = <a className="button primary install-button" href={installUrl}>{label}</a>;
  const fallback = <div className="install-magnet">{link}</div>;
  return motion ? <Suspense fallback={fallback}><Magnet wrapperClassName="install-magnet" padding={40} magnetStrength={3} maxOffset={12} tilt={2} scale={1.035}><StarBorder as="a" href={installUrl} className="button primary install-button" color="#edfff5" trailColor="#66e6b0" backgroundColor="#133e30" textColor="#effff5" borderColor="#5ba885" duration={2.8} stars={2} thickness={2} radius={8} trailLength={0.4} glow={0.9} hover="brighten" sparkle={false} clickPulse>{label}</StarBorder></Magnet></Suspense> : fallback;
}

function Demo({ language }: { language: Language }) {
  const t = (zh: string, en: string) => text(language, zh, en);
  const [provider, setProvider] = useState('oss');
  const [shared, setShared] = useState(true);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle');
  useEffect(() => { setCopied('idle'); }, [language, provider, shared]);
  const title = t('周末，去森林', 'A walk through the forest');
  const markdown = `# ${title}\n\n${t('把这一刻，留在笔记里。', 'A small moment, kept in a note.')}\n\n` + (shared
    ? `![${t('森林', 'Forest')}](https://images.example.com/${provider}/forest.jpg)`
    : '![[attachments/forest.jpg]]');
  const copy = async () => {
    try { await navigator.clipboard.writeText(markdown); setCopied('ok'); }
    catch { setCopied('failed'); }
  };
  return <div className="demo-workspace" data-ui>
    <div className="demo-toolbar"><span className="demo-note-name">{t('森林漫步.md', 'Forest walk.md')}</span><div className="segmented" aria-label={t('演示视图', 'Demo view')}>
      <button aria-pressed={!shared} onClick={() => setShared(false)}>{t('原笔记', 'Original')}</button><button aria-pressed={shared} onClick={() => setShared(true)}>{t('分享版', 'Shared')}</button>
    </div></div>
    <div className="demo-body"><article className="demo-render"><h3>{title}</h3><p>{t('把这一刻，留在笔记里。', 'A small moment, kept in a note.')}</p>
      <img src={`${import.meta.env.BASE_URL}forest.jpg`} alt={t('阳光穿过薄雾森林的实景照片', 'Sunlight filtering through a misty forest')} width="1200" height="675" loading="lazy" decoding="async" />
      <span className="demo-image-status">{shared ? t('图片已随笔记分享', 'Image included in your shared note') : t('图片保存在本地附件中', 'Image lives in your local attachments')}</span>
    </article><div className="demo-source"><div className="demo-source-heading"><span>Markdown</span><button className="text-button" onClick={copy}>{t('复制示例', 'Copy example')} <Arrow /></button></div><pre><code>{markdown}</code></pre>
      <p className="copy-feedback" role="status">{copied === 'ok' ? t('示例已复制，没有上传任何内容。', 'Example copied. Nothing was uploaded.') : copied === 'failed' ? t('浏览器未允许复制，请选中代码手动复制。', 'Your browser blocked copying. Select the code to copy it manually.') : t('这是本地交互演示，不会连接你的图床。', 'A local demo. It never connects to your storage.')}</p>
      <div className="demo-provider-picker"><span>{t('切换上传方式', 'Try another uploader')}</span><div className="segmented" aria-label={t('演示图床', 'Demo image host')}>{[['oss', 'OSS'], ['s3', 'S3'], ['piclist', 'PicList']].map(([value, label]) => <button key={value} aria-pressed={provider === value} onClick={() => setProvider(value)}>{label}</button>)}</div></div>
    </div></div>
  </div>;
}

function Home({ language, motion }: { language: Language; motion: boolean }) {
  const t = (zh: string, en: string) => text(language, zh, en);
  const [pulse, setPulse] = useState(0);
  const faq = guides(language).find(guide => guide.id === 'faq')!;
  return <>
    <section className="hero" aria-labelledby="hero-title" data-motion={motion}>
      {motion && <div className="hero-atmosphere" aria-hidden="true"><EffectBoundary fallback={<span />}><Suspense fallback={null}><LightRays raysOrigin="top-center" raysColor="#82e3c0" raysSpeed={0.45} lightSpread={0.8} rayLength={1.5} rayDensity={0.8} intensity={1} glow={0.4} haze={0.15} opacity={0.65} followMouse mouseInfluence={0.08} cursorShadow={false} clickPulse={false} maxDevicePixelRatio={1} /></Suspense></EffectBoundary></div>}
      <div className="hero-copy"><h1 id="hero-title" aria-label="MarkToGo"><span className={motion ? 'sr-only' : ''}>MarkToGo</span>{motion && <div className="hero-tech" aria-hidden="true"><Suspense fallback={<span className="tech-fallback">MarkToGo</span>}><TechText text="MarkToGo" fontFamily="Hanken Grotesk" fontSize={145} align="left" fontWeight={700} intro="assemble" introDuration={0.95} color="#eff7f2" accentColor="#82e3c0" labels={false} guides={false} sweep={false} specks={6} draggable={false} /></Suspense></div>}</h1>
        <p className="hero-statement">{t('让笔记自由出发', 'Your notes. Ready to go.')}</p>
        <p className="hero-description">{t('把 Obsidian 笔记变成可分享的 Markdown。图片一起走，原文留在原处。', 'Share your Obsidian notes as portable Markdown. Images go with them. Originals stay with you.')}</p>
        <div className="hero-actions"><InstallLink language={language} motion={motion} /><a className="button secondary" href="#guide-install">{t('阅读使用手册', 'Read the guide')} <Arrow /></a></div>
        <div className="hero-release-links"><LatestRelease language={language} /><a className="plain-link release-history-link" href="#releases">{t('版本历史', 'Release history')} <Arrow /></a></div>
        <p className="hero-footnote">{t('免费开源 · 适用于 Obsidian 桌面版', 'Free and open source · Obsidian desktop')}</p>
      </div>
      <div className="hero-art" aria-label={t('笔记与图片一起传递的动态插画', 'Animated illustration of notes and images travelling together')}>
        <div className="orb-frame" aria-hidden="true"><EffectBoundary>{motion ? <Suspense fallback={<div className="orb-fallback" />}><CrystalizedBall color="#83e8c2" theme="dark" particleCount={4500} size={0.79} speed={0.65} strands={5} glow={0.35} haze={0.1} interactive hoverStrength={0.55} /></Suspense> : <div className="orb-fallback" />}</EffectBoundary></div>
        {pulse > 0 && <div className="share-pulse" key={pulse} aria-hidden="true"><span /><span /></div>}
        <button className="obsidian-center" onClick={() => setPulse(value => value + 1)} disabled={!motion} aria-label={t('播放笔记分享动效', 'Play the note-sharing animation')} title={t('点击宝石，看看笔记如何出发', 'Click the gem to send a note on its way')}>
          <img src={`${import.meta.env.BASE_URL}obsidian-logo.svg`} alt="Obsidian" width="176" height="176" />
        </button>
        <div className="floating-note local-note" data-ui><span className="note-file">{t('我的笔记.md', 'My note.md')}</span><span className="note-line wide" /><span className="note-line" /><div className="note-attachment"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-7 5 9" /></svg><span>![[image.png]]</span></div><span className="note-location">{t('本地笔记', 'Local note')}</span></div>
        <div className="floating-note shared-note" data-ui><span className="note-file">{t('分享版.md', 'Ready to share.md')}</span><span className="note-line wide" /><span className="note-line" /><div className="note-attachment online"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M8 8h-1a5 5 0 0 0 0 10h3m6-12h1a5 5 0 0 1 0 10h-3M8 12h8" /></svg><span>https://…/image.png</span></div><span className="note-location">{t('图片链接，随文同行', 'Images, linked and included')}</span></div>
      </div>
    </section>

    <section id="demo" className="demo-section section-shell"><Reveal motion={motion} className="section-heading"><h2>{t('试着分享一篇', 'See a note travel')}</h2><p>{t('在原笔记和分享版之间切换，看看图片地址如何改变。', 'Switch between the original and shared note. Watch the image reference change.')}</p></Reveal><Demo language={language} /></section>
    <UsageDemo language={language} motion={motion} />

    <section className="setup-section section-shell"><Reveal motion={motion} className="setup-intro"><h2>{t('连接你的图床', 'Your storage. Your choice.')}</h2><p>{t('26.4.5 起支持 OSS 和 AWS S3 直连，推荐优先使用，无需额外安装 PicList 或 Node.js。PicList 作为备选，已有配置升级后继续沿用。', 'Direct OSS and AWS S3 uploads are available from 26.4.5 and are recommended, with no separate PicList or Node.js installation. PicList is an alternative, and existing settings are preserved on upgrade.')}</p><a className="plain-link" href="#guide-install">{t('从安装开始', 'Start with installation')} <Arrow /></a></Reveal>
      <div className="provider-list">{[
        ['oss', t('阿里云 OSS', 'Alibaba Cloud OSS'), t('填写桶与密钥，直接上传', 'Connect your bucket and upload directly'), t('推荐直连 · 26.4.5 起支持', 'Recommended · Available since 26.4.5')],
        ['s3', 'AWS S3', t('支持官方区域与 CloudFront 地址', 'AWS regions and your CloudFront domain'), t('推荐直连 · 26.4.5 起支持', 'Recommended · Available since 26.4.5')],
        ['piclist', 'PicList', t('沿用熟悉的图床与插件', 'Keep your hosts and PicList plugins'), t('备选方式 · 稳定版已支持', 'Alternative · Available in the stable release')],
      ].map(([id, name, detail, availability]) => {
        const link = <a href={`#guide-${id}`} className="provider-link"><div><h3>{name}</h3><p>{detail}</p><span>{availability}</span></div><Arrow /></a>;
        return <div key={id} className="provider-entry">{motion ? <Suspense fallback={link}><GlareHover width="100%" borderRadius="0px" style={{ display: 'block', border: 0 }} glareColor="#a3efcb" glareOpacity={0.35} glareSize={32} transitionDuration={700} rimGlint={false}>{link}</GlareHover></Suspense> : link}</div>;
      })}</div>
    </section>

    <section className="essentials section-shell"><Reveal motion={motion}><h2>{t('只改变分享的副本', 'A shared copy. Originals intact.')}</h2><p className="large-copy">{t('原笔记和附件留在 Vault。已有的在线图片地址保持原样；上传过的图片，下次从缓存复用。', 'Your original note and attachments stay in the vault. Existing online images keep their URLs. Previously uploaded images are reused from the cache.')}</p></Reveal><div className="workflow"><span>{t('右键笔记', 'Right-click a note')}</span><Arrow /><span>MarkToGo</span><Arrow /><span>{t('粘贴分享', 'Paste and share')}</span></div></section>

    <section className="faq-section section-shell"><Reveal motion={motion}><h2>{t('你可能想问', 'A few useful answers')}</h2></Reveal><div className="faq-list">{faq.steps.slice(0, 3).map(step => <details key={step.title}><summary>{step.title}<span aria-hidden="true">+</span></summary><p>{step.body}</p></details>)}</div><a href="#guide-faq" className="plain-link">{t('查看全部常见问题', 'All common questions')} <Arrow /></a></section>
    <section className="closing section-shell"><Reveal motion={motion}><h2>{t('下一篇笔记，随时出发', 'Take your next note with you.')}</h2><InstallLink language={language} motion={motion} /></Reveal></section>
  </>;
}

function GuidePage({ language, id }: { language: Language; id: string }) {
  const t = (zh: string, en: string) => text(language, zh, en);
  const all = guides(language);
  const guide = all.find(item => item.id === id) ?? all[0];
  return <div className="guide-layout"><aside className="guide-nav"><a className="back-home" href="#home">{t('返回首页', 'Back to home')}</a><nav aria-label={t('手册目录', 'Guide contents')}>{all.map(item => <a key={item.id} href={`#guide-${item.id}`} aria-current={guide.id === item.id ? 'page' : undefined}>{item.title}</a>)}</nav></aside>
    <article className="guide-article"><h1>{guide.title}</h1><p className="guide-intro">{guide.intro}</p>
      <div className="guide-quick-links">{guide.links.map(link => <a key={link.href} href={link.href} target={link.href.startsWith('https:') ? '_blank' : undefined} rel="noopener noreferrer">{link.label}<Arrow external /></a>)}</div>
      <ol className="guide-steps">{guide.steps.map(step => <li key={step.title}><h2>{step.title}</h2><p>{step.body}</p>{guide.id === 'piclist' && guide.steps.indexOf(step) === 1 && <pre><code>npm install -g piclist</code></pre>}</li>)}</ol>
      {guide.fields && <section className="guide-fields"><h2>{t('设置项怎么填', 'What goes in each field')}</h2><div className="field-table" role="region" aria-label={t('配置字段', 'Configuration fields')} tabIndex={0}><table><thead><tr><th>{t('设置项', 'Field')}</th><th>{t('示例', 'Example')}</th><th>{t('说明', 'Description')}</th></tr></thead><tbody>{guide.fields.map(field => <tr key={field.name}><th scope="row">{field.name}</th><td><code>{field.value}</code></td><td>{field.description}</td></tr>)}</tbody></table></div></section>}
      {guide.note && <aside className="guide-note"><h2>{t('需要了解', 'Good to know')}</h2><p>{guide.note}</p></aside>}
      <a href={repository + '/issues'} className="plain-link" target="_blank" rel="noopener noreferrer">{t('还有问题？在 GitHub 反馈', 'Still stuck? Open a GitHub issue')} <Arrow external /></a>
    </article></div>;
}

export default function App() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [route, setRoute] = useState(() => location.hash.slice(1) || 'home');
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const motion = !reduced && !paused;
  const appRef = useRef<HTMLDivElement>(null);
  const sparkRef = useRef<ClickSparkHandle>(null);
  const t = (zh: string, en: string) => text(language, zh, en);
  const isGuide = route.startsWith('guide-');
  const isReleases = route === 'releases';
  const isHome = !isGuide && !isReleases;
  const spark = (target: EventTarget, x?: number, y?: number) => {
    if (!motion || !isHome || !(target instanceof Element)) return;
    const control = target.closest('a, button, summary');
    const root = appRef.current;
    if (!control || !root || control.matches(':disabled, .skip-link')) return;
    const box = root.getBoundingClientRect();
    const button = control.getBoundingClientRect();
    sparkRef.current?.spark((x ?? button.left + button.width / 2) - box.left, (y ?? button.top + button.height / 2) - box.top);
  };
  useEffect(() => {
    const change = () => setRoute(location.hash.slice(1) || 'home');
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    const page = isGuide ? guides(language).find(guide => guide.id === route.slice(6))?.title : isReleases ? t('版本发布历史', 'Release history') : t('让笔记自由出发', 'Your notes. Ready to go.');
    document.title = `MarkToGo · ${page ?? t('使用手册', 'User guide')}`;
    try { localStorage.setItem('mark-to-go-language', language); } catch { /* The site works without storage. */ }
    const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState(null, '', url);
  }, [language, route, isGuide, isReleases]);
  useEffect(() => {
    if (route === 'demo') document.getElementById('demo')?.scrollIntoView({ behavior: motion ? 'smooth' : 'instant' });
    else window.scrollTo({ top: 0, behavior: 'instant' });
  }, [route]);
  return <div ref={appRef} className="site-app" data-page={isGuide ? 'guide' : isReleases ? 'releases' : 'home'} data-motion={motion} onPointerDownCapture={event => { if (event.isPrimary && event.button === 0) spark(event.target, event.clientX, event.clientY); }} onClickCapture={event => { if (event.detail === 0) spark(event.target); }}>
    {motion && isHome && <Suspense fallback={null}><ClickSpark ref={sparkRef} className="button-sparks" style={{ position: 'absolute', inset: 0, height: 'auto', pointerEvents: 'none', zIndex: 20, overflow: 'hidden' }} sparkColor={['#63d3a2', '#b8ffdc', '#ffffff']} sparkSize={12} sparkRadius={46} sparkCount={10} duration={600} sparkWidth={2.5} glow={0.3} ring /></Suspense>}
    <a className="skip-link" href="#main" onClick={event => { event.preventDefault(); document.getElementById('main')?.focus(); document.getElementById('main')?.scrollIntoView(); }}>{t('跳转到正文', 'Skip to content')}</a><header className="site-header"><a href="#home" className="wordmark"><img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="30" height="30" />MarkToGo</a><nav className="site-navigation" aria-label={t('主导航', 'Main navigation')}><a href="#demo">{t('体验', 'Demo')}</a><a href="#guide-install" aria-current={isGuide ? 'page' : undefined}>{t('使用手册', 'Guide')}</a><a className="github-star-link" href={repository} target="_blank" rel="noopener noreferrer" aria-label={t('前往 GitHub 为 MarkToGo 点 Star', 'Star MarkToGo on GitHub')} title={t('前往 GitHub 为 MarkToGo 点 Star', 'Star MarkToGo on GitHub')}><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z" /></svg><span>Star</span></a></nav><div className="header-tools"><button type="button" className="motion-toggle" aria-label={motion ? t('暂停动效', 'Pause motion') : t('静态模式', 'Motion off')} aria-pressed={!motion} onClick={() => setPaused(value => !value)} disabled={reduced} title={t('切换动态效果', 'Toggle animation')}><svg className="motion-toggle-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{motion ? <path d="M9 5v14M15 5v14" /> : <path d="m9 5 11 7-11 7Z" />}</svg><span className="motion-toggle-label">{motion ? t('暂停动效', 'Pause motion') : t('静态模式', 'Motion off')}</span></button><div className="language-toggle" role="group" aria-label={t('网站语言', 'Website language')}><button type="button" lang="zh-CN" aria-label="简体中文" aria-pressed={language === 'zh'} onClick={() => setLanguage('zh')}>中文</button><button type="button" lang="en" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button></div></div></header>
    <main id="main" tabIndex={-1}>{isGuide ? <GuidePage language={language} id={route.slice(6) as GuideId} /> : isReleases ? <ReleaseHistory language={language} /> : <Home language={language} motion={motion} />}</main>
    <footer className="site-footer section-shell"><div><a href="#home" className="footer-brand">MarkToGo</a><p>{t('让笔记走得更远', 'Good notes travel.')}</p></div><div className="footer-links"><a href="#guide-privacy">{t('隐私与权限', 'Privacy')}</a><a href="#releases" aria-current={isReleases ? 'page' : undefined}>{t('版本记录', 'Releases')}</a><a href="https://reactbits.dev/" target="_blank" rel="noopener noreferrer">{t('动效来自 React Bits', 'Motion by React Bits')}</a><a href={`${import.meta.env.BASE_URL}react-bits-license.txt`}>{t('组件许可', 'Component license')}</a></div><span>Simple · 0-BSD</span></footer>
  </div>;
}
