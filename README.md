# MarkToGo

<img src="assets/icon.svg" alt="MarkToGo MTG icon" width="80" height="80">

[简体中文](README.zh-CN.md) · [Obsidian directory](https://community.obsidian.md/plugins/mark-to-go)

Share an Obsidian note without sending its images separately. **MarkToGo uploads local images through PicList and copies Markdown with online image links. Your original note stays unchanged.**

## Install

Find **MarkToGo** in **Settings → Community plugins → Browse**, then install and enable it. Alternatively, download `main.js` and `manifest.json` from [GitHub Releases](https://github.com/scstc/mark-to-go/releases) into `<Vault>/.obsidian/plugins/mark-to-go/`.

Desktop only. Windows has been tested; macOS and Linux have not yet been tested.

## Set up PicList first

**PicList is an image uploader, not an image hosting service.** You need an image host of your own, such as an object storage bucket, and configure it in PicList.

| Component | What it does |
| --- | --- |
| Image host | Stores the uploaded images and provides URLs recipients can access. |
| PicList desktop | Lets you configure your image host, credentials, and default uploader. |
| PicList CLI | Lets MarkToGo upload images using that configuration. Install it separately below. |

1. Install [PicList desktop](https://piclist.cn/), configure your image host, and select it as the default. **Upload a test image in PicList and make sure its URL opens in a browser.**
2. Install [Node.js LTS](https://nodejs.org/), then run this in a terminal:

   ```sh
   npm install -g piclist
   ```

3. Enable MarkToGo. It tries to find Node.js, the CLI, and your desktop PicList configuration automatically. Leave those settings blank initially.

**The npm package is named `piclist`, but its command is named `picgo`.** Installing desktop PicList alone is not enough. The original PicGo CLI and `PicList.exe` are not the CLI this plugin expects. After configuration, the desktop app does not need to stay open.

## Share a note

1. Right-click a Markdown note and choose **MarkToGo** next to the **MTG** icon.
2. Paste the copied Markdown wherever you want to share it. Local image links in this copy now point to your image host.
3. On Windows, select **Copy file** in the result dialog to paste a `.md` attachment into an app that accepts files. **Copy text** copies the Markdown body instead. Select **Save to Downloads** to keep an exported file.

The dialog shows new and reused uploads. Copying a file or saving does not upload again; original notes and attachments are preserved. By default, only text is copied. **Copy file** uses a Windows temporary file with the original note name, without writing to Downloads or the export folder. Closing the dialog keeps the attachment available for pasting. The previous MarkToGo temporary attachment is removed when another file replaces it; other temporary copies may remain in the system temporary folder.

## If PicList cannot be found

Open **Settings → MarkToGo** and fill in only the paths that automatic discovery could not find:

| Setting | What to enter |
| --- | --- |
| PicList CLI entry | Run `npm root -g`, then append `/piclist/bin/picgo` to that directory. Enter the full file path. |
| Node.js path | The full path to `node` or `node.exe`. |
| PicList configuration file | Your desktop PicList `data.json`; on Windows, usually `%APPDATA%\piclist\data.json`. |

The CLI's default `~/.piclist/config.json` is a different file. **Use the desktop configuration you already tested.** If upload fails, first confirm desktop PicList can still upload and that the resulting image URL is accessible. See the [advanced guide](docs/advanced.md) for more settings and platform paths.

## Good to know

- Supports PNG, JPEG, GIF, WebP, SVG, standard Markdown images, reference images, and Obsidian image embeds. Existing online image links are preserved.
- Excalidraw notes must be exported to PNG/SVG first. HTML images, ordinary attachment links, and note links are not converted.
- Upload mappings are stored in `MarkToGo/upload-cache.json`. Sync this folder with your vault to reuse uploads on other computers. Simultaneous first uploads can still duplicate; there is no cross-device lock.
- Saving currently requires a file system with hard-link support, such as NTFS. Exported files never overwrite existing ones.
- Choose **Follow Obsidian**, **English**, or **简体中文** in the language setting.

## Privacy

Only an explicit export sends referenced local images, through your PicList CLI, to your configured image host. Note text is not uploaded to the image host, and MarkToGo collects no telemetry. MarkToGo is free; your chosen host may require an account or payment.

To upload and save exports, the plugin accesses Node.js/PicList, your PicList configuration and installed plugins, temporary files, and Downloads or your chosen export folder outside the vault. Temporary copies protect the original images and configuration. See the [advanced guide](docs/advanced.md) for details.

## Development

Build, cache behavior, limitations, and the roadmap are in the [advanced guide](docs/advanced.md). Versions follow **`YY.quarter.release-number`**: `26.4.1` means the first release in Q4 2026, followed by `26.4.2`.

[0-BSD license](LICENSE). Based on the [official Obsidian sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin).
