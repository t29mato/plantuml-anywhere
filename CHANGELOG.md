# Changelog

All notable changes to PlantUML Anywhere are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/); versioning
follows [Semantic Versioning](https://semver.org/).

## [0.3.1] — 2026-08-29

### Changed
- Re-verified 0.3.0's syntax error diagnostics and `!include` expansion
  against the actual shipped `.vsix`/browser extension zip on a clean
  install — both still work correctly.
- Replaced the README's hero image with a real screenshot of the
  extension running inside VS Code (source on the left, live preview on
  the right), instead of a bare rendered diagram with no product
  context.
- Added this changelog.

No functional changes.

## [0.3.0] — 2026-08-27

### Added
- **Syntax error diagnostics (VS Code)**: PlantUML doesn't fail on most
  syntax errors — it renders a diagnostic image instead. The line number
  embedded in that image is now extracted and surfaced as a real VS Code
  diagnostic (Problems panel + squiggly underline under the offending
  line), instead of being left as small text inside the picture.
- **Local `!include` support (VS Code)**: `!include relative/path.puml`
  now works, including nested includes, via `vscode.workspace.fs`. Not
  supported: the browser extension, absolute paths, URLs, or bundled
  library references (`!include <awslib/...>`) — see the README's known
  limitations.

### Investigated
- Whether moving rendering to a dedicated Web Worker could eliminate the
  main-thread blocking behind large diagrams (see 0.1.1's shrink
  fallback). Found feasible with a small DOM shim — proven with working
  code, including a direct empirical demonstration that the main thread
  stays responsive during a 4.6s render — but not yet pixel-perfect for
  every diagram type. Documented as a validated candidate for a future
  dedicated implementation; no code shipped this release
  (`docs/design/worker-rendering-feasibility-spike.md`).

## [0.2.3] — 2026-08-26

### Changed
- New official logo everywhere: VS Code extension icon (128px), browser
  extension icon set (16/32/48/128px, replacing the old single-size
  icon), README (centered logo above the title), and Chrome Web Store
  submission assets. No functional changes.

## [0.2.2] — 2026-08-26

### Changed
- User-facing documentation (README, TRYING-IT, the browser extension's
  setup page) rewritten in English. No functional changes.

### Added
- Chrome Web Store submission prep under `docs/chrome-web-store/` (store
  listing copy, screenshots, manifest/privacy review, icon) — not
  published, still awaiting owner approval.

## [0.2.1] — 2026-08-25

### Changed
- Dropped the "(PoC)" suffix from the display name in both extensions,
  following the naming decision in 0.2.0. No functional changes.

## [0.2.0] — 2026-08-24

### Changed
- **Renamed the project**: PlantUML Web Preview → **PlantUML Anywhere**
  (repository renamed `plantuml-web` → `plantuml-anywhere`). Reflects the
  extension's actual scope — desktop VS Code, browser-based VS Code, and
  a standalone browser extension — rather than just "web". No functional
  changes; publisher/name/displayName/command IDs updated accordingly.
  If you have an old `.vsix` installed, uninstall it before installing
  the new one (the extension ID changed).

## [0.1.4] — 2026-08-24

### Fixed
- **Dark theme made diagrams unreadable**: PlantUML's SVG output assumes
  a white background with black lines/text. On a dark browser theme, a
  `file://` page's dark background made those lines vanish. Preview
  containers now always sit on a white card (a diagram's own
  `skinparam backgroundColor`, if set, still takes precedence). Verified
  on both the browser extension and VS Code.

## [0.1.3] — 2026-08-21

### Changed
- Investigated the "Extension host is unresponsive" warning seen while
  rendering large diagrams; found it to be a brief (20–30ms), harmless
  event, not the real problem. The real problem — the webview appearing
  frozen while a large render is in progress — now shows a "Rendering…"
  placeholder in both the VS Code and browser extensions.
- Confirmed the earlier complete-hang case on very large diagrams was
  already substantially mitigated by 0.1.2's nodesep/ranksep fix.

## [0.1.2] — 2026-08-21

### Fixed
- The 0.1.1 shrink fallback could still fail to fit diagrams dominated
  by many small nodes (grid-shaped diagrams), because their width comes
  mostly from fixed inter-node spacing, not text width. Font-size
  shrinking now also scales down `skinparam nodesep`/`ranksep`. Verified
  against a diagram at least as large as the one that originally
  triggered this bug report, in both VS Code and the browser extension.

## [0.1.1] — 2026-08-21

### Fixed
- **"Diagram too large for browser rendering" on realistic diagrams**:
  `@plantuml/core`'s TeaVM build has a hardcoded 4096px size cap that
  applies to SVG output too. Diagrams over that size now automatically
  retry at a smaller font size, with a subtle on-screen note when
  shrinking kicks in, and a clear, actionable error message (instead of
  the raw Java exception) if shrinking still isn't enough after 3
  attempts. Applies to both VS Code and the browser extension.

## [0.1.0] — 2026-08-20

Initial distributable PoC build.

- VS Code extension (desktop + browser-based, same package): renders
  local `.puml`/`.plantuml` files with no Java, no Graphviz, no server —
  `@plantuml/core`'s WASM build runs entirely client-side.
- Standalone Chrome/Brave extension: previews a local `.puml` file the
  moment it's opened via `file://`.
- Known limitations at this point (see README): no local `!include`, no
  bundled sprite libraries, and — as discovered right after this release
  — diagrams around 6388×1573px or larger failed outright (fixed in
  0.1.1).
