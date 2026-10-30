export type Language = 'zh' | 'en';
export type GuideId = 'install' | 'piclist' | 'oss' | 's3' | 'sharing' | 'faq' | 'privacy';
export const repository = 'https://github.com/scstc/mark-to-go';
export const installUrl = 'obsidian://show-plugin?id=mark-to-go';
export const text = (language: Language, zh: string, en: string) => language === 'zh' ? zh : en;

export interface Guide {
  id: GuideId;
  title: string;
  intro: string;
  steps: { title: string; body: string }[];
  fields?: { name: string; value: string; description: string }[];
  links: { label: string; href: string }[];
  note?: string;
}

export function guides(language: Language): Guide[] {
  const t = (zh: string, en: string) => text(language, zh, en);
  return [
    { id: 'install', title: t('安装与开始', 'Install and start'),
      intro: t('推荐使用阿里云 OSS 或 AWS S3 直连，在插件里填写桶与密钥即可，无需额外安装 PicList 或 Node.js。PicList 保留为备选方式。', 'Prefer a direct Alibaba Cloud OSS or AWS S3 connection. Configure your bucket and credentials inside the plugin, with no separate PicList or Node.js installation. PicList remains an alternative.'),
      steps: [
        { title: t('从社区安装', 'Install from the community'), body: t('打开 Obsidian → 设置 → 第三方插件 → 浏览，搜索 MarkToGo，安装并启用。也可以使用下方安装链接。', 'Open Obsidian → Settings → Community plugins → Browse. Search for MarkToGo, install and enable it, or use the install link below.') },
        { title: t('优先选择直连', 'Prefer a direct connection'), body: t('支持直连的版本中，优先选择阿里云 OSS 或 AWS S3；已有 PicList 配置或需要其他图床时，再选择 PicList。升级会保留原有上传方式和配置，不会自动切换。', 'In a build with direct uploads, choose Alibaba Cloud OSS or AWS S3 first. Use PicList if you already have a setup or need another host. Upgrades preserve your selected method and settings; they do not switch providers automatically.') },
        { title: t('导出第一篇笔记', 'Export your first note'), body: t('在 Markdown 笔记上右键选择 MarkToGo。插件上传引用的本地图片，复制可分享的 Markdown；原文与附件保持不变。', 'Right-click a Markdown note and select MarkToGo. The plugin uploads referenced local images and copies shareable Markdown. Your note and attachments stay unchanged.') },
      ], links: [{ label: t('在 Obsidian 中安装', 'Install in Obsidian'), href: installUrl }, { label: t('下载稳定版', 'Download the stable release'), href: repository + '/releases/latest' }, { label: t('OSS 直连（推荐）', 'OSS direct (recommended)'), href: '#guide-oss' }, { label: t('S3 直连（推荐）', 'S3 direct (recommended)'), href: '#guide-s3' }, { label: t('PicList（备选）', 'PicList (alternative)'), href: '#guide-piclist' }],
      note: t('OSS/S3 直连仍为开发预览，当前社区稳定版 26.4.4 使用 PicList。仅支持桌面版，Windows 已验证；复制文件仅支持 Windows，macOS 与 Linux 尚未实测。', 'Direct OSS/S3 is still a development preview; the current community release, 26.4.4, uses PicList. Desktop only. Tested on Windows; Copy file requires Windows. macOS and Linux have not been tested.') },
    { id: 'oss', title: t('阿里云 OSS 直传', 'Direct Alibaba Cloud OSS'),
      intro: t('开发版功能。直接连接 OSS，无需 PicList 或额外安装 Node.js。需要 Obsidian 1.11.4 及以上。', 'Development feature. Connect directly to OSS without PicList or a separate Node.js installation. Requires Obsidian 1.11.4+.'),
      steps: [
        { title: t('找到桶和地域', 'Find your bucket and region'), body: t('打开 OSS 控制台，进入你的 Bucket，查看地域 ID。例如北京为 cn-beijing，杭州为 cn-hangzhou。不要填写完整 Endpoint。', 'Open the OSS console and select your bucket. Find its region ID, such as cn-beijing or cn-hangzhou. Enter the ID, not the full endpoint.') },
        { title: t('创建 RAM 访问密钥', 'Create a RAM access key'), body: t('为 RAM 用户授予目标目录的 oss:PutObject 权限。AccessKey ID 填入插件；AccessKey Secret 通过 Obsidian 秘密存储保存。', 'Grant a RAM user oss:PutObject on the target prefix. Enter the AccessKey ID in the plugin and store the AccessKey Secret through Obsidian secret storage.') },
        { title: t('确认图片可以分享', 'Make images readable'), body: t('长期链接需要桶策略或公开图片域名允许匿名读取。如果使用 CDN，填写公开图片地址前缀；上传仍走官方 OSS Endpoint，插件不会修改 ACL。', 'Permanent links require anonymous reads through a bucket policy or public image domain. Set the public image base URL for a CDN. Uploads still use the official OSS endpoint; the plugin never changes ACLs.') },
      ], fields: [
        { name: t('地域', 'Region'), value: 'cn-beijing', description: t('与 Bucket 所在地域一致。', 'Must match your bucket region.') },
        { name: 'Bucket', value: 'your-bucket', description: t('填写桶名称，不包含域名。', 'Bucket name without a hostname.') },
        { name: 'AccessKey ID / Secret', value: t('在本机填写', 'Enter locally'), description: t('不要将密钥发给他人或写进笔记。', 'Keep credentials local; do not put them in notes.') },
        { name: t('存储目录', 'Folder'), value: 'mark-to-go/', description: t('可修改，留空使用桶根目录。', 'Optional prefix; blank uses the bucket root.') },
        { name: t('公开图片地址', 'Public image URL'), value: 'https://images.example.com', description: t('可选；留空使用 OSS 官方地址。', 'Optional; blank uses the official OSS URL.') },
      ], links: [{ label: t('打开 OSS 控制台', 'Open OSS console'), href: 'https://oss.console.aliyun.com/' }, { label: t('管理 RAM 用户', 'Manage RAM users'), href: 'https://ram.console.aliyun.com/users' }, { label: t('地域与 Endpoint', 'Regions and endpoints'), href: 'https://help.aliyun.com/zh/oss/user-guide/regions-and-endpoints' }],
      note: t('密钥弹窗中的 ID 是自定义名称，例如 aliyun-oss-secret，不是 AccessKey ID。Secret 一栏填写真正的 AccessKey Secret。暂不支持 STS 或临时签名链接。', 'The ID in the secret dialog is a name you choose, such as aliyun-oss-secret, not your AccessKey ID. Put the actual AccessKey Secret in Secret. STS and expiring signed links are not supported.') },
    { id: 's3', title: t('AWS S3 直传', 'Direct AWS S3'),
      intro: t('开发版功能。支持 AWS 官方 S3 通用桶，包括中国区域，使用 AWS SigV4 签名。', 'Development feature. Supports official AWS S3 general purpose buckets, including China regions, with AWS SigV4 authentication.'),
      steps: [
        { title: t('确认桶所在区域', 'Check your bucket region'), body: t('在 S3 控制台找到桶名称和区域，例如 us-east-1。中国区域例如 cn-north-1，会自动使用 AWS 中国 Endpoint。', 'Find the bucket name and region in the S3 console, such as us-east-1. China regions such as cn-north-1 automatically use AWS China endpoints.') },
        { title: t('配置 IAM 访问密钥', 'Configure IAM credentials'), body: t('授予目标目录的 s3:PutObject 权限，例如 arn:aws:s3:::your-bucket/mark-to-go/*。填写 Access key ID，通过 Obsidian 秘密存储选择 Secret access key。', 'Grant s3:PutObject on the target prefix, such as arn:aws:s3:::your-bucket/mark-to-go/*. Enter the access key ID and select a secret access key through Obsidian secret storage.') },
        { title: t('配置公开访问地址', 'Set the public image URL'), body: t('通过桶策略或 CloudFront 提供匿名图片访问。插件不会关闭“阻止公共访问”或修改桶策略。使用 CloudFront 时，填入其公开 HTTPS 地址。', 'Allow anonymous image reads through a bucket policy or CloudFront. The plugin does not disable Block Public Access or edit policies. Enter the public HTTPS base URL when using CloudFront.') },
      ], fields: [
        { name: t('区域', 'Region'), value: 'us-east-1', description: t('签名区域必须与桶一致。', 'The signing region must match your bucket.') },
        { name: 'Bucket', value: 'your-bucket', description: t('通用桶名称；带点的名称使用路径形式访问。', 'A general purpose bucket; dotted names use path-style HTTPS.') },
        { name: 'Access key ID / Secret', value: t('在本机填写', 'Enter locally'), description: t('使用长期 IAM 密钥。', 'Use a long-term IAM access key.') },
        { name: t('存储目录', 'Folder'), value: 'mark-to-go/', description: t('与 IAM 授权资源范围保持一致。', 'Match the prefix allowed by your IAM policy.') },
      ], links: [{ label: t('S3 控制台', 'S3 console'), href: 'https://console.aws.amazon.com/s3/home' }, { label: t('IAM 用户', 'IAM users'), href: 'https://console.aws.amazon.com/iam/home#/users' }, { label: t('AWS 中国控制台', 'AWS China console'), href: 'https://console.amazonaws.cn/s3/home' }],
      note: t('暂不支持 R2、MinIO 等自定义 Endpoint、STS Session Token 或目录桶。SSE-KMS 桶还可能需要 KMS 权限。S3 实桶验证需使用你自己的凭证。', 'Custom endpoints such as R2 or MinIO, STS session tokens and directory buckets are not supported. SSE-KMS buckets may need KMS permissions. Verify real uploads using your own credentials.') },
    { id: 'piclist', title: t('PicList（备选）', 'PicList (alternative)'),
      intro: t('已有 PicList 配置或需要其他图床时，可选择这条备选路线，继续使用熟悉的图床与插件。升级后保留已有配置。', 'Use this alternative if you already have PicList set up or need another host. Keep your existing hosts and PicList plugins; upgrades preserve your settings.'),
      steps: [
        { title: t('先配置图床', 'Connect your image host'), body: t('安装 PicList 桌面版，填好图床配置并选为默认图床。先在 PicList 中上传一张图片，确认链接可公开访问。', 'Install PicList desktop, configure your image host and select it as default. Upload a test image in PicList and confirm its URL is publicly accessible.') },
        { title: t('安装命令行工具', 'Install the command-line tool'), body: t('安装 Node.js LTS，在终端执行 npm install -g piclist。安装包叫 piclist，命令叫 picgo；桌面程序不能代替 CLI。', 'Install Node.js LTS and run npm install -g piclist in a terminal. The package is piclist, but the command is picgo. The desktop executable cannot replace the CLI.') },
        { title: t('检查本地配置', 'Check local configuration'), body: t('在 MarkToGo 设置中选择 PicList，先将路径留空，让插件自动查找。遇到问题时点击“检查本地配置”，再补全需要的路径。', 'Select PicList in MarkToGo settings and initially leave paths blank for automatic discovery. Use Check local configuration to find out which paths need attention.') },
      ], fields: [
        { name: t('PicList CLI 入口', 'PicList CLI entry'), value: 'piclist/bin/picgo', description: t('运行 npm root -g，在结果后追加此路径。', 'Append this path to the result of npm root -g.') },
        { name: t('Node.js 路径', 'Node.js path'), value: 'node.exe', description: t('自动查找失败时填写完整可执行文件路径。', 'Enter the full executable path if discovery fails.') },
        { name: t('配置文件', 'Configuration file'), value: '%APPDATA%\\piclist\\data.json', description: t('Windows 桌面配置；与 ~/.piclist/config.json 不同。', 'Windows desktop configuration; different from ~/.piclist/config.json.') },
      ], links: [{ label: t('PicList 官网', 'PicList website'), href: 'https://piclist.cn/' }, { label: 'Node.js LTS', href: 'https://nodejs.org/' }],
      note: t('检查本地配置不会上传图片，不会运行 PicList 插件，也不会验证图床凭证或网络。', 'Local checks do not upload images, run PicList plugins or test host credentials and connectivity.') },
    { id: 'sharing', title: t('分享与缓存', 'Sharing and caching'),
      intro: t('一次导出，得到可直接粘贴的 Markdown。需要附件时，再选择复制文件。', 'Export once to get Markdown ready to paste. Choose Copy file when you need an attachment.'),
      steps: [
        { title: t('复制文本或文件', 'Copy text or a file'), body: t('复制文本会复制 Markdown 正文。Windows 的复制文件会制作临时 .md 附件，不写入 Downloads；要长期保存时，点击保存按钮。', 'Copy text copies the Markdown body. On Windows, Copy file creates a temporary .md attachment without saving to Downloads. Use Save when you want to keep a file.') },
        { title: t('复用已经上传的图片', 'Reuse uploaded images'), body: t('映射保存在 Vault 的 MarkToGo/upload-cache.json。同步目录及文件即可跨设备复用；同时首次上传没有跨设备全局锁。', 'Mappings live in MarkToGo/upload-cache.json inside your vault. Sync the folder and file to reuse uploads across devices. Simultaneous first uploads have no cross-device lock.') },
        { title: t('保持原始内容', 'Preserve the originals'), body: t('原笔记、附件、已有 HTTPS 图片地址保持不变。PNG、JPEG、GIF、WebP、SVG，普通 Markdown 图片、引用式图片和 Obsidian 嵌入均可处理。', 'Original notes, attachments and existing HTTPS image links stay unchanged. PNG, JPEG, GIF, WebP, SVG, Markdown images, reference images and Obsidian image embeds are supported.') },
      ], links: [{ label: t('阅读进阶说明', 'Read the advanced guide'), href: repository + '/blob/master/docs/advanced' + (language === 'zh' ? '.zh-CN' : '') + '.md' }],
      note: t('OSS/S3 对象按完整内容哈希命名，同名不同内容不会重名覆盖。清空缓存不删除云端文件。Obsidian %% 注释正文仍会保留在导出中，不用于脱敏。', 'OSS/S3 object names use full content hashes, so different image contents do not collide by filename. Clearing the cache does not delete cloud files. Obsidian %% comment text remains in exports; this is not a redaction tool.') },
    { id: 'faq', title: t('常见问题', 'Common questions'),
      intro: t('从配置、访问权限和链接检查开始，通常就能找到原因。', 'Start with configuration, read permissions and the generated image URL.'),
      steps: [
        { title: t('上传成功，别人却看不到图片？', 'Uploads work, but others cannot see images?'), body: t('上传权限和公开读取权限是两回事。用未登录的浏览器打开图片链接，检查桶策略、CDN、域名和防盗链设置。', 'Upload permission and public read permission are separate. Open the image URL in a signed-out browser and check bucket policies, CDN settings, domains and hotlink protection.') },
        { title: t('密钥弹窗里的 ID 填什么？', 'What is the ID in the secret dialog?'), body: t('这是 Obsidian 中给密钥起的名称，可以用 aliyun-oss-secret 或 aws-s3-secret，仅用小写字母、数字和连字符。它不是云厂商的 AccessKey ID。', 'It names a secret in Obsidian. Use something like aliyun-oss-secret or aws-s3-secret, with lowercase letters, digits and hyphens. It is not your cloud access key ID.') },
        { title: t('已有外链图片会重新上传吗？', 'Are existing online images uploaded again?'), body: t('不会。HTTP(S)、协议相对地址和 data: 图片保持原样；没有本地图片时无需图床凭证，也不发起上传。', 'No. HTTP(S), protocol-relative and data: images remain unchanged. Notes without local images require no host credentials and trigger no upload.') },
        { title: t('为什么设置里没有 OSS 或 S3？', 'Why are OSS and S3 missing in settings?'), body: t('官网包含下一版的开发说明。当前社区稳定版 26.4.4 使用 PicList；等待相应版本发布后，在 Obsidian 中更新插件。', 'This guide also covers the next version in development. The current community release, 26.4.4, uses PicList. Update the plugin in Obsidian once the new version is published.') },
      ], links: [{ label: t('提交问题', 'Report an issue'), href: repository + '/issues' }], },
    { id: 'privacy', title: t('隐私与权限', 'Privacy and permissions'),
      intro: t('只有你主动导出，才会将引用的本地图片发送到所选存储服务。', 'Referenced local images are sent to your chosen host only when you explicitly export.'),
      steps: [
        { title: t('什么会发送到云端', 'What is uploaded'), body: t('引用的本地图片会上传到你配置的图床。Markdown 正文不会发送，插件没有遥测或内置分析。图床服务可能产生费用。', 'Referenced local images go to your configured host. Markdown text is not sent. The plugin has no telemetry or analytics. Storage providers may charge for their services.') },
        { title: t('凭证如何保存', 'How credentials are stored'), body: t('OSS/S3 密钥使用 Obsidian SecretStorage，插件设置仅保存引用名称。缓存不保存原始配置或密钥。签名请求不会发送 Secret 本身。', 'OSS/S3 secrets use Obsidian SecretStorage; plugin settings store reference names. The cache stores neither raw configuration nor secrets. Signed requests do not transmit the secret itself.') },
        { title: t('为什么需要文件系统与子进程', 'Why filesystem and subprocess access'), body: t('PicList 调用、图片临时副本、Windows 文件剪贴板以及按需保存导出需要这些能力。OSS/S3 直传不会启动 PicList，但插件仍包含文件复制等功能。', 'PicList integration, temporary image snapshots, the Windows file clipboard and optional export saving require these capabilities. OSS/S3 uploads do not start PicList; the plugin still contains file-copy features.') },
      ], links: [{ label: t('查看源码', 'View source'), href: repository }],
      note: t('官网不收集分析数据。语言和动效偏好只保存在当前浏览器，演示中的内容不会上传。', 'The website has no analytics. Language and motion preferences stay in your browser. Demo content is never uploaded.') },
  ];
}
