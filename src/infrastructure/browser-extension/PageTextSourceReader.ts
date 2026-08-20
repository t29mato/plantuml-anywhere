import { DiagramSource } from "../../domain/DiagramSource.js";
import type { DiagramSourceReaderPort } from "../../domain/ports.js";

/**
 * ブラウザで file:// 表示されているページ自体(プレーンテキストとして表示された
 * .puml/.plantuml ファイル)からソースを読み取る。「何を読むか」は常に「現在の
 * ページ」固定であり、引数を取らない設計(docs/design/browser-extension-design.md参照)。
 */
export class PageTextSourceReader implements DiagramSourceReaderPort {
  async read(): Promise<DiagramSource> {
    const text = document.body ? document.body.innerText : "";
    return DiagramSource.fromText(text);
  }
}
