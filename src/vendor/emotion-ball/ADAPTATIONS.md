# Local integration

Upstream: <https://github.com/sam70361/aora-bot>, commit
`e3b6148c818da4a8e1966f2bc89cdb3cee473b73`.

The expression data and rendering engine are bundled locally. No remote scripts
or runtime downloads are used. The upstream LICENSE and NOTICE.md are retained
in this directory and in the generated plugin bundle.

Changes for the Obsidian host:

- Wrap the four upstream modules in a static factory, with a private namespace
  and the owning window's document, clock, timers and animation scheduler.
- Use the plugin stylesheet for static SVG layout and hidden eyes. Dynamic
  geometry, colors and effects remain driven by the original engine.
- Cancel the shared animation frame as soon as its last active instance stops.
- Use lexical `this` for the optional tour timer; remove unused variables and
  use uppercase sleep glyphs.

The integration is checked with the same recommended Obsidian ESLint rules as
the plugin source, including warnings. The upstream non-commercial restrictions
still apply to both the bundled engine and the character visuals.
