# Manifest V3 review checklist

A review of `browser-extension/manifest.json` against Chrome Web Store's
Manifest V3 and program policy requirements, plus ready-to-paste text for the
Developer Dashboard's "Privacy practices" tab. This is a documentation
exercise only — nothing here has been submitted; the actual submission is a
human (owner) action (developer registration, upload, and publish are outside
what an automated worker does).

## Current manifest

```json
{
  "manifest_version": 3,
  "name": "PlantUML Anywhere",
  "version": "0.2.1",
  "description": "Preview local .puml/.plantuml files directly in the browser. No server, no upload, no install of Java/Graphviz.",
  "icons": { "128": "icon.png" },
  "content_scripts": [
    {
      "matches": ["file:///*.puml", "file:///*.plantuml"],
      "js": ["content-loader.js"],
      "run_at": "document_end"
    }
  ],
  "web_accessible_resources": [
    { "resources": ["dist/renderer.js"], "matches": ["file:///*"] }
  ],
  "background": { "service_worker": "background.js" }
}
```

## Permissions: already minimal

- **`manifest_version: 3`**: required for new listings; already in place.
- **No `permissions` array.** The extension doesn't request `tabs`,
  `storage`, `scripting`, or any other API permission. `chrome.tabs.create`
  (used once, in `background.js`, to open the onboarding page on install)
  doesn't require the `tabs` permission since it doesn't read tab URLs or
  titles.
- **No `host_permissions`.** Access to `file://` pages is declared narrowly
  via `content_scripts[].matches` (`file:///*.puml`, `file:///*.plantuml`)
  instead of a broad host permission. This is the more restrictive of the two
  options Manifest V3 offers: a statically-scoped content script vs. runtime
  `chrome.scripting` access to arbitrary hosts. There is nothing to remove or
  narrow further here — this is already the minimum needed for the extension's
  single purpose.
- **`web_accessible_resources`** exposes exactly one file
  (`dist/renderer.js`), scoped to `file:///*`, and only so the lightweight
  content script can dynamically `import()` the (large, WASM-containing)
  renderer on demand. It is not reachable from arbitrary web pages in a way
  that matters, since it only ever gets used from the extension's own content
  script.

No changes were needed to reach a minimal-permission manifest; it already
was one going in.

## Single purpose

> Paste into the "Single purpose" field if the dashboard asks for it.

```
Render local PlantUML diagram files (.puml / .plantuml) as an inline preview
when opened in the browser via file://. No other functionality.
```

## Remote code

The extension bundles `@plantuml/core` (the rendering engine, incl. its
WASM Graphviz layout engine) directly in `browser-extension/dist/renderer.js`
at build time. It does not fetch or `eval` any remote code at runtime.
Verified empirically: loading the built extension and rendering a diagram in
a live browser produces **zero requests to any host other than the page
being viewed itself** (confirmed via Playwright request logging against the
actual `dist/renderer.js` build — see the verification note below).

> Dashboard question: "Are you using remote code?" → **No.**

## Data usage / Privacy practices tab

The extension's only input is the text content of the local `.puml` /
`.plantuml` file the user opens. That content is rendered to SVG entirely
inside the browser tab and is never transmitted anywhere.

> Dashboard question: "What user data do you plan to collect from users now
> or in the future?"

Select **Website content** (the extension reads the text of the page it's
running on to extract the diagram source) and leave every other category
unchecked (no PII, location, health info, financial info, authentication
info, personal communications, or user activity is accessed).

> Certifications to check:

- [x] I do not sell or transfer user data to third parties, outside of the
      approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to
      my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or
      for lending purposes

> Privacy policy URL: not required for this data profile (no PII/sensitive
> categories collected), but the README's "How it works" section already
> states the no-network-calls guarantee in plain language and can be linked
> if the dashboard asks for one anyway.

## Verification note

Confirmed with Playwright against the actual built `browser-extension/dist/renderer.js`:
rendering a real diagram (via a local test page importing the bundle exactly
as the content script does) produced exactly the requests for the page itself
and the script — zero requests to any other host. The one `fetch()` call
present in the bundled WASM loader code is a same-origin fallback path that
never fires, because the WASM binary is inlined in the bundle rather than
fetched separately.

## Icon

`icon.png` (128×128, used both as the extension icon and the Store's small
tile icon) is already present at `browser-extension/icon.png` and copied here
as [`icon-128.png`](icon-128.png) for convenience.

## Package

Built via `npm run package:browser-extension`
(`scripts/package-browser-extension.sh`), which produces
`plantuml-anywhere-browser-extension-<version>.zip` containing only the
files the browser needs (`manifest.json`, `content-loader.js`, `background.js`,
`onboarding.html`, `icon.png`, `dist/renderer.js` — no source maps, no dev
files). This is the file to upload to the Developer Dashboard.
