import { Component, lazy, Suspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { guides, installUrl, repository, text } from './content';
import type { Language, GuideId } from './content';

const TechText = lazy(() => import('./components/react-bits/TechText'));
const CrystalizedBall = lazy(() => import('./components/react-bits/CrystalizedBall'));
const AnimatedContent = lazy(() => import('./components/react-bits/AnimatedContent'));

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

class EffectBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="orb-fallback" /> : this.props.children; }
}

function Arrow({ external = false }: { external?: boolean }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d={external ? 'M6 18 18 6M6 6h12v12' : 'M4 12h15m-6-6 6 6-6 6'} /></svg>;
}

function Reveal({ children, motion, className = '' }: { children: ReactNode; motion: boolean; className?: string }) {
  return motion ? <Suspense fallback={<div className={className}>{children}</div>}><AnimatedContent className={className} distance={38} duration={0.75} threshold={0.05}>{children}</AnimatedContent></Suspense> : <div className={className}>{children}</div>;
}

function Demo({ language }: { language: Language }) {
  const t = (zh: string, en: string) => text(language, zh, en);
  const [provider, setProvider] = useState('piclist');
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
      <img src={`${import.meta.env.BASE_URL}forest.svg`} alt={t('演示笔记中的森林插画', 'Forest illustration in the demo note')} width="600" height="360" />
      <span className="demo-image-status">{shared ? t('图片已随笔记分享', 'Image included in your shared note') : t('图片保存在本地附件中', 'Image lives in your local attachments')}</span>
    </article><div className="demo-source"><div className="demo-source-heading"><span>Markdown</span><button className="text-button" onClick={copy}>{t('复制示例', 'Copy example')} <Arrow /></button></div><pre><code>{markdown}</code></pre>
      <p className="copy-feedback" role="status">{copied === 'ok' ? t('示例已复制，没有上传任何内容。', 'Example copied. Nothing was uploaded.') : copied === 'failed' ? t('浏览器未允许复制，请选中代码手动复制。', 'Your browser blocked copying. Select the code to copy it manually.') : t('这是本地交互演示，不会连接你的图床。', 'A local demo. It never connects to your storage.')}</p>
      <div className="demo-provider-picker"><span>{t('切换上传方式', 'Try another uploader')}</span><div className="segmented" aria-label={t('演示图床', 'Demo image host')}>{[['piclist', 'PicList'], ['oss', 'OSS'], ['s3', 'S3']].map(([value, label]) => <button key={value} aria-pressed={provider === value} onClick={() => setProvider(value)}>{label}</button>)}</div></div>
    </div></div>
  </div>;
}

function Home({ language, motion }: { language: Language; motion: boolean }) {
  const t = (zh: string, en: string) => text(language, zh, en);
  const faq = guides(language).find(guide => guide.id === 'faq')!;
  return <>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy"><h1 id="hero-title" aria-label="MarkToGo"><span className={motion ? 'sr-only' : ''}>MarkToGo</span>{motion && <div className="hero-tech" aria-hidden="true"><Suspense fallback={<span className="tech-fallback">MarkToGo</span>}><TechText text="MarkToGo" fontFamily="Hanken Grotesk" fontSize={145} align="left" fontWeight={700} intro="assemble" introDuration={1.4} color="#eff7f2" accentColor="#82e3c0" labels={false} guides={false} sweep={false} specks={6} draggable={false} /></Suspense></div>}</h1>
        <p className="hero-statement">{t('让笔记自由出发', 'Your notes. Ready to go.')}</p>
        <p className="hero-description">{t('把 Obsidian 笔记变成可分享的 Markdown。图片一起走，原文留在原处。', 'Share your Obsidian notes as portable Markdown. Images go with them. Originals stay with you.')}</p>
        <div className="hero-actions"><a className="button primary" href={installUrl}>{t('安装到 Obsidian', 'Install in Obsidian')} <Arrow /></a><a className="plain-link" href="#guide-install">{t('阅读使用手册', 'Read the guide')}</a></div>
        <p className="hero-footnote">{t('免费开源 · 适用于 Obsidian 桌面版', 'Free and open source · Obsidian desktop')}</p>
      </div>
      <div className="hero-art" aria-label={t('笔记与图片一起传递的动态插画', 'Animated illustration of notes and images travelling together')}>
        <div className="orb-frame" aria-hidden="true"><EffectBoundary>{motion ? <Suspense fallback={<div className="orb-fallback" />}><CrystalizedBall color="#83e8c2" theme="dark" particleCount={4500} size={0.79} speed={0.65} strands={5} glow={0.35} haze={0.1} interactive hoverStrength={0.55} /></Suspense> : <div className="orb-fallback" />}</EffectBoundary></div>
        <div className="floating-note local-note" data-ui><span className="note-file">{t('我的笔记.md', 'My note.md')}</span><span className="note-line wide" /><span className="note-line" /><div className="note-attachment"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-7 5 9" /></svg><span>![[image.png]]</span></div><span className="note-location">{t('本地笔记', 'Local note')}</span></div>
        <div className="floating-note shared-note" data-ui><span className="note-file">{t('分享版.md', 'Ready to share.md')}</span><span className="note-line wide" /><span className="note-line" /><div className="note-attachment online"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M8 8h-1a5 5 0 0 0 0 10h3m6-12h1a5 5 0 0 1 0 10h-3M8 12h8" /></svg><span>https://…/image.png</span></div><span className="note-location">{t('图片链接，随文同行', 'Images, linked and included')}</span></div>
      </div>
    </section>

    <section id="demo" className="demo-section section-shell"><Reveal motion={motion} className="section-heading"><h2>{t('试着分享一篇', 'See a note travel')}</h2><p>{t('在原笔记和分享版之间切换，看看图片地址如何改变。', 'Switch between the original and shared note. Watch the image reference change.')}</p></Reveal><Reveal motion={motion}><Demo language={language} /></Reveal></section>

    <section className="setup-section section-shell"><Reveal motion={motion} className="setup-intro"><h2>{t('连接你的图床', 'Your storage. Your choice.')}</h2><p>{t('已有 PicList 配置，直接沿用。也可以在开发版中配置 OSS 或 S3，省去中间一步。', 'Keep your existing PicList setup. The development build also connects directly to OSS and S3.')}</p><a className="plain-link" href="#guide-install">{t('从安装开始', 'Start with installation')} <Arrow /></a></Reveal>
      <div className="provider-list">{[
        ['piclist', 'PicList', t('沿用熟悉的图床与插件', 'Keep your hosts and PicList plugins'), t('稳定版已支持', 'Available in the stable release')],
        ['oss', t('阿里云 OSS', 'Alibaba Cloud OSS'), t('填写桶与密钥，直接上传', 'Connect your bucket and upload directly'), t('开发版预览', 'Development preview')],
        ['s3', 'AWS S3', t('支持官方区域与 CloudFront 地址', 'AWS regions and your CloudFront domain'), t('开发版预览', 'Development preview')],
      ].map(([id, name, detail, availability]) => <a href={`#guide-${id}`} key={id} className="provider-link"><div><h3>{name}</h3><p>{detail}</p><span>{availability}</span></div></a>)}</div>
    </section>

    <section className="essentials section-shell"><Reveal motion={motion}><h2>{t('只改变分享的副本', 'A shared copy. Originals intact.')}</h2><p className="large-copy">{t('原笔记和附件留在 Vault。已有的在线图片地址保持原样；上传过的图片，下次从缓存复用。', 'Your original note and attachments stay in the vault. Existing online images keep their URLs. Previously uploaded images are reused from the cache.')}</p></Reveal><div className="workflow"><span>{t('右键笔记', 'Right-click a note')}</span><Arrow /><span>MarkToGo</span><Arrow /><span>{t('粘贴分享', 'Paste and share')}</span></div></section>

    <section className="faq-section section-shell"><Reveal motion={motion}><h2>{t('你可能想问', 'A few useful answers')}</h2></Reveal><div className="faq-list">{faq.steps.slice(0, 3).map(step => <details key={step.title}><summary>{step.title}<span aria-hidden="true">+</span></summary><p>{step.body}</p></details>)}</div><a href="#guide-faq" className="plain-link">{t('查看全部常见问题', 'All common questions')} <Arrow /></a></section>
    <section className="closing section-shell"><Reveal motion={motion}><h2>{t('下一篇笔记，随时出发', 'Take your next note with you.')}</h2><a className="button primary" href={installUrl}>{t('安装到 Obsidian', 'Install in Obsidian')} <Arrow /></a></Reveal></section>
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
  const t = (zh: string, en: string) => text(language, zh, en);
  const isGuide = route.startsWith('guide-');
  useEffect(() => {
    const change = () => setRoute(location.hash.slice(1) || 'home');
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    const page = isGuide ? guides(language).find(guide => guide.id === route.slice(6))?.title : t('让笔记自由出发', 'Your notes. Ready to go.');
    document.title = `MarkToGo · ${page ?? t('使用手册', 'User guide')}`;
    try { localStorage.setItem('mark-to-go-language', language); } catch { /* The site works without storage. */ }
    const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState(null, '', url);
  }, [language, route, isGuide]);
  useEffect(() => {
    if (route === 'demo') document.getElementById('demo')?.scrollIntoView({ behavior: motion ? 'smooth' : 'instant' });
    else window.scrollTo({ top: 0, behavior: 'instant' });
  }, [route]);
  return <><a className="skip-link" href="#main" onClick={event => { event.preventDefault(); document.getElementById('main')?.focus(); document.getElementById('main')?.scrollIntoView(); }}>{t('跳转到正文', 'Skip to content')}</a><header className="site-header"><a href="#home" className="wordmark"><img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="30" height="30" />MarkToGo</a><nav className="site-navigation" aria-label={t('主导航', 'Main navigation')}><a href="#demo">{t('体验', 'Demo')}</a><a href="#guide-install" aria-current={isGuide ? 'page' : undefined}>{t('使用手册', 'Guide')}</a><a href={repository} target="_blank" rel="noopener noreferrer">GitHub <Arrow external /></a></nav><div className="header-tools"><button className="motion-toggle" aria-pressed={!motion} onClick={() => setPaused(value => !value)} disabled={reduced} title={t('切换动态效果', 'Toggle animation')}>{motion ? t('暂停动效', 'Pause motion') : t('静态模式', 'Motion off')}</button><div className="language-toggle" aria-label={t('网站语言', 'Website language')}><button aria-pressed={language === 'zh'} onClick={() => setLanguage('zh')}>中</button><button aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button></div></div></header>
    <main id="main" tabIndex={-1}>{isGuide ? <GuidePage language={language} id={route.slice(6) as GuideId} /> : <Home language={language} motion={motion} />}</main>
    <footer className="site-footer section-shell"><div><a href="#home" className="footer-brand">MarkToGo</a><p>{t('让笔记走得更远', 'Good notes travel.')}</p></div><div className="footer-links"><a href="#guide-privacy">{t('隐私与权限', 'Privacy')}</a><a href={repository + '/releases'} target="_blank" rel="noopener noreferrer">{t('版本记录', 'Releases')}</a><a href="https://reactbits.dev/" target="_blank" rel="noopener noreferrer">{t('动效来自 React Bits', 'Motion by React Bits')}</a><a href={`${import.meta.env.BASE_URL}react-bits-license.txt`}>{t('组件许可', 'Component license')}</a></div><span>Simple · 0-BSD</span></footer>
  </>;
}
