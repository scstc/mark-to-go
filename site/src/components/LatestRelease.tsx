import { useEffect, useState } from 'react';
import { repository, text } from '../content';
import type { Language } from '../content';

export default function LatestRelease({ language }: { language: Language }) {
  const [version, setVersion] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    void fetch('https://api.github.com/repos/scstc/mark-to-go/releases/latest', {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    }).then(async response => {
      if (!response.ok) return;
      const release: unknown = await response.json();
      if (!controller.signal.aborted && release && typeof release === 'object' && 'tag_name' in release && typeof release.tag_name === 'string') {
        setVersion(release.tag_name);
      }
    }).catch(() => { /* The latest-release link also works when the API is unavailable. */ }).finally(() => window.clearTimeout(timeout));
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, []);

  return <a className="release-link" href={`${repository}/releases/latest`} target="_blank" rel="noopener noreferrer">
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M20 13 13 20a2 2 0 0 1-3 0L3 13V3h10l7 7a2 2 0 0 1 0 3Z" /><circle cx="7.5" cy="7.5" r="1" /></svg>
    {text(language, 'GitHub 最新版', 'Latest on GitHub')}{version && <strong>{version}</strong>}
    <span aria-hidden="true">↗</span>
  </a>;
}
