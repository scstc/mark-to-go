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
ClickSpark and GlareHover retain their original
MIT + Commons Clause license and attribution. See `src/components/react-bits/NOTICE.md`.
Components are lazy-loaded; reduced motion uses a static fallback, and the header
offers a pause control. The central official Obsidian logo can trigger a visual
sharing pulse. Its unmodified source and trademark attribution are in
`public/asset-notices.txt`. Installation buttons use Magnet, the local demo uses ClickSpark,
and storage links use GlareHover. Pausing motion unmounts these effects without
resetting the demo selections. The Markdown demo runs locally and uploads nothing.

The guide recommends direct OSS/S3 uploads first, with PicList as an alternative.
The public guide distinguishes the current stable PicList release from OSS/S3
features that remain in development. Update this availability copy when releasing
the plugin. The website workflow only deploys the website; it never publishes a plugin release.
