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
No vault or demo content is sent to GitHub.

The guide recommends direct OSS/S3 uploads first, with PicList as an alternative.
The public guide distinguishes the current stable PicList release from OSS/S3
features that remain in development. Update this availability copy when releasing
the plugin. The website workflow only deploys the website; it never publishes a plugin release.
