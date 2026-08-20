import { ShowPreviewUseCase } from "../application/ShowPreviewUseCase.js";
import { PlantUmlCoreRenderer } from "../infrastructure/rendering/PlantUmlCoreRenderer.js";
import { PageTextSourceReader } from "../infrastructure/browser-extension/PageTextSourceReader.js";
import { PageDomPresenter } from "../infrastructure/browser-extension/PageDomPresenter.js";

/**
 * Chrome/Brave拡張機能の Composition Root。
 *
 * これは重量級バンドル(@plantuml/core のWASM込み、圧縮前約7.5MB)であり、
 * content-loader.js(数百バイトの軽量ローダー)から動的import()で必要になった
 * ときだけ読み込まれる(browser-extension/manifest.json の web_accessible_resources
 * 経由)。VS Code版でWebviewランタイムを拡張ホストから分離した設計
 * (src/webview-runtime/index.ts)と同じ考え方。
 *
 * ロードされた時点で即座に実行する(dynamic import自体がトリガーであり、
 * content-loader.js側で既に「PlantUMLソースらしい」ことを確認済みのため)。
 */
const reader = new PageTextSourceReader();
const renderer = new PlantUmlCoreRenderer();
const presenter = new PageDomPresenter();
const useCase = new ShowPreviewUseCase(reader, renderer, presenter);
void useCase.execute();
