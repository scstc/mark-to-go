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
  const sectionRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLSpanElement>(null);
  const instanceRef = useRef<EmotionBallInstance | null>(null);
  const [selected, setSelected] = useState('02');
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [shouldLoad, setShouldLoad] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [attempt, setAttempt] = useState(0);
  const [greeted, setGreeted] = useState(false);
  const active = motion && !reducedMotion && inView && pageVisible;
  const current = emotions.find(emotion => emotion.id === selected) ?? emotions[0]!;
  const licenseBase = `${import.meta.env.BASE_URL}vendor/emotion-ball/`;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (!('IntersectionObserver' in window)) { setShouldLoad(true); setInView(true); return; }
    const nearby = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setShouldLoad(true); nearby.disconnect(); }
    }, { rootMargin: '240px' });
    const visible = new IntersectionObserver(entries => {
      setInView(entries.some(entry => entry.isIntersecting));
    });
    nearby.observe(section);
    visible.observe(section);
    return () => { nearby.disconnect(); visible.disconnect(); };
  }, []);

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
    if (!shouldLoad) return;
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
  }, [shouldLoad, attempt]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (status !== 'ready' || !instance) return;
    instance.stopTour();
    instance.setActive(active);
    instance.setEmotion(selected);
    if (!active) { instance.clearGaze(); instance.renderStatic(); }
  }, [active, selected, status]);

  function greet() {
    if (status !== 'ready') return;
    setGreeted(true);
    if (active) instanceRef.current?.bounce();
  }

  return <section id="emotion-demo" ref={sectionRef} className="emotion-demo section-shell" aria-labelledby="emotion-demo-title">
    <div className="emotion-demo-layout">
      <div className="emotion-demo-copy">
        <p className="emotion-demo-eyebrow">Emotion Ball</p>
        <h2 id="emotion-demo-title">{t('给页面一点情绪', 'A little personality.')}</h2>
        <p className="emotion-demo-intro">{t('选个表情，看看小球的反应。移动鼠标，或轻轻点它一下。', 'Pick an expression and see how it feels. Move your pointer, or give it a gentle tap.')}</p>
        <div className="emotion-demo-choices" role="group" aria-label={t('选择小球表情', 'Choose a ball expression')}>
          {emotions.map(emotion => <button key={emotion.id} type="button" aria-pressed={selected === emotion.id} disabled={status !== 'ready'} onClick={() => { setSelected(emotion.id); setGreeted(false); }}><span className="emotion-choice-dot" aria-hidden="true" />{language === 'zh' ? emotion.zh : emotion.en}</button>)}
        </div>
        <p className="emotion-demo-local">{t('本地互动展示，不连接 AI，也不上传内容。', 'A local interactive demo. No AI connection or content uploads.')}</p>
      </div>
      <figure className="emotion-demo-figure">
        <div className="emotion-demo-stage" data-ready={status === 'ready'}>
          <span className="emotion-stage-orbit" aria-hidden="true" />
          <button className="emotion-ball-touch" type="button" disabled={status !== 'ready'} aria-label={t('和小球打个招呼', 'Say hello to the ball')} onClick={greet} onPointerMove={event => {
            if (!active) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            instanceRef.current?.setGaze((event.clientX - bounds.left) / bounds.width * 2 - 1, (event.clientY - bounds.top) / bounds.height * 2 - 1);
          }} onPointerLeave={() => instanceRef.current?.clearGaze()}>
            <span ref={hostRef} className="emotion-ball-host" aria-hidden="true" />
          </button>
          {status !== 'ready' && <div className="emotion-demo-loading" role={status === 'error' ? 'alert' : 'status'}>
            <p>{status === 'error' ? t('小球暂时没能加载。', 'The ball could not load.') : t('正在准备小球……', 'Getting the ball ready…')}</p>
            {status === 'error' && <button type="button" className="emotion-demo-retry" onClick={() => setAttempt(value => value + 1)}>{t('重新加载', 'Try again')}</button>}
          </div>}
        </div>
        <figcaption className="emotion-demo-caption">
          <div aria-live="polite" aria-atomic="true"><strong>{language === 'zh' ? current.zh : current.en}</strong><p>{greeted ? t('你好呀，收到你的招呼了。', 'Hello! Nice to meet you.') : language === 'zh' ? current.detailZh : current.detailEn}</p></div>
          <span className="emotion-motion-state">{motion && !reducedMotion ? t('可随时暂停动效', 'Motion can be paused above') : t('静态表情 · 仍可切换', 'Still expressions · switching available')}</span>
        </figcaption>
      </figure>
    </div>
    <div className="emotion-demo-attribution">
      <p>{t('第三方组件的非商业技术展示。球形角色视觉仅限学习与研究使用，采用独立许可。', 'A non-commercial technical showcase of a third-party component. Ball-character visuals are for study and research under their own license.')}</p>
      <div><a href="https://github.com/sam70361/aora-bot" target="_blank" rel="noopener noreferrer">{t('原项目', 'Original project')} ↗</a><a href={`${licenseBase}LICENSE`}>{t('完整许可', 'Full license')}</a><a href={`${licenseBase}NOTICE.md`}>{t('使用声明', 'Usage notice')}</a></div>
    </div>
  </section>;
}
