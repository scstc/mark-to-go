import { repository } from './content';
import type { Language } from './content';

export interface Release {
  version: string;
  publishedAt: string;
  url: string;
  highlights: Record<Language, string[]>;
  assets: { name: string; url: string }[];
}

// Dates, assets and highlights verified against GitHub Releases and their linked commits.
export const savedReleases: Release[] = [
  {
    version: '26.4.6', publishedAt: '2026-10-30T07:15:59Z', url: `${repository}/releases/tag/26.4.6`,
    highlights: {
      zh: ['将独立官网移至文档目录，修正社区扫描将官网代码纳入插件检查的问题。', '同步官网部署与 README 图片路径，保留公开地址、动效和高清使用动画。', '保留插件类型检查、lint 和回归测试；文件系统、子进程与剪贴板能力提示仍可能显示。'],
      en: ['Move the independent website into the documentation directory to correct community scan scope.', 'Update deployment and README image paths while preserving public URLs, effects and HD walkthroughs.', 'Retain plugin type checks, lint and regression tests; filesystem, process and clipboard capability notices may remain.'],
    },
    assets: ['main.js', 'manifest.json', 'styles.css'].map(name => ({ name, url: `${repository}/releases/download/26.4.6/${name}` })),
  },
  {
    version: '26.4.5', publishedAt: '2026-10-30T06:19:11Z', url: `${repository}/releases/tag/26.4.5`,
    highlights: {
      zh: ['新增阿里云 OSS 与 AWS S3 直连，无需额外安装 PicList 或 Node.js。', '采用 V4/SigV4 签名与 Obsidian 秘密存储，支持 AWS 中国区域和公开图片域名。', '图片使用完整内容哈希命名，缓存按上传方式与目标桶隔离。', '升级保留原有 PicList 配置，设置新增帮助与云控制台快捷入口。'],
      en: ['Add direct Alibaba Cloud OSS and AWS S3 uploads without a separate PicList or Node.js installation.', 'Use V4/SigV4 authentication and Obsidian secret storage, with AWS China regions and public image domains.', 'Name images by full content hashes and isolate caches by uploader and destination bucket.', 'Preserve existing PicList configuration and add settings help and cloud console shortcuts.'],
    },
    assets: ['main.js', 'manifest.json', 'styles.css'].map(name => ({ name, url: `${repository}/releases/download/26.4.5/${name}` })),
  },
  {
    version: '26.4.4', publishedAt: '2026-10-27T14:29:56Z', url: `${repository}/releases/tag/26.4.4`,
    highlights: {
      zh: ['修复隐藏注释、表格图片参数和引用定义的处理边界。', '协调自动导出与手动复制，避免较早操作覆盖剪贴板。', '新增本地配置诊断，并加强 Windows 回归与发布检查。'],
      en: ['Fix image handling in hidden comments, table parameters and reference definitions.', 'Coordinate exports and manual copying so older actions do not overwrite the clipboard.', 'Add local configuration diagnostics and strengthen Windows regression and release checks.'],
    },
    assets: ['main.js', 'manifest.json'].map(name => ({ name, url: `${repository}/releases/download/26.4.4/${name}` })),
  },
  {
    version: '26.4.3', publishedAt: '2026-10-23T08:38:49Z', url: `${repository}/releases/tag/26.4.3`,
    highlights: {
      zh: ['Windows 支持直接复制 .md 文件附件，无需先保存到 Downloads。', '将复制正文改名为“复制文本”，区分文本与文件附件。', '完善结果状态和中英文社区安装说明。'],
      en: ['Copy a .md file attachment on Windows without saving it to Downloads first.', 'Rename the body-copy action to Copy text to distinguish it from file copying.', 'Improve result feedback and bilingual community installation instructions.'],
    },
    assets: ['main.js', 'manifest.json'].map(name => ({ name, url: `${repository}/releases/download/26.4.3/${name}` })),
  },
  {
    version: '26.4.2', publishedAt: '2026-10-21T06:16:39Z', url: `${repository}/releases/tag/26.4.2`,
    highlights: {
      zh: ['新增英文文档，完善社区审核资料。', '为发布产物添加构建来源证明。', '支持对已有版本标签手动运行 CI 与发布流程。'],
      en: ['Add English documentation and community review information.', 'Attest the provenance of release assets.', 'Allow manual CI and release runs for existing version tags.'],
    },
    assets: ['main.js', 'manifest.json'].map(name => ({ name, url: `${repository}/releases/download/26.4.2/${name}` })),
  },
  {
    version: '26.4.1', publishedAt: '2026-10-21T06:07:37Z', url: `${repository}/releases/tag/26.4.1`,
    highlights: {
      zh: ['通过 PicList 上传本地图片，生成可分享的 Markdown。', '保留原始笔记与附件，提供复制和按需保存。', '在 Vault 中共享上传缓存，复用已有图片链接。'],
      en: ['Upload local images through PicList and create shareable Markdown.', 'Keep original notes and attachments, with copying and optional saving.', 'Reuse uploaded image URLs through a shared cache in the vault.'],
    },
    assets: ['main.js', 'manifest.json'].map(name => ({ name, url: `${repository}/releases/download/26.4.1/${name}` })),
  },
];

function highlightsFromBody(body: string, language: Language): string[] {
  const heading = language === 'zh' ? '简体中文' : 'English';
  const sections = body.split(/^##\s+/m).slice(1);
  const section = sections.find(part => part.startsWith(heading)) ?? sections.find(part => {
    const title = part.split('\n')[0] ?? '';
    return language === 'zh' ? /[\u3400-\u9fff]/.test(title) : /^[A-Za-z]/.test(title);
  }) ?? body;
  return section.split('\n').filter(line => /^[-*]\s+/.test(line)).slice(0, 5).map(line => line
    .replace(/^[-*]\s+/, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .trim());
}

export function releasesFromApi(input: unknown): Release[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item: unknown): Release[] => {
    if (!item || typeof item !== 'object') return [];
    const data = item as Record<string, unknown>;
    if (data.draft !== false || data.prerelease !== false || typeof data.tag_name !== 'string' || typeof data.published_at !== 'string' || !Number.isFinite(Date.parse(data.published_at))) return [];
    const version = data.tag_name;
    const known = savedReleases.find(release => release.version === version);
    const body = typeof data.body === 'string' ? data.body : '';
    const highlights = known?.highlights ?? { zh: highlightsFromBody(body, 'zh'), en: highlightsFromBody(body, 'en') };
    const assets = Array.isArray(data.assets) ? data.assets.flatMap((asset: unknown) => {
      if (!asset || typeof asset !== 'object') return [];
      const entry = asset as Record<string, unknown>;
      if (typeof entry.name !== 'string' || typeof entry.browser_download_url !== 'string' || !entry.browser_download_url.startsWith(`${repository}/releases/download/`)) return [];
      return [{ name: entry.name, url: entry.browser_download_url }];
    }) : [];
    return [{ version, publishedAt: data.published_at, url: `${repository}/releases/tag/${encodeURIComponent(version)}`, highlights, assets }];
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
