# MarkToGo

<img src="assets/icon.svg" alt="MarkToGo MTG 图标" width="80" height="80">

[English](README.md) · [Obsidian 插件目录](https://community.obsidian.md/plugins/mark-to-go)

分享 Obsidian 笔记时，不再需要把图片一起打包发给对方。**MarkToGo 通过 PicList 上传本地图片，生成使用在线图片地址的 Markdown 并复制到剪贴板，原笔记保持不变。**

## 安装插件

在 **设置 → 第三方插件 → 浏览** 中搜索 **MarkToGo**，安装并启用。也可以从 [GitHub Releases](https://github.com/scstc/mark-to-go/releases) 下载 `main.js` 和 `manifest.json`，放到 `<Vault>/.obsidian/plugins/mark-to-go/`。

仅支持桌面版。Windows 已测试，macOS / Linux 尚未实测。

## 先配置 PicList

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
3. 如果还需要文件，在结果弹窗点击 **保存到 Downloads**。**默认只复制，不自动保存文件。**

弹窗显示本次新上传和复用的数量。保存不会再次上传，原笔记和附件始终保留。

## 找不到 PicList 时

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
- 上传记录保存在 `MarkToGo/upload-cache.json`。随 Vault 同步此目录，可以跨电脑复用；不同电脑同时首次分享仍可能重复上传，没有跨设备全局锁。
- 保存目录目前需要支持硬链接，例如 NTFS；导出文件不会覆盖已有文件。
- 语言可选择 **跟随 Obsidian**、**简体中文** 或 **English**。

## 隐私说明

仅在你主动导出时，通过本机 PicList CLI 将笔记引用的本地图片上传到所配置的图床。Markdown 正文不上传到图床，不收集遥测。MarkToGo 免费，所选图床可能需要账号或产生费用。

为完成上传和按需保存，插件会访问 Vault 外的 Node.js / PicList、PicList 配置及已安装插件、临时文件，以及 Downloads 或自定义导出目录。使用临时副本保护原图片和配置，详情见[进阶说明](docs/advanced.zh-CN.md)。

## 开发说明

构建方式、缓存细节、功能限制及 TODO 见[进阶说明](docs/advanced.zh-CN.md)。版本采用 **`年份后两位.季度.第几次发版`**，例如 `26.4.1` 表示 2026 年第 4 季度首次发版，同季度下一版为 `26.4.2`。

使用 [0-BSD 许可证](LICENSE)，基于 [Obsidian 官方插件模板](https://github.com/obsidianmd/obsidian-sample-plugin)。
