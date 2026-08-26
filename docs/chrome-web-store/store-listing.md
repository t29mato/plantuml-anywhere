# Chrome Web Store listing copy

Ready-to-paste text for the Developer Dashboard. Character counts are measured
with `wc -c` (UTF-8 bytes); the visible text is plain ASCII so it matches the
Store's character count exactly.

## Summary (short description)

> Limit: 132 characters. Current length: 103.

```
Preview local PlantUML diagrams instantly in your browser — no Java, no Graphviz, no server required.
```

## Detailed description

```
PlantUML Anywhere renders .puml and .plantuml files the moment you open them
with file:// — no Java, no Graphviz, no PlantUML server, and nothing is
uploaded anywhere. Everything runs locally in your browser.

HOW IT WORKS
Open a local .puml or .plantuml file in Chrome or Brave and the diagram
renders in place. Class diagrams, sequence diagrams, and everything else
PlantUML supports. The extension uses @plantuml/core, the PlantUML engine
compiled to JavaScript (TeaVM) with its Graphviz layout engine compiled to
WebAssembly — no native binaries, no background service, no network calls.

WHY THIS EXISTS
Most PlantUML tools either require you to install Java and Graphviz locally,
or send your diagram source to a remote rendering server. Neither is great
if you just want to glance at a diagram, or if the file contains anything
you'd rather not send elsewhere. This extension avoids both: the rendering
engine ships inside the extension itself.

PRIVACY
Diagram source is read only from the local file you open, rendered entirely
in your browser, and never leaves your machine. The extension makes no
network requests.

SETUP NOTE
Browsers block extensions from reading file:// pages by default. After
installing, a one-time setup page walks you through enabling "Allow access
to file URLs" for this extension — without it, the preview won't appear.

LIMITATIONS
- No !include across multiple files (browser extensions can't read the
  filesystem beyond the open tab)
- No bundled sprite libraries (AWS/Material/tupadr3 icon sets, etc.)
- No export, snippets, or multi-page diagrams
- Renders once per open/reload; no live preview while typing

Source, issue tracker, and a VS Code extension built on the same rendering
engine: https://github.com/t29mato/plantuml-anywhere
```

## Category

Developer Tools

## Language

English

## Privacy practices tab (Developer Dashboard)

See [`manifest-v3-review.md`](manifest-v3-review.md) for the permission
justifications and data-usage declarations to fill in on the "Privacy
practices" tab.

## Assets

| Requirement | File | Notes |
|---|---|---|
| Store icon (128×128) | [`icon-128.png`](icon-128.png) | Same icon shipped in the extension package |
| Screenshot 1 (1280×800) | [`screenshots/class-diagram.png`](screenshots/class-diagram.png) | Real capture of the extension rendering a class diagram (Playwright, actual `browser-extension/` build); cropped and centered on a plain canvas for a clean listing image — no fabricated UI |
| Screenshot 2 (1280×800) | [`screenshots/sequence-diagram.png`](screenshots/sequence-diagram.png) | Same method, a sequence diagram, to show more than one diagram type |
| Package | `plantuml-anywhere-browser-extension-<version>.zip` (repo root, also attached to [GitHub Releases](https://github.com/t29mato/plantuml-anywhere/releases)) | Built by `npm run package:browser-extension` |

The `.puml` sources used to generate the screenshots are kept in
[`screenshot-sources/`](screenshot-sources/) for reproducibility.
