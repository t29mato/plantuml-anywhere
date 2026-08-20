// 軽量ローダー。manifest.json の content_scripts.matches が既に
// "file:///*.puml" / "file:///*.plantuml" に絞られているため、無関係なローカル
// ファイル(HTML・PDF・画像・テキスト等)ではこのファイル自体が注入されない。
// ここではさらに中身がPlantUMLソースらしいかを軽く確認し、そうである場合だけ
// 重量級レンダラ(dist/renderer.js, @plantuml/coreのWASM込み、圧縮前約7.5MB)を
// 動的import()で読み込む。これによりWASMの読み込み・実行コストは実際に必要な
// ときだけ発生する(VS Code版でWebviewランタイムを遅延読み込みしたのと同じ考え方)。
(function () {
  "use strict";

  const text = document.body ? document.body.innerText : "";
  if (!/^\s*@start/.test(text)) {
    // 拡張子だけ .puml/.plantuml で中身が別物(空ファイル・別形式)の場合は何もしない
    return;
  }

  const rendererUrl = chrome.runtime.getURL("dist/renderer.js");
  import(rendererUrl).catch((err) => {
    console.error("[plantuml-web] failed to load renderer:", err);
  });
})();
