import { useEffect, useState } from 'react';
import { installUrl, repository, text } from '../content';
import type { Language } from '../content';
import { releasesFromApi, savedReleases } from '../release-data';
import '../content-pages.css';

export default function ReleaseHistory({ language }: { language: Language }) {
  const t = (zh: string, en: string) => text(language, zh, en);
  const [releases, setReleases] = useState(savedReleases);
  const [status, setStatus] = useState<'loading' | 'live' | 'saved'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    void fetch('https://api.github.com/repos/scstc/mark-to-go/releases?per_page=30', {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    }).then(async response => {
      if (!response.ok) throw new Error('Release list unavailable');
      const records = releasesFromApi(await response.json());
      if (!records.length) throw new Error('No published releases');
      if (active) { setReleases(records); setStatus('live'); }
    }).catch(() => { if (active) setStatus('saved'); }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, []);

  const date = new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' });
  return <section className="releases-page" aria-labelledby="releases-title">
    <a href="#home" className="plain-link">← {t('返回首页', 'Back to home')}</a>
    <header className="releases-heading"><h1 id="releases-title">{t('版本发布历史', 'Release history')}</h1><p>{t('每个版本的主要更新、发布日期和下载文件，都在这里。完整说明以 GitHub Releases 为准。', 'Key updates, publication dates and downloads for each version. Full release notes are available on GitHub.')}</p></header>
    <div className="releases-actions"><a className="button secondary" href={installUrl}>{t('在 Obsidian 中更新', 'Update in Obsidian')}</a><a className="plain-link" href={`${repository}/releases`} target="_blank" rel="noopener noreferrer">{t('在 GitHub 查看全部', 'All releases on GitHub')} ↗</a></div>
    <p className="releases-status" role="status">{status === 'loading' ? t('正在同步 GitHub 发布记录…', 'Syncing release history from GitHub…') : status === 'saved' ? t('暂时无法连接 GitHub，先显示已保存的发布记录。可通过下方链接查看完整说明。', 'GitHub is temporarily unavailable. Showing saved release records; the links below still open the full notes.') : t('已同步 GitHub 正式发布记录。', 'Synced with published GitHub releases.')}</p>
    <ol className="release-timeline">{releases.map((release, index) => <li key={release.version}><article className="release-entry">
      <div className="release-entry-meta"><h2><a href={release.url} target="_blank" rel="noopener noreferrer">{release.version}</a></h2><time dateTime={release.publishedAt}>{date.format(new Date(release.publishedAt))}</time>{index === 0 && status === 'live' && <span className="release-latest">{t('最新发布', 'Latest release')}</span>}</div>
      <div className="release-entry-content">{release.highlights[language].length ? <ul className="release-highlights">{release.highlights[language].map((highlight, point) => <li key={point}>{highlight}</li>)}</ul> : <p>{t('该版本的完整变更记录可在 GitHub 查看。', 'The full changelog for this version is available on GitHub.')}</p>}
        <a className="plain-link release-notes-link" href={release.url} target="_blank" rel="noopener noreferrer">{t('完整发布说明', 'Full release notes')} ↗</a>
        {release.assets.length > 0 && <div className="release-downloads" aria-label={t(`${release.version} 下载文件`, `Downloads for ${release.version}`)}>{release.assets.map(asset => <a key={asset.name} href={asset.url}>{t('下载', 'Download')} <span>{asset.name}</span> ↓</a>)}</div>}
      </div>
    </article></li>)}</ol>
    <p className="releases-install-note">{t('社区安装用户可直接在 Obsidian 中更新。手动安装时，请下载同一版本的全部插件文件，放入对应插件目录。', 'Community users can update inside Obsidian. For manual installation, download all plugin files from the same version into the plugin folder.')}</p>
  </section>;
}
