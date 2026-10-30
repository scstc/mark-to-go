# MarkToGo website

Bilingual React + TypeScript website, built with Vite and deployed to GitHub Pages.
The plugin and website have separate dependencies and build outputs.

```sh
npm ci
npm run dev
npm run build
```

The deployment base is `/mark-to-go/`. Help uses hash routes such as
`/?lang=zh#guide-oss`, so deep links work on GitHub Pages without a server rewrite.
Language defaults to the browser preference and can be changed in the header.
Language preference stays in browser storage; there are no analytics.

React Bits TechText, CrystalizedBall, LightRays, AnimatedContent, Magnet,
ClickSpark, GlareHover and StarBorder retain their original
MIT + Commons Clause license and attribution. See `src/components/react-bits/NOTICE.md`.
Components are lazy-loaded; reduced motion uses a static fallback, and the header
offers a pause control. The central official Obsidian logo can trigger a visual
sharing pulse. Its unmodified source and trademark attribution are in
`public/asset-notices.txt`. Installation buttons use Magnet and StarBorder.
Homepage buttons and links trigger ClickSpark from a separate overlay, and storage
links use GlareHover. Pausing motion unmounts these effects without
resetting the demo selections. The Markdown demo runs locally and uploads nothing.
The self-hosted forest photograph and its CC0 source are listed in the asset notices.

The homepage reads public release metadata from the GitHub API to display the latest
published version. If that request fails, its link still opens GitHub's latest release.
The `#releases` page reads published releases, dates, notes and asset links from
GitHub. It excludes draft and prerelease entries, renders plain-text highlights,
and falls back to verified records in `src/release-data.ts` when GitHub is unavailable.
Refresh that snapshot from the actual release after publishing a new version.
No vault or demo content is sent to GitHub.

The bilingual 2880 x 1620 usage walkthrough uses self-hosted full-color, lossless
animated PNGs (APNG) and static PNG posters,
rendered from the Canvas timeline in `tools/usage-demo.html` at three times its
logical resolution. Display width is capped at 1440 CSS pixels for sharp 2x screens.
Versioned media URLs refresh previously cached lower-resolution files.
Its local pause button, the global motion control and reduced-motion preference
all switch to a static poster. The caption identifies it as an illustrated workflow.
High-resolution GIF exports remain available at their original public URLs.

The guide recommends direct OSS/S3 uploads first, with PicList as an alternative.
Direct OSS/S3 uploads are available from plugin version 26.4.5 and require Obsidian
1.11.4+. Existing upload choices and PicList configuration are preserved on upgrade.
The website workflow only deploys the website; it never publishes a plugin release.
