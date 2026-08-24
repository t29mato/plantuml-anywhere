# 改名: PlantUML Web Preview → PlantUML Anywhere

- 実施日: 2026-08-25
- 経緯: オーナー指示による正式な改名。「webが名前に付く拡張機能は聞いたことがない」という
  指摘は妥当であり、この拡張の唯一の席=「デスクトップ・github.dev・ブラウザ単体、動く場所を
  選ばない」ことをコンセプトとして名前に載せる。リポジトリ名も `plantuml-web` →
  `plantuml-anywhere` に変更する(GitHub上の実際のリポジトリリネームは司令塔が実施。
  本ドキュメントが対象とするのはコード側の変更のみ)。

## 変更した識別子

| 種別 | 旧 | 新 |
|---|---|---|
| VS Code拡張 `name` | `plantuml-web` | `plantuml-anywhere` |
| VS Code拡張 `publisher` | `plantuml-web-poc` | `plantuml-anywhere-poc` |
| VS Code拡張 `displayName` | `PlantUML Web Preview (PoC)` | `PlantUML Anywhere (PoC)` |
| VS Code拡張 コマンドID | `plantuml-web.preview` | `plantuml-anywhere.preview` |
| Chrome/Brave拡張 `name` | `PlantUML Local Preview (PoC)` | `PlantUML Anywhere (PoC)` |
| DOM要素IDプレフィックス(Brave拡張) | `plantuml-web-*` | `plantuml-anywhere-*` |
| `.vsix` ファイル名 | `plantuml-web-<version>.vsix` | `plantuml-anywhere-<version>.vsix` |
| 配布zipファイル名 | `plantuml-web-browser-extension-<version>.zip` | `plantuml-anywhere-browser-extension-<version>.zip` |
| リポジトリURL(`package.json`) | `github.com/t29mato/plantuml-web` | `github.com/t29mato/plantuml-anywhere` |
| バージョン | 0.1.4 | **0.2.0**(名称変更を伴う節目のためminorを上げた) |

## 更新したファイル

- `package.json`(name/publisher/displayName/description/repository.url/コマンドID)
- `package-lock.json`(`npm install`で自動追従)
- `browser-extension/manifest.json`(name/version)
- `browser-extension/onboarding.html`(表記)
- `browser-extension/content-loader.js`(ログ接頭辞)
- `src/extension.ts`(コマンドID登録)
- `src/infrastructure/browser-extension/PageDomPresenter.ts`(DOM要素IDプレフィックス)
- `test-web/index.ts`(`EXTENSION_ID`定数、コマンドID呼び出し)
- `scripts/package-browser-extension.sh`(出力zipファイル名)
- `.gitignore`(コミット対象.vsixのファイル名例外)
- `README.md` / `TRYING-IT.md`(タイトル・リポジトリURL・ファイル名の言及箇所)
- `CLAUDE.md`(タイトル行のプロジェクト名のみ)
- `docs/design/architecture.md` / `marketplace-publish-checklist.md` /
  `browser-extension-v2-lazy-loading.md` / `browser-extension-design.md`
  (現行の設計方針として記載されているプロジェクト名・ファイル名パターン)

## 意図的に変更しなかったもの(歴史的記録として保持)

- `spikes/` 配下全体(`spikes/package.json`・`spikes/browser-extension/ext/manifest.json` 等):
  既に `browser-extension/` へ昇格済みの、完了した過去のスパイク検証の記録そのもの。
  当時実際に使われたファイル名・設定を書き換えると、検証記録としての正確性が失われるため
  保持する。
- `docs/design/vsix-install-verification.md`: v0.0.1時点で実際に行った `.vsix` インストール
  検証の実測記録(当時のファイル名・拡張IDをそのまま記載)。同様に歴史的記録として保持する。

「旧名の残骸をgrepで一掃」の指示に対しては、上記2つの歴史的記録を除く全ファイルで
`plantuml-web` / `PlantUML Web` / `PlantUML Local` の出現をゼロにしたことを
`grep -ril` で確認済み。

## 検証

- `npm run ci`(typecheck / lint / test:unit / test:e2e)すべて通過。コマンドID・拡張ID変更後も
  VS Code版のe2eテスト(`@vscode/test-web`)がSVGレンダリング成功を確認。
- **対照実験**: 改名によって何かが壊れていないかを切り分けるため、改名前のコード
  (`git stash`で一時的に復元)でも同一のBrave拡張実機テストを実行したところ、**同じ現象
  (SVGが表示されない)が再現した**。これにより、後述の未検証事項は改名によるリグレッション
  ではなく、検証環境固有の制約であることを確認した。
- `.vsix`(8ファイル)・zip(6ファイル)ともに想定どおりの構成でパッケージング成功。

### 未検証事項(Brave拡張のend-to-end実機レンダリング)

このセッションのBrave Browser実機検証環境では、`chrome://extensions` の
「デベロッパーモード」が **管理者ポリシーにより変更不可**(`This setting is managed by
your administrator.`)であることが判明した。これにより「ファイルのURLへのアクセスを
許可する」設定を自動化・手動のいずれでも有効化できず、`file://` ページへの
content script注入(≒SVGレンダリング)を実機で再現できなかった。

これは**改名作業由来の不具合ではない**(上記の対照実験で改名前のコードでも同一環境で
同一の未検証状態になることを確認済み)。拡張機能のロード自体(background service worker
の起動、manifest.jsonの構文)は正常に確認できている。過去のリリース(v0.1.4時点の
`docs/evidence/dark-theme-after-brave.png`等)では同じ手法で実際にSVGレンダリングの
成功を確認済みであり、拡張のロジック自体が改名によって壊れたことを示す根拠はない。

**この点はHQ/オーナーへの報告で正直に明記し、オーナー自身の通常のBrave環境
(デベロッパーモードが制限されていない環境)での実機確認を依頼する。**
