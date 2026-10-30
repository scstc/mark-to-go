# MarkToGo

<img src="assets/icon.svg" alt="MarkToGo MTG 图标" width="80" height="80">

[English](README.md) · [Obsidian 插件目录](https://community.obsidian.md/plugins/mark-to-go)

分享 Obsidian 笔记时，不再需要把图片一起打包发给对方。**MarkToGo 通过 PicList、阿里云 OSS 或 AWS S3 上传本地图片，生成使用在线图片地址的 Markdown 并复制到剪贴板，原笔记保持不变。**

## 安装插件

在 **设置 → 第三方插件 → 浏览** 中搜索 **MarkToGo**，安装并启用。也可以从 [GitHub Releases](https://github.com/scstc/mark-to-go/releases) 下载 `main.js` 和 `manifest.json`，放到 `<Vault>/.obsidian/plugins/mark-to-go/`。

仅支持桌面版。Windows 已测试，macOS / Linux 尚未实测。

## 选择上传方式

在 **设置 → MarkToGo → 上传方式** 中选择。升级保留之前选中的上传方式、路径和偏好；从仅支持 PicList 的版本升级时继续使用 PicList，来回切换保留三套配置。

### 阿里云 OSS 直传

需要 Obsidian **1.11.4+**、已创建的 OSS 桶，以及限定目标目录 `oss:PutObject` 权限的 RAM AccessKey，例如资源范围 `acs:oss:*:*:你的桶名/mark-to-go/*`。无需 PicList，也无需额外安装 Node.js。

1. 选择 **阿里云 OSS**，填写地域 ID（例如 `cn-hangzhou`）、Bucket 名称和 AccessKey ID。
2. 使用 Obsidian 秘密存储控件选择或新建 **AccessKey Secret**。插件配置只保存引用名称；每台设备单独配置，不要将密钥写入笔记或上传缓存。
3. **OSS 存储目录** 默认 `mark-to-go/`，可自行修改。可选填公开 HTTPS 图片地址前缀，也支持包含路径；留空使用官方 OSS 地址。

生成的是长期有效、不带签名的链接，需要桶策略或公开图片域名允许匿名读取。插件不会修改桶或对象 ACL。自定义图片地址前缀只影响分享链接，认证上传始终连接标准地域的 OSS 官方 HTTPS Endpoint。暂不支持 STS 和有时效的签名链接。

对象名称使用图片内容与扩展名的完整 SHA-256 哈希。同名但内容不同的图片使用不同地址，内容和扩展名相同则复用同一对象，不将原始文件名作为对象名发送。并发上传或清空缓存后可能再次写入同一个内容对象，开启桶版本控制时可能保留额外版本。上传读取临时快照并使用文件流；取消或超时会停止本地请求，OSS 已接收的对象仍可能保留。

**检查本地配置** 仅验证字段和密钥是否可用，不联网，不验证云端权限或图片匿名访问。首次导出后，请在浏览器中验证图片地址。

### AWS S3 直传

需要 Obsidian **1.11.4+**、已创建的 AWS S3 通用桶和 IAM 访问密钥。选择 **AWS S3**，填写区域（例如 `us-east-1`）、Bucket 和 **Access key ID**，然后在 Obsidian 秘密存储中选择或新建 **Secret access key**。默认存储目录为 `mark-to-go/`，无需 PicList 或额外安装 Node.js。

仅授予目标目录的 `s3:PutObject` 权限，例如资源范围 `arn:aws:s3:::你的桶名/mark-to-go/*`，AWS 中国分区使用 `arn:aws-cn:s3:::`。采用 SSE-KMS 加密的桶可能还需相应 KMS 权限。中国区域自动使用 `amazonaws.com.cn`，带点的桶名通过路径形式访问，避免 HTTPS 证书不匹配。

生成长期有效、不带签名的链接，需要桶策略或 CloudFront 等公开图片域名允许匿名读取。如使用图片域名，请填写 **公开图片地址前缀**。插件不会修改“阻止公共访问”、桶策略或对象 ACL。上传使用 AWS SigV4 签名，将同一图片快照的原始字节通过文件流发送至官方区域 Endpoint；缓存与 PicList、OSS 隔离，对象名称采用完整内容哈希，原始笔记保持不变。

此选项支持 AWS S3 标准 Endpoint 和长期 IAM 访问密钥，暂不支持自定义 S3 兼容 Endpoint、目录桶、STS Session Token 或临时签名链接。**检查本地配置** 不联网，也不验证 IAM 或图片公开读取权限。

### PicList

**PicList 是图片上传工具，不是图床服务。** 你需要先准备自己的图床，例如对象存储，然后在 PicList 中配置。

| 组件 | 作用 |
| --- | --- |
| 图床 | 存储上传后的图片，提供对方可以访问的在线地址。 |
| PicList 桌面版 | 配置图床地址、凭证，并选择默认图床。 |
| PicList CLI | 让 MarkToGo 调用上传功能，需要按下面的步骤单独安装。 |

1. 安装 [PicList 桌面版](https://piclist.cn/)，配置并选中默认图床。**先在 PicList 中上传一张测试图片，确认返回的地址能在浏览器中打开。**
2. 安装 [Node.js LTS](https://nodejs.org/)，然后在终端执行：

   ```sh
   npm install -g piclist
   ```

3. 启用 MarkToGo。插件会尝试自动查找 Node.js、CLI 和桌面 PicList 的配置，相关设置先留空即可。

**安装包叫 `piclist`，提供的命令叫 `picgo`。** 只安装 PicList 桌面版还不够；原版 PicGo CLI 和桌面程序 `PicList.exe` 也不能代替这里的 CLI。配置完成后，桌面 PicList 不必一直打开。

## 分享笔记

1. 在 Markdown 笔记上右键，选择带 **MTG** 图标的 **MarkToGo**。
2. 等待处理完成，直接粘贴分享版 Markdown；其中的本地图片引用已替换为图床地址。
3. Windows 上可在结果弹窗点击 **复制文件**，再到支持文件粘贴的应用中粘贴 `.md` 附件。**复制文本** 用于复制 Markdown 正文；需要保留导出文件时，选择 **保存到 Downloads**。

弹窗显示本次新上传和复用的数量。复制文件和保存都不会再次上传，原笔记和附件始终保留。默认只复制文本；**复制文件** 会在 Windows 临时目录生成与原笔记同名的分享副本，不写入 Downloads 或导出目录。关闭弹窗后仍可粘贴；下次以文件替换剪贴板时会清理上一个 MarkToGo 临时附件，其他临时副本可能留在系统临时目录。

## 找不到 PicList 时

先选择 **设置 → MarkToGo → 检查本地配置**。该检查只读取本机程序、配置和目录信息，不上传图片、不运行 PicList 插件、不创建导出目录、不修改剪贴板；不会验证图床凭证和网络连接。

打开 **设置 → MarkToGo**，仅补充自动查找失败的路径：

| 设置项 | 填写内容 |
| --- | --- |
| PicList CLI 入口 | 执行 `npm root -g`，在返回的目录后追加 `/piclist/bin/picgo`，填写完整文件路径。 |
| Node.js 路径 | `node` 或 `node.exe` 的完整路径。 |
| PicList 配置文件 | 桌面 PicList 的 `data.json`；Windows 通常为 `%APPDATA%\piclist\data.json`。 |

CLI 默认的 `~/.piclist/config.json` 是另一个文件，**请使用刚才在桌面版中验证过的配置**。上传失败时，先检查桌面 PicList 是否仍能上传、图片地址是否可以访问。更多设置及其他平台路径见[进阶说明](docs/advanced.zh-CN.md)。

## 需要了解的几点

- 支持 PNG、JPEG、GIF、WebP、SVG，以及标准 Markdown 图片、引用式图片和 Obsidian 图片嵌入；已有网络图片保留原地址。
- Excalidraw 请先导出为 PNG / SVG。HTML 图片、普通附件链接和笔记链接暂不转换。
- Obsidian `%%…%%` 注释内的图片不上传，但注释正文仍保留在分享版 Markdown 中；此功能不用于删除敏感文字。
- 多篇笔记同时分享时，以最近一次分享或手动复制操作为准；较早任务的结果仍可手动复制。
- 上传记录保存在 `MarkToGo/upload-cache.json`。随 Vault 同步此目录，可以跨电脑复用；不同电脑同时首次分享仍可能重复上传，没有跨设备全局锁。
- 保存目录目前需要支持硬链接，例如 NTFS；导出文件不会覆盖已有文件。
- 语言可选择 **跟随 Obsidian**、**简体中文** 或 **English**。

## 隐私说明

仅在你主动导出时，通过本机 PicList CLI 将笔记引用的本地图片上传到所配置的图床，或直接上传到所选阿里云 OSS、AWS S3 桶。请求包含访问密钥 ID 和本机密钥计算出的签名，不发送 Secret 本身。Markdown 正文不上传到图床，不收集遥测。MarkToGo 免费，所选图床可能需要账号或产生费用。

为完成上传和按需保存，插件会访问 Vault 外的 Node.js / PicList、PicList 配置及已安装插件、临时文件，以及 Downloads 或自定义导出目录。使用临时副本保护原图片和配置，详情见[进阶说明](docs/advanced.zh-CN.md)。

## 开发说明

构建方式、缓存细节、功能限制及 TODO 见[进阶说明](docs/advanced.zh-CN.md)。版本采用 **`年份后两位.季度.第几次发版`**，例如 `26.4.1` 表示 2026 年第 4 季度首次发版，同季度下一版为 `26.4.2`。

使用 [0-BSD 许可证](LICENSE)，基于 [Obsidian 官方插件模板](https://github.com/obsidianmd/obsidian-sample-plugin)。
