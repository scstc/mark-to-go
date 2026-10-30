# MarkToGo advanced guide

<img src="../assets/icon.svg" alt="MarkToGo MTG icon" width="96" height="96">

[Quick start](../README.md) · [简体中文](advanced.zh-CN.md) · [GitHub Releases](https://github.com/scstc/mark-to-go/releases)

Export shareable Markdown from Obsidian with images hosted through your local **PicList CLI** or directly in **Alibaba Cloud OSS** or **AWS S3**. Right-click a Markdown note and choose **MarkToGo** to upload its local images, replace their links in an export, and copy the complete Markdown to the clipboard. Your original note and attachments stay unchanged.

MarkToGo is a desktop-only plugin with English and Simplified Chinese interfaces. Saving an exported file is optional. A shared cache can reuse image uploads across computers that sync the same vault.

The sharing workflow has been verified in actual use with a real cloud image host on Windows, Obsidian 1.14.4, and PicList-Core 3.0.2.

## Requirements

- Obsidian desktop. Windows has been tested; macOS and Linux have not been tested yet.
- For PicList: an external Node.js installation and the **piclist** npm package (`npm install -g piclist`), plus desktop PicList with a working default host. Its CLI is named `picgo`; the original PicGo CLI and desktop executable are not substitutes.
- For direct OSS: Obsidian 1.11.4+, an existing bucket and a RAM AccessKey. See [OSS setup and permissions](../README.md#alibaba-cloud-oss-direct); no external Node.js or PicList is needed. Your host may require an account or payment.
- For direct AWS S3: Obsidian 1.11.4+, a general purpose bucket and IAM access key with `s3:PutObject` permission. See [S3 setup and permissions](../README.md#aws-s3-direct). Secrets use Obsidian SecretStorage; standard AWS endpoints are supported, including China regions.

## Install

Find **MarkToGo** in **Settings → Community plugins → Browse**, then install and enable it. For manual installation, download `main.js`, `manifest.json`, and `styles.css` from the latest [GitHub release](https://github.com/scstc/mark-to-go/releases) and place all three files in `<Vault>/.obsidian/plugins/mark-to-go/`.

## Use

1. Choose an upload method in settings. Connect an OSS or AWS S3 bucket directly, or use your existing desktop PicList host as an alternative.
2. Right-click the target Markdown note in the file explorer and choose **MarkToGo**, next to the **MTG** icon. A command for the current note is also available in the command palette.
3. The plugin resolves local image references and uploads images that are not already cached. It reads the latest editor contents for an open note, including when you right-click a different note.
4. The complete exported Markdown is copied to the clipboard. **No exported file is created automatically.**
5. On Windows, select **Copy file** to paste a `.md` attachment into an app that accepts files, or **Copy text** to copy the Markdown body again. To keep a file, select **Save to Downloads**. A custom export folder changes the save button to **Save Markdown**.

The result dialog reports the note name, new uploads, reused uploads, clipboard status, and whether a file has been saved. Copying or saving uses the prepared Markdown and does not upload images again. Copy actions keep the dialog open and update the clipboard status. A successful save displays the path and an **Open containing folder** button, which closes the dialog on success.

The latest share or explicit copy action owns the clipboard. Older exports still finish preparing but report that automatic copying was skipped. File and text writes are serialized; newer actions cancel in-progress file copying when possible. Unloading the plugin invalidates pending copies and closes its result windows. A temporary attachment that may already have reached the clipboard is retained so pasting is not broken.

**Copy file** currently requires Windows and its built-in Windows PowerShell. It creates a UTF-8 sharing copy with the original note name in the system temporary folder, without writing to Downloads or the export folder. The attachment remains available after the dialog closes. The next successful file copy attempts to remove the previous MarkToGo clipboard attachment; temporary copies replaced by text or another app may remain in the system temporary folder. File-paste support depends on the receiving app.

Saved files use UTF-8 and names such as `Note.shared.md` or `Note.shared-1.md`. Existing files are never overwritten. Saving currently requires a file system that supports hard links; Windows NTFS has been tested.

## Supported content

- Local PNG, JPG, JPEG, GIF, WebP, and SVG files located inside the vault.
- Standard Markdown images, reference-style images, and Obsidian image embeds such as `![[image.png]]` or `![[image.png|300]]`.
- Obsidian link resolution, relative paths, spaces, Unicode names, and URL-encoded paths.
- Existing HTTP(S), protocol-relative, and `data:` image references are preserved without uploading.
- Frontmatter, code blocks, inline code, ordinary links, tables, and surrounding text are preserved.
- Images in inline, multiline or unclosed Obsidian `%%` comments are excluded from uploads; the original comment text remains in the output. Markers inside code or HTML do not start Obsidian comments. Table image parameters such as `![[image.png\|300]]` are supported, and the first visible reference definition wins when labels are repeated.

For example:

```markdown
<!-- Original note -->
![[architecture.svg]]
![Screenshot](../attachments/screenshot.png)

<!-- Export -->
![architecture](https://images.example.com/architecture.svg)
![Screenshot](https://images.example.com/screenshot.png)
```

HTML `<img>` elements, ordinary attachment links, and note links remain unchanged and may still depend on the vault. Unsupported embeds such as `![[drawing.excalidraw.md]]` fail explicitly: export them to PNG or SVG before sharing. The receiving platform must support the chosen image format; some platforms do not render SVG.

## Settings

| Setting | Default behavior |
| --- | --- |
| Language | Follow Obsidian; choose English or Simplified Chinese to override. Changes apply immediately to settings, menus, progress, and subsequent dialogs. |
| Upload method | PicList for new installations; upgrades retain the selected provider. PicList, OSS and AWS S3 each keep their own configuration. |
| OSS configuration | Shown only for OSS. Region, Bucket, AccessKey ID, a SecretStorage reference, folder prefix (default `mark-to-go/`) and optional public HTTPS image base URL. |
| S3 configuration | Shown only for AWS S3. Region, Bucket, access key ID, a SecretStorage reference, folder prefix (default `mark-to-go/`) and optional public HTTPS image base URL, such as CloudFront. |
| PicList CLI entry | Find `piclist/bin/picgo` automatically, or specify the full entry path or its npm-generated `picgo.cmd` / `picgo.ps1` wrapper. |
| Node.js path | Find an external Node.js executable automatically; set a full path if discovery fails. |
| PicList configuration file | Use desktop PicList's configuration; on Windows, `%APPDATA%\piclist\data.json`. A custom path is supported. |
| Export folder | Use the system Downloads folder, only after you choose Save. |
| Upload timeout per image | 120 seconds; configurable from 5 to 600 seconds. |
| Shared upload cache | Clear stored mappings when necessary. Clearing does not delete cloud files. |

Paths support spaces, Unicode, `~`, and `%ENVIRONMENT_VARIABLES%`. Obsidian launched from the desktop can have a different PATH from a terminal. Specify full paths when automatic discovery fails.

**Check local configuration** validates the selected uploader. OSS/S3 checks validate fields and local secret availability without starting PicList. PicList checks read the CLI entry, a fixed `node --version` result and the configuration JSON/default host identifier. Shared checks inspect export folder metadata and Windows PowerShell availability. They never run PicList or its plugins, write test files, upload images or access the clipboard. They do not verify cloud permissions, network access, execution policy, clipboard availability or hard-link support. Settings are searchable on Obsidian 1.13+; older versions keep the traditional settings tab.

Default desktop PicList configuration paths:

| Platform | Configuration file |
| --- | --- |
| Windows | `%APPDATA%\piclist\data.json` |
| macOS | `~/Library/Application Support/piclist/data.json` |
| Linux | `$XDG_CONFIG_HOME/piclist/data.json`, or `~/.config/piclist/data.json` when unset |

Desktop PicList's `data.json` differs from the Core default `~/.piclist/config.json`. MarkToGo explicitly selects the desktop configuration and runs `picgo -c <temporary-config> upload <temporary-image>` with argument arrays. It reuses configured PicList plugins without running `init`, `set`, or `use`.

## Shared upload cache

Mappings are stored in **`MarkToGo/upload-cache.json`**, relative to the vault root. The plugin creates this independent folder automatically; it does not depend on the name or location of your attachments folder. The cache contains a format identifier, a version, and hash-to-URL mappings, without raw configuration or credentials. OSS/S3 entries are isolated by provider, region, bucket, prefix, account ID and public base URL. Existing PicList entries remain compatible. Rotating a secret for the same account does not invalidate cached URLs.

- Image content, extension, and effective uploader/processing configuration determine identity. Moving or renaming an image does not prevent reuse; changing its contents or relevant configuration causes another upload.
- Machine-specific CLI, Node.js, and configuration paths are excluded. Known UI settings and named-configuration device IDs are also excluded. Different image hosts, credentials, processing rules, or PicList plugin settings may produce distinct identities.
- Sync the `MarkToGo/` folder **and its JSON file** between computers. Syncing only Markdown notes is insufficient. MarkToGo does not provide a sync service.
- A running client reads the cache again on each lookup, so synced mappings can be used without restarting the plugin. Writes within one instance are queued, merge the latest file, and replace it atomically.
- Simultaneous requests for the same resource within one plugin instance share one upload. Independent clients can still upload twice before their caches sync, while offline, or when first sharing simultaneously.
- There is no cross-device global lock or automatic sync-conflict resolution. Your sync tool must preserve and merge conflicting additions. Concurrent independent writes can lose mappings.
- Successful uploads are recorded immediately, even if later resources fail. Cache failures display a warning and may cause future reuploads.
- URLs are not periodically checked. If a cloud file is removed or its URL expires, clear the cache in settings and export again. Clearing propagates through vault sync and retains cloud files.

Uploads made before caching was enabled are not imported automatically.

## Privacy and external access

**Network access occurs only when you explicitly export a note with uncached local images.** PicList sends those images to its configured host, or the plugin uploads directly to your selected OSS or AWS S3 bucket over HTTPS with the provider's V4 authentication. Requests contain your access key ID and a derived signature, not the secret itself. Secrets are resolved from Obsidian SecretStorage; plugin settings retain only their references. Markdown text is not sent to the image host. MarkToGo does not collect telemetry or operate a sync service.

Access outside the vault is limited to the external Node.js/PicList executables, PicList configuration and installed plugins, temporary staging folders, and the Downloads or custom export folder. These are needed to run your configured uploader and save an export when requested.

The CLI receives temporary copies of the image and configuration, protecting original attachments and settings from processing or migration hooks. Existing third-party PicList plugins still run according to your configuration. Temporary staging files are cleaned up afterward. MarkToGo does not log complete notes, configurations, or credentials. PicList's own logs and clipboard side effects are controlled by PicList; MarkToGo copies the complete export after successful processing.

The plugin verifies that all images exist before starting uploads. Missing files, failed uploads, timeouts, and invalid URLs stop the export rather than producing an incomplete success result. Already uploaded cloud files are retained. Only confirmed HTTP(S) upload results are accepted; local loopback URLs and URLs containing credentials are rejected. Uploads are cancelled when the plugin is unloaded.

## Version numbering

Versions follow **`YY.quarter.release-number`**: the final two digits of the year, a quarter from 1 to 4, and a release sequence starting at 1 within that quarter. For example, `26.4.1` is the first release in Q4 2026; the next is `26.4.2`, and the first release in Q1 2027 is `27.1.1`.

Update `package.json`, `package-lock.json`, `manifest.json`, and `versions.json` together. Git tags match the manifest version exactly, without a `v` prefix. Values in `versions.json` are minimum Obsidian versions.

Pushing a version tag triggers GitHub Actions to validate versions, run tests and lint, build the plugin, attest the build provenance, and publish the individual release assets. A manual release can also be dispatched against the version tag itself. Failed checks prevent publication.

Release publication also requires Windows regression checks. CI explicitly checks Node type resolution before linting. The community report for 26.4.3 had 254 unsafe-type diagnostics: 137 calls, 52 member accesses, 37 assignments, 19 arguments and 9 returns. Those exact counts were reproduced by removing Node declarations from an in-memory analysis program; the complete local type environment produced zero. They are not evidence of 254 confirmed security flaws. Filesystem and process-execution capability notices remain applicable to PicList, temporary files and file copying. The external community scanner controls when its report is refreshed.

The 26.4.5 community report contained 1,452 findings: 1,449 source-level findings, all in the independent website's `site/` directory, plus filesystem, process-execution and clipboard capability notices. No source-level finding pointed to the plugin's `src/`. From 26.4.6, the website lives in `docs/site/`, following the [scanner's documented documentation exclusion](https://github.com/obsidianmd/eslint-plugin/blob/master/docs/configuration.md#community-plugin-scanner-configuration). It has its own dependencies and build; its React and WebGL code is not bundled into the plugin. All plugin lint rules remain enabled. The three capability notices describe required functionality and may remain after the community service refreshes the report. Malware-scan availability is controlled by that service.

## Development

Based on the [official Obsidian sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin), using TypeScript, npm, and esbuild. The license is **0-BSD**; original template attribution is retained in `LICENSE`.

```sh
npm ci
npm run dev
npm test
npm run test:piclist
npm run build
npm run lint
```

`npm test` does not require PicList. `npm run test:piclist` requires the installed `piclist` CLI and uses only synthetic files, temporary local storage, and a synthetic uploader plugin. It does not use your cloud account or upload your attachments.

The documentation website is a separate project: run `npm ci` and `npm run build` from `docs/site/`. Its GitHub Pages URL stays unchanged.

Copy the built `main.js`, `manifest.json`, and `styles.css` into the plugin directory for local testing, then reload only MarkToGo. Do not commit generated `main.js`, `node_modules/`, user configuration, or credentials.

The color MTG icon is `assets/icon.svg`, with a 512-pixel PNG at `assets/icon.png`. The theme-aware monochrome menu icon, `assets/icon-monochrome.svg`, is bundled into the plugin and needs no separate installation.

## Roadmap and limitations

- Test macOS, Linux, and additional PicList plugins.
- Support export destinations without hard-link capability.
- Export Excalidraw and Mermaid directly as images.
- Support HTML images and additional attachment types.
- Settings support Obsidian 1.13+ global settings search and retain the traditional settings tab on older versions.
- Add centralized coordination only if strict cross-device upload deduplication is needed.

## References

- [PicList desktop integration](https://piclist.cn/advanced)
- [PicList configuration locations](https://piclist.cn/configure)
- [PicList-Core CLI](https://piclist.cn/core/cli)
- [Obsidian developer documentation](https://docs.obsidian.md)
