import { useState } from 'react';
import { text } from '../content';
import type { Language } from '../content';
import '../content-pages.css';

export default function UsageDemo({ language, motion }: { language: Language; motion: boolean }) {
  const [playing, setPlaying] = useState(true);
  const t = (zh: string, en: string) => text(language, zh, en);
  const active = motion && playing;
  const poster = `${import.meta.env.BASE_URL}usage-demo-${language}.png`;
  const gif = `${import.meta.env.BASE_URL}usage-demo-${language}.gif`;
  return <section className="usage-section section-shell" aria-labelledby="usage-title">
    <div className="section-heading"><h2 id="usage-title">{t('看看如何使用', 'See how it works')}</h2><div className="usage-intro"><p>{t('选择图床，右键笔记，再复制分享。', 'Choose your storage, right-click a note, then copy and share.')}</p><button className="text-button" onClick={() => setPlaying(value => !value)} aria-pressed={!active} disabled={!motion}>{!motion ? t('静态预览', 'Static preview') : active ? t('暂停演示', 'Pause walkthrough') : t('播放演示', 'Play walkthrough')}</button></div></div>
    <figure className="usage-figure"><img src={active ? gif : poster} alt={t('使用示例内容演示选择 OSS 或 S3、右键运行 MarkToGo、生成图片链接并复制分享版的流程', 'Illustrated walkthrough: choose OSS or S3, run MarkToGo from a note, generate image links and copy the shared Markdown')} width="960" height="540" loading="lazy" decoding="async" onError={event => { if (event.currentTarget.src.endsWith('.gif')) event.currentTarget.src = poster; }} /><figcaption><p>{t('约 13 秒的界面流程示意，使用示例笔记与预设图床配置。复制文件仅支持 Windows。', 'A 13-second illustrated walkthrough using a sample note and preset storage. Copy file is available on Windows.')}</p><a className="plain-link" href={gif} target="_blank" rel="noopener noreferrer">{t('放大查看 GIF', 'View full-size GIF')} ↗</a></figcaption></figure>
  </section>;
}
