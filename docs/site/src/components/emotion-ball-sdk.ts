export interface EmotionBallInstance {
  setEmotion(id: string): boolean;
  setGaze(x: number, y: number): EmotionBallInstance;
  clearGaze(): EmotionBallInstance;
  setActive(active: boolean): void;
  renderStatic(): void;
  stopTour(): void;
  bounce(): void;
  destroy(): void;
}

interface EmotionBallSdk {
  create(target: HTMLElement, options: {
    emotion: string;
    color: string;
    eyeColor: string;
    autostart: boolean;
    lite: boolean;
  }): EmotionBallInstance;
}

const files = ['rings.js', 'emotions.js', 'ball.js', 'engine.js'];
const scripts = new Map<string, Promise<void>>();
let loading: Promise<EmotionBallSdk> | undefined;

function loadScript(file: string): Promise<void> {
  const existing = scripts.get(file);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${import.meta.env.BASE_URL}vendor/emotion-ball/${file}`;
    script.async = false;
    const timer = window.setTimeout(() => finish(new Error('Emotion Ball script timed out')), 15000);
    function finish(error?: Error) {
      window.clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (error) { script.remove(); reject(error); }
      else resolve();
    }
    script.onload = () => finish();
    script.onerror = () => finish(new Error('Emotion Ball script could not load'));
    document.head.append(script);
  });
  scripts.set(file, promise);
  void promise.catch(() => scripts.delete(file));
  return promise;
}

export function loadEmotionBallSdk(): Promise<EmotionBallSdk> {
  if (loading) return loading;
  loading = (async () => {
    for (const file of files) await loadScript(file);
    const sdk = (window as Window & { EmotionBall?: EmotionBallSdk }).EmotionBall;
    if (!sdk || typeof sdk.create !== 'function') {
      scripts.clear();
      throw new Error('Emotion Ball did not initialize');
    }
    return sdk;
  })();
  void loading.catch(() => { loading = undefined; });
  return loading;
}
