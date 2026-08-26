# Trying It Out

This is a copy-paste guide to try the extension right now, in three ways: desktop VS Code, browser-based VS Code, and the standalone Chrome/Brave extension.

## Setup (all paths)

```sh
git clone https://github.com/t29mato/plantuml-anywhere.git
cd plantuml-anywhere
npm install
```

---

## A. Desktop VS Code

### 1. Get the `.vsix`

This repo ships a ready-to-install `.vsix` (`plantuml-anywhere-0.2.2.vsix`), so you can skip straight to installing it.

To build it yourself instead:

```sh
npm run package
```

### 2. Install it

```sh
code --install-extension plantuml-anywhere-0.2.2.vsix
```

### 3. Open a `.puml` file

A sample is included at `test-fixtures/sample.puml`.

```sh
code test-fixtures/sample.puml
```

### 4. Preview it

Open the command palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run `PlantUML: Preview`. A webview opens next to your editor with the rendered diagram.

> **Tip**: if you open a `.puml` file right after VS Code starts, the extension may not have activated yet. Run `PlantUML: Preview` from the command palette to trigger it explicitly.

### Uninstalling

```sh
code --uninstall-extension plantuml-anywhere-poc.plantuml-anywhere
```

---

## B. Browser-based VS Code (vscode.dev / github.dev style)

VS Code Web Extensions can't be sideloaded, so trying this on the real github.dev/vscode.dev requires a Marketplace listing (not published yet). You can still run the same browser-based VS Code locally:

```sh
npm run try:web
```

This opens a browser with VS Code Web pointed at the `test-fixtures` folder. Open `sample.puml` from the explorer, then run `PlantUML: Preview` from the command palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).

---

## C. Chrome / Brave extension

A standalone browser extension that previews a local `.puml` / `.plantuml` file the moment you open it with `file://` — no VS Code needed. It isn't published on the Chrome Web Store yet, so you'll load it as an unpacked extension.

### 1. Get the extension

Download `plantuml-anywhere-browser-extension-<version>.zip` from this repo's [Releases](https://github.com/t29mato/plantuml-anywhere/releases) and **unzip** it somewhere (loading the zip directly won't work).

From another machine, since this is a private repo, the GitHub CLI works too:

```sh
gh release download --repo t29mato/plantuml-anywhere --pattern "plantuml-anywhere-browser-extension-*.zip"
unzip plantuml-anywhere-browser-extension-*.zip -d plantuml-anywhere-browser-extension
```

Or build it yourself:

```sh
npm run package:browser-extension
```
(this drops `plantuml-anywhere-browser-extension-<version>.zip` in the repo root; the extension folder itself is `browser-extension/`)

### 2. Load it in your browser

1. Open `chrome://extensions` (`brave://extensions` on Brave)
2. Turn on "Developer mode" in the top right
3. Click "Load unpacked" and select the folder you unzipped (or `browser-extension/`)

### 3. **Important: allow file URL access**

A setup page opens automatically on first install. **Skipping this means the preview never appears** — browsers block extensions from accessing `file://` pages by default, so this needs a manual opt-in:

1. Open `chrome://extensions` (or `brave://extensions`)
2. Open "Details" on this extension (PlantUML Anywhere)
3. Turn on "Allow access to file URLs"

### 4. Open a `.puml` file

Drag `test-fixtures/sample.puml` into your browser, or open it with `Ctrl/Cmd+O`. The diagram renders in place.

> **Other files stay untouched**: this extension never activates for local files other than `.puml`/`.plantuml` (HTML, PDF, images, etc. are left alone).

---

## Troubleshooting

- Known limitations (no local `!include`, no bundled sprite libraries, etc.) are listed in the [README](README.md#known-limitations).
- The browser-based VS Code session can occasionally look unstyled (missing CSS). That's a known quirk of `@vscode/test-web`'s ESM mode, not a bug in this extension.
- If something else doesn't work, please open an issue.
