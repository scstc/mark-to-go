# MarkToGo

<img src="assets/icon.svg" alt="MarkToGo MTG icon" width="96" height="96">

[简体中文](README.zh-CN.md) · [GitHub Releases](https://github.com/scstc/mark-to-go/releases)

Export shareable Markdown from Obsidian with images hosted through your local **PicList CLI**. Right-click a Markdown note and choose **MarkToGo** to upload its local images, replace their links in an export, and copy the complete Markdown to the clipboard. Your original note and attachments stay unchanged.

MarkToGo is a desktop-only plugin with English and Simplified Chinese interfaces. Saving an exported file is optional. A shared cache can reuse image uploads across computers that sync the same vault.

## Requirements

- Obsidian desktop. Windows has been tested; macOS and Linux have not been tested yet.
- An external Node.js installation and the **piclist** npm package: `npm install -g piclist`. Its CLI is named `picgo`; the original PicGo CLI and the desktop PicList executable are not substitutes.
- Desktop PicList with a working default image host. Your image host may require an account or payment, depending on the provider you choose. MarkToGo itself requires neither.

## Install

Download `main.js` and `manifest.json` from the latest [GitHub release](https://github.com/scstc/mark-to-go/releases). Place both files in `<Vault>/.obsidian/plugins/mark-to-go/`, then enable **MarkToGo** in **Settings → Community plugins**. Manual installation is available while the community directory review is pending.

## Use

1. Configure your default image host in desktop PicList and confirm that it can upload an image.
2. Right-click the target Markdown note in the file explorer and choose **MarkToGo**, next to the **MTG** icon. A command for the current note is also available in the command palette.
3. The plugin resolves local image references and uploads images that are not already cached. It reads the latest editor contents for an open note, including when you right-click a different note.
4. The complete exported Markdown is copied to the clipboard. **No exported file is created automatically.**
5. To save a file, select **Save to Downloads** in the result dialog. A custom export folder changes this button to **Save Markdown**.

The result dialog reports new uploads, reused uploads, clipboard status, and whether a file has been saved. Saving uses the prepared Markdown and does not upload images again. A successful save displays the path and an **Open containing folder** button. **Copy Markdown** and **Open containing folder** close the dialog on success; failures keep it open for retry.

Saved files use UTF-8 and names such as `Note.shared.md` or `Note.shared-1.md`. Existing files are never overwritten. Saving currently requires a file system that supports hard links; Windows NTFS has been tested.

## Supported content

- Local PNG, JPG, JPEG, GIF, WebP, and SVG files located inside the vault.
- Standard Markdown images, reference-style images, and Obsidian image embeds such as `![[image.png]]` or `![[image.png|300]]`.
- Obsidian link resolution, relative paths, spaces, Unicode names, and URL-encoded paths.
- Existing HTTP(S), protocol-relative, and `data:` image references are preserved without uploading.
- Frontmatter, code blocks, inline code, ordinary links, tables, and surrounding text are preserved.

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
| PicList CLI entry | Find `piclist/bin/picgo` automatically, or specify the full entry path or its npm-generated `picgo.cmd` / `picgo.ps1` wrapper. |
| Node.js path | Find an external Node.js executable automatically; set a full path if discovery fails. |
| PicList configuration file | Use desktop PicList's configuration; on Windows, `%APPDATA%\piclist\data.json`. A custom path is supported. |
| Export folder | Use the system Downloads folder, only after you choose Save. |
| Upload timeout per image | 120 seconds; configurable from 5 to 600 seconds. |
| Shared upload cache | Clear stored mappings when necessary. Clearing does not delete cloud files. |

Paths support spaces, Unicode, `~`, and `%ENVIRONMENT_VARIABLES%`. Obsidian launched from the desktop can have a different PATH from a terminal. Specify full paths when automatic discovery fails.

Desktop PicList's `data.json` differs from the Core default `~/.piclist/config.json`. MarkToGo explicitly selects the desktop configuration and runs `picgo -c <temporary-config> upload <temporary-image>` with argument arrays. It reuses configured PicList plugins without running `init`, `set`, or `use`.

## Shared upload cache

Mappings are stored in **`MarkToGo/upload-cache.json`**, relative to the vault root. The plugin creates this independent folder automatically; it does not depend on the name or location of your attachments folder. The cache contains a format identifier, a version, and hash-to-URL mappings, without the raw PicList configuration or credentials.

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

**Network access occurs only when you explicitly export a note with uncached local images.** The local PicList CLI sends those referenced image files to the image host configured in your PicList setup. The exact provider, destination, and its account or payment requirements are determined by your configuration. Markdown note text is not sent to the image host. MarkToGo does not collect telemetry or operate a sync service.

Access outside the vault is limited to the external Node.js/PicList executables, PicList configuration and installed plugins, temporary staging folders, and the Downloads or custom export folder. These are needed to run your configured uploader and save an export when requested.

The CLI receives temporary copies of the image and configuration, protecting original attachments and settings from processing or migration hooks. Existing third-party PicList plugins still run according to your configuration. Temporary staging files are cleaned up afterward. MarkToGo does not log complete notes, configurations, or credentials. PicList's own logs and clipboard side effects are controlled by PicList; MarkToGo copies the complete export after successful processing.

The plugin verifies that all images exist before starting uploads. Missing files, failed uploads, timeouts, and invalid URLs stop the export rather than producing an incomplete success result. Already uploaded cloud files are retained. Only confirmed HTTP(S) upload results are accepted; local loopback URLs and URLs containing credentials are rejected. Uploads are cancelled when the plugin is unloaded.

## Version numbering

Versions follow **`YY.quarter.release-number`**: the final two digits of the year, a quarter from 1 to 4, and a release sequence starting at 1 within that quarter. For example, `26.4.1` is the first release in Q4 2026; the next is `26.4.2`, and the first release in Q1 2027 is `27.1.1`.

Update `package.json`, `package-lock.json`, `manifest.json`, and `versions.json` together. Git tags match the manifest version exactly, without a `v` prefix. Values in `versions.json` are minimum Obsidian versions.

Pushing a version tag triggers GitHub Actions to validate versions, run tests and lint, build the plugin, attest the build provenance, and publish the individual release assets. A manual release can also be dispatched against the version tag itself. Failed checks prevent publication.

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

Copy the built `main.js` and `manifest.json` into the plugin directory for local testing, then reload only MarkToGo. Do not commit generated `main.js`, `node_modules/`, user configuration, or credentials.

The color MTG icon is `assets/icon.svg`, with a 512-pixel PNG at `assets/icon.png`. The theme-aware monochrome menu icon, `assets/icon-monochrome.svg`, is bundled into the plugin and needs no separate installation.

## Roadmap and limitations

- Test macOS, Linux, additional PicList plugins, and more real cloud providers.
- Support export destinations without hard-link capability.
- Export Excalidraw and Mermaid directly as images.
- Support HTML images and additional attachment types.
- Adopt Obsidian's declarative settings API for global settings search; the current settings page uses the standard API.
- Add centralized coordination only if strict cross-device upload deduplication is needed.

## References

- [PicList desktop integration](https://piclist.cn/advanced)
- [PicList configuration locations](https://piclist.cn/configure)
- [PicList-Core CLI](https://piclist.cn/core/cli)
- [Obsidian developer documentation](https://docs.obsidian.md)
