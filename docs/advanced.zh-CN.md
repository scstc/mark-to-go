# MarkToGo 进阶说明

[快速上手](../README.zh-CN.md) · [English](advanced.md)

<img src="../assets/icon.svg" alt="MarkToGo MTG icon" width="96" height="96">

[GitHub：scstc/mark-to-go](https://github.com/scstc/mark-to-go)

Export portable Markdown from Obsidian with images hosted through your local PicList CLI. Right-click a note → **MarkToGo**. The export is copied to the clipboard; saving to Downloads is optional. Original notes and attachments stay unchanged. Desktop only, with English and Simplified Chinese interfaces. Referenced local images are sent to your configured image host only when you export; note text is not uploaded and no telemetry is collected.

为 Obsidian 笔记生成可直接分享的 Markdown：右键选择 **MarkToGo**，通过本机 PicList CLI 上传图片和 SVG，替换分享版中的资源地址，并复制全文到剪贴板。需要本地文件时，再从结果弹窗点击保存。

当前版本 `26.4.2`。真实图床分享流程已在 Windows / Obsidian 1.14.4 / PicList-Core 3.0.2 环境下完成实际使用验证。

## 版本命名

采用 `年份后两位.季度.该季度第几次发版`，季度为 `1`–`4`，发版序号从 `1` 开始，每个新季度重新计数。

例如：`26.4.1` 表示 **2026 年第 4 季度第 1 次发版**；同季度下次发版为 `26.4.2`，2027 年第 1 季度首次发版为 `27.1.1`。

发布时同步更新 `package.json`、`package-lock.json`、`manifest.json` 和 `versions.json`；GitHub release 标签与版本号完全一致，不加 `v` 前缀。`versions.json` 的值是最低兼容 Obsidian 版本。

## 使用

1. 安装 Node.js 和 PicList-Core CLI：`npm install -g piclist`。它提供的命令名称是 `picgo`，请勿混用原版 PicGo CLI。
2. 在桌面 PicList 中选好默认图床，先确认该图床可以上传。
3. 安装本插件，在 **设置 → 第三方插件** 中启用 **MarkToGo**。
4. 在文件列表中右键目标 Markdown 笔记，选择带 **MTG** 图标的 **MarkToGo**。中英文界面使用相同菜单名称，命令面板也提供对应的当前笔记操作。
5. 图片处理完成后，分享版 Markdown 全文自动复制到剪贴板，默认不创建本地导出文件。
6. 如需文件，在结果弹窗点击 **Save to Downloads / 保存到 Downloads**，才会保存为 `<原文件名>.shared.md`。若设置了其他导出目录，按钮为 **Save Markdown / 保存 Markdown**。

结果窗口显示上传数量、复制状态和是否保存。保存成功后显示文件路径及“打开所在文件夹”按钮；同一窗口只保存一次，保存失败可以重试。保存使用已经生成的内容，不重新上传图片。点击“复制 Markdown”或“打开所在文件夹”成功后自动关闭窗口，操作失败时保留窗口。

结果窗口分别显示本次“新上传”和“复用”数量。已成功上传的资源会保存映射，后续分享可直接使用已有 URL。

**原笔记和本地附件始终保留。只有导出的分享版使用在线图片地址。**

## 多电脑共享上传缓存

上传映射统一保存在 Vault 根目录独立的 `MarkToGo/` 文件夹内，文件为 `MarkToGo/upload-cache.json`。无需安装独立数据库，也不依赖用户的附件目录名称。启用插件时自动创建目录和文件；记录只包含格式标识、版本、哈希与资源 URL 的映射，不保存原始 PicList 配置或密钥。

- 同一图片内容、扩展名和相同图床及处理配置可以复用，文件移动或重命名不影响匹配；图片内容变化会重新上传。
- 缓存标识不包含本机 Node.js / CLI / 配置文件路径，也排除已知界面设置和命名配置的设备 ID；不同电脑使用等效配置即可匹配。图床、凭证、图片处理或插件配置不同会产生不同标识。
- 各端需要安装包含此功能的 MarkToGo，并同步同一个 Vault。请确认同步工具包含 `MarkToGo/` 目录及其中的 JSON 文件；仅同步 `.md` 笔记无法共享映射。插件本身不提供同步服务。
- 电脑 A 上传成功并同步文件后，电脑 B 分享时会重新读取该文件，复用已有 URL，无需重启插件。同一运行进程内的写入会排队，并在写入前读取、合并最新映射，通过临时文件原子替换，避免使用旧的内存快照覆盖记录。
- 多电脑或独立进程同时修改这个文件时，仍可能发生同步冲突；需要同步工具保留并合并各端新增的映射。插件尚未提供跨设备文件合并或全局锁，不能保证并发同步后所有记录都保留。
- 一个运行中的插件实例会合并同时上传同一资源的请求。不同电脑或独立客户端在尚未同步、离线，或同时首次分享时仍可能重复上传；这不是跨设备的全局上传锁。若需要严格协调，需要统一的服务端，当前尚未实现。
- 缓存不会主动探测云端 URL 是否仍有效。云端文件被删除或链接过期时，可在插件设置中点击 **清空上传缓存**，再重新分享。清空只删除映射，保留缓存文件且不删除云端文件；同步后其他设备的记录也会相应清除。
- 成功上传后立即记录映射，因此后续资源上传或导出失败时，已经记录的图片仍可在重试时复用。缓存读写失败会给出提示，分享可以继续，但可能重复上传。

此功能只能复用已记录的成功上传；启用缓存之前上传过的图片不会自动补入映射。

## 配置

默认自动查找本机 Node.js、npm 包 `piclist` 的 CLI，以及桌面 PicList 的配置。

| 设置 | 默认行为 |
| --- | --- |
| 语言 / Language | 默认跟随 Obsidian 界面语言；可选简体中文或 English，修改后立即影响设置、右键菜单、进度及后续弹窗 |
| PicList CLI 入口 | 自动查找 `piclist/bin/picgo`；也可指定其完整路径，或 npm 生成的 `picgo.cmd` / `picgo.ps1` |
| Node.js 路径 | 自动查找外部 `node`；找不到时指定 `node.exe` 的完整路径 |
| PicList 配置文件 | Windows：`%APPDATA%\piclist\data.json`；支持指定其他桌面配置文件 |
| 导出目录 | 点击保存后才使用；默认为系统实际 Downloads 路径，支持重定向及自定义目录 |
| 单张图片上传超时 | 120 秒，可设置为 5–600 秒 |

路径支持空格、中文、`~` 和 `%环境变量%`。Obsidian 从桌面启动时的 PATH 可能与终端不同；自动查找失败时填写完整路径。

桌面 PicList 配置的默认位置：

| 平台 | 配置文件 |
| --- | --- |
| Windows | `%APPDATA%\piclist\data.json` |
| macOS | `~/Library/Application Support/piclist/data.json` |
| Linux | `$XDG_CONFIG_HOME/piclist/data.json`，未设置时使用 `~/.config/piclist/data.json` |

采用 PicList-Core 的 `picgo -c <临时配置副本> upload <临时图片副本>`，使用参数数组启动进程，Windows 下不弹终端。桌面 `PicList.exe` 不是此设置接受的 CLI 入口。

桌面 PicList 的 `data.json` 与 Core 默认的 `~/.piclist/config.json` 是不同配置。插件显式选用桌面配置，制作临时副本，避免 Core 迁移配置时修改原文件；同时复用该配置目录的已安装插件。不会调用 `init`、`set`、`use` 修改图床。

## 内容与输出约定

| 项目 | 约定 |
| --- | --- |
| 目标文件 | 处理右键选中的 Markdown，即使它不是当前打开的笔记；读取已打开编辑器中的最新内容 |
| 资源类型 | PNG、JPG、JPEG、GIF、WebP、SVG，且文件实际位于当前 Vault 内 |
| 图片语法 | 标准 Markdown 图片、引用式图片、Obsidian `![[图片.png]]`，以及 `\|300` 等显示参数 |
| 路径 | 通过 Obsidian 链接解析定位资源，支持相对路径、中文、空格及 URL 编码 |
| 去重 | 按资源内容与图床及处理配置复用上传；同名但内容不同的资源分别处理 |
| 云端地址 | 使用 CLI 明确的成功结果，只接受 HTTP(S)，拒绝 localhost、本机回环和携带账号密码的 URL |
| 已有网络图片 | 保留 HTTP(S)、协议相对 URL、`data:` 引用，不重新上传 |
| 其他内容 | 保留正文、表格、frontmatter、代码块、行内代码和普通链接 |
| 导出文件 | 默认不落盘；点击保存后写入 UTF-8，先写完整临时文件再通过独占硬链接发布，要求目标文件系统支持硬链接（Windows NTFS 已验证） |
| 文件名冲突 | 追加序号，如 `方案.shared-1.md`，不覆盖已有导出 |
| 剪贴板 | 与导出文件相同的 Markdown 全文，不是文件路径或最后一张图片的 URL |
| 平台 | 仅桌面版；Windows 已实测，macOS / Linux 尚未实测 |

导出示例：

```markdown
<!-- 本地笔记 -->
![[架构图.svg]]
![部署截图](../attachments/部署截图.png)

<!-- 分享版 -->
![架构图](https://images.example.com/architecture.svg)
![部署截图](https://images.example.com/deploy.png)
```

HTML `<img>` 保持原样，不自动上传；若其中引用本地资源，需自行处理。普通附件链接和笔记链接也保持原样，分享时仍可能依赖 Vault。目标平台需支持相应图片格式，部分平台不能渲染 SVG。

`![[drawing.excalidraw.md]]` 等不支持的嵌入会明确报错；请先导出为 SVG / PNG，再在笔记中引用。

## 失败处理与数据范围

- 分享前检查全部图片是否存在；缺失时不启动上传。
- 上传失败、超时或返回无效 URL 时中止，不生成含未处理图片的“成功版”。部分资源已上传时会说明完成数量；不删除云端已上传文件。
- 导出失败时保留原文，并提示检查 Downloads 权限或更改导出目录。
- 剪贴板失败时保留结果窗口中的分享内容，可重试复制或按需保存文件。
- 同一笔记分享期间阻止重复执行；插件卸载时取消正在运行的 CLI 进程。
- 仅在手动执行分享时调用本机 CLI，将该笔记实际引用的本地图片发送到 PicList 配置的服务。Markdown 正文不交给图床；不收集遥测。
- CLI 接收图片的临时副本，保护原附件免受图片处理或删除钩子影响；结束后清理临时配置和图片。第三方 PicList 插件仍按用户已有配置运行。
- 不在插件日志中输出密钥、完整配置或 Markdown 全文。PicList 自身的日志及剪贴板副作用由其实现决定；分享成功时插件最后复制 Markdown 全文。

## TODO 与验收

已完成：

- [x] 注册带自定义 **MTG** 图标的 Markdown 文件右键 **MarkToGo**，并提供当前笔记命令。
- [x] 打开 B、右键 A 时处理 A；读取编辑器中的最新内容。
- [x] 支持 Wiki、标准及引用式图片，处理显示参数、中文和空格路径。
- [x] 同次分享去重；跳过示例代码及已有网络图片。
- [x] 通过 PicList-Core 获取明确的逐文件成功 URL，识别“退出码为 0 但日志报错”的情况。
- [x] 复用显式桌面配置，通过临时配置及图片保护本地源文件。
- [x] 使用真实 PicList CLI 的本地存储和合成自定义图床插件完成集成测试。
- [x] 默认只复制，点击保存才写入 Downloads；重名不覆盖，保存内容与剪贴板全文相同。
- [x] Obsidian 实测 PNG / SVG、重复资源、右键目标、再次复制；原文、附件及配置哈希不变。
- [x] 提供进度、失败反馈、导出路径和仅重试复制。
- [x] 持久化资源 URL 映射，结果区分新上传与复用，并提供清空缓存入口。
- [x] 根目录独立的 MarkToGo 缓存目录随 Vault 同步；模拟独立客户端验证映射的新增、修改和删除。
- [x] 支持跟随 Obsidian、简体中文和 English，统一切换菜单、设置、进度、错误和结果弹窗。

待完成：

- [ ] 验证 macOS / Linux 及更多 PicList 插件的兼容性。
- [ ] 支持不具备硬链接能力的导出目标（例如部分网络文件系统）。
- [ ] 直接导出 Excalidraw、Mermaid 等内容为图片后分享。
- [ ] 按需求增加 HTML 图片及其他附件类型。
- [ ] 适配 Obsidian 新版声明式设置 API，使设置项可被全局设置搜索检索；当前使用普通设置页。
- [ ] 若需要严格防止多电脑同时首次上传重复，增加统一的缓存及上传协调服务。

## 开发

项目 fork 自 [Obsidian 官方插件模板](https://github.com/obsidianmd/obsidian-sample-plugin)，采用 TypeScript、npm 和 esbuild。菜单、资源解析、CLI、导出和 UI 分开实现，入口为 `src/main.ts`。

```powershell
npm ci
npm run dev
npm test
npm run test:piclist
npm run build
npm run lint
```

`npm test` 是不依赖 PicList 的自动测试；`npm run test:piclist` 要求本机已安装 `piclist` CLI，只使用临时本地存储和合成图床插件，不访问真实云端服务。

本地安装：将构建后的 `main.js` 和 `manifest.json` 复制到 `<Vault>/.obsidian/plugins/mark-to-go/`，在 Obsidian 中启用插件。开发时只重载本插件即可，无需重启 Obsidian。

发布安装：从 [GitHub Releases](https://github.com/scstc/mark-to-go/releases) 下载 `main.js` 和 `manifest.json`，放入同一插件目录并启用。社区目录收录前，请使用手动安装。

自动发版：同步四个版本文件后，推送与版本完全一致的标签，例如 `git tag 26.4.1` 和 `git push origin 26.4.1`。GitHub Actions 会校验标签、运行测试和 lint、构建，再发布公开 release，并附上 Obsidian 安装所需的独立资源文件。构建和测试失败时不会发布。

图标：`assets/icon.svg` 是彩色 **MTG** 字标，`assets/icon.png` 是 512 像素 PNG，`assets/icon-monochrome.svg` 是菜单使用的主题自适应单色版本，随构建嵌入插件，无需另行安装图标文件。

Vault 外部访问限于功能所需的 Node.js / PicList CLI、PicList 配置及插件、临时目录和导出目标。不要提交 `main.js`、`node_modules/`、用户配置或云端密钥。

## 参考

- [PicList 桌面命令与编辑器集成](https://piclist.cn/advanced)
- [PicList 配置位置与桌面/Core 区别](https://piclist.cn/configure)
- [PicList-Core 命令行参数](https://piclist.cn/core/cli)
- [Obsidian 插件开发文档](https://docs.obsidian.md)
