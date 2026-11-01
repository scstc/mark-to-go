import { useEffect, useRef, useState } from 'react';
import { text } from '../content';
import type { Language } from '../content';
import { loadEmotionBallSdk } from './emotion-ball-sdk';
import type { EmotionBallInstance } from './emotion-ball-sdk';
import './emotion-ball-demo.css';

const emotions = [
  { id: '02', zh: '待机放空', en: 'Idle', detailZh: '放松一下，四处看看。', detailEn: 'Take a breath. Have a look around.' },
  { id: '03', zh: '好奇', en: 'Curious', detailZh: '这个看起来很有意思。', detailEn: 'That looks interesting.' },
  { id: '10', zh: '开心', en: 'Happy', detailZh: '一点小事，也值得开心。', detailEn: 'A little moment of happiness.' },
  { id: '12', zh: '失落', en: 'Down', detailZh: '偶尔也需要安静一会儿。', detailEn: 'Sometimes a quiet moment helps.' },
  { id: '30', zh: '思考中', en: 'Thinking', detailZh: '让我想一想……', detailEn: 'Let me think about that…' },
  { id: '00', zh: '睡眠', en: 'Sleeping', detailZh: '休息一下，稍后再见。', detailEn: 'Time for a little rest.' },
];

export default function EmotionBallDemo({ language, motion }: { language: Language; motion: boolean }) {
  const t = (zh: string, en: string) => text(language, zh, en);
  const widgetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hostRef = useRef<HTMLSpanElement>(null);
  const instanceRef = useRef<EmotionBallInstance | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('02');
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const active = motion && !reducedMotion && pageVisible;
  const current = emotions.find(emotion => emotion.id === selected) ?? emotions[0]!;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !widgetRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(preference.matches);
    const updateVisibility = () => setPageVisible(!document.hidden);
    preference.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      preference.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let instance: EmotionBallInstance | undefined;
    setStatus('loading');
    void loadEmotionBallSdk().then(sdk => {
      if (disposed) return;
      instance = sdk.create(host, { emotion: selectedRef.current, color: '#a3efcb', eyeColor: '#17382a', autostart: false, lite: true });
      instanceRef.current = instance;
      setStatus('ready');
    }).catch(() => {
      if (!disposed) { host.replaceChildren(); setStatus('error'); }
    });
    return () => {
      disposed = true;
      instance?.destroy();
      if (instanceRef.current === instance) instanceRef.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (status !== 'ready' || !instance) return;
    instance.stopTour();
    instance.setActive(active);
    instance.setEmotion(selected);
    if (!active) { instance.clearGaze(); instance.renderStatic(); }
  }, [active, selected, status]);

  function closePanel() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return <div id="emotion-demo" ref={widgetRef} className="emotion-widget" onKeyDown={event => {
    if (open && event.key === 'Escape') { event.preventDefault(); closePanel(); }
  }} onBlur={event => {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={triggerRef} className="emotion-widget-trigger" type="button" aria-expanded={open} aria-controls="emotion-panel" aria-label={open ? t('收起表情面板', 'Close emotion panel') : t('打开表情面板', 'Open emotion panel')} onClick={() => {
      setOpen(value => !value);
      if (!open && active && status === 'ready') instanceRef.current?.bounce();
    }} onPointerMove={event => {
      if (!active || status !== 'ready') return;
      const bounds = event.currentTarget.getBoundingClientRect();
      instanceRef.current?.setGaze((event.clientX - bounds.left) / bounds.width * 2 - 1, (event.clientY - bounds.top) / bounds.height * 2 - 1);
    }} onPointerLeave={() => instanceRef.current?.clearGaze()}>
      <span ref={hostRef} className="emotion-ball-host" aria-hidden="true" />
      {status !== 'ready' && <span className="emotion-widget-placeholder" aria-hidden="true"><span /><span /></span>}
    </button>
    {!open && <span className="emotion-widget-hint" aria-hidden="true">{t('点我，换个表情', 'Pick a mood')}</span>}
    <div id="emotion-panel" className="emotion-widget-panel" role="region" aria-labelledby="emotion-widget-title" hidden={!open}>
      <div className="emotion-widget-header"><h2 id="emotion-widget-title">Emotion Ball</h2><button type="button" className="emotion-widget-close" aria-label={t('关闭表情面板', 'Close emotion panel')} onClick={closePanel}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div>
      <div className="emotion-widget-body">
        {status !== 'ready' ? <div className="emotion-widget-loading" role={status === 'error' ? 'alert' : 'status'}><p>{status === 'error' ? t('小球暂时没能加载。', 'The ball could not load.') : t('正在准备小球……', 'Getting the ball ready…')}</p>{status === 'error' && <button type="button" className="emotion-widget-retry" onClick={() => setAttempt(value => value + 1)}>{t('重新加载', 'Try again')}</button>}</div> : <div className="emotion-widget-status" aria-live="polite" aria-atomic="true"><strong>{language === 'zh' ? current.zh : current.en}</strong><p>{language === 'zh' ? current.detailZh : current.detailEn}</p></div>}
        <div className="emotion-widget-choices" role="group" aria-label={t('选择小球表情', 'Choose a ball expression')}>
          {emotions.map(emotion => <button key={emotion.id} type="button" aria-pressed={selected === emotion.id} disabled={status !== 'ready'} onClick={() => setSelected(emotion.id)}><span className="emotion-choice-dot" aria-hidden="true" />{language === 'zh' ? emotion.zh : emotion.en}</button>)}
        </div>
        {!motion || reducedMotion ? <p className="emotion-widget-static">{t('静态表情，仍可切换。', 'Still expressions; switching available.')}</p> : null}
        <p className="emotion-widget-local">{t('本地互动，不连接 AI，也不上传内容。', 'Local interaction. No AI connection or uploads.')}</p>
        <div className="emotion-widget-attribution"><p>{t('第三方组件 · 非商业技术展示', 'Third-party component · non-commercial showcase')}</p><div><a href="https://github.com/sam70361/aora-bot" target="_blank" rel="noopener noreferrer">{t('原项目', 'Original project')} ↗</a><a href={`${import.meta.env.BASE_URL}component-licenses.html`}>{t('组件许可', 'Component licenses')}</a></div></div>
      </div>
    </div>
  </div>;
}
