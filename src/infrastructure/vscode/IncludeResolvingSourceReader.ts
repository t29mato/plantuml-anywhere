import * as vscode from "vscode";
import { DiagramSource } from "../../domain/DiagramSource.js";
import type { DiagramSourceReaderPort } from "../../domain/ports.js";
import { expandIncludes, type IncludeFileResolver } from "../rendering/includeExpansion.js";

/**
 * `!include` で参照されたローカルファイルを `vscode.workspace.fs` 経由で
 * 再帰的に読み込んで展開する、readerのデコレータ。
 *
 * ブラウザ環境ではファイルシステムを直接読めないため、`!include` は元々
 * CLAUDE.mdで「PoCではスコープ外、実現可能性のメモだけ残す」としていた既知の
 * 制約だったが、VS Code版は `vscode.workspace.fs` を持つため実現できる
 * (`docs/design/include-directive-support.md`参照)。Chrome/Brave拡張版は
 * 対応していない(そちらは元々の「対応外」のまま。同ドキュメント参照)。
 *
 * 展開のアルゴリズム自体(循環検出・行番号の対応表構築)は
 * `infrastructure/rendering/includeExpansion.ts` にあり、vscode非依存で
 * 単体テスト済み。このクラスは `vscode.Uri` を使った実際のパス解決・
 * ファイル読み込みだけを担当する薄いアダプタ。
 */
export class IncludeResolvingSourceReader implements DiagramSourceReaderPort {
  constructor(
    private readonly inner: DiagramSourceReaderPort,
    private readonly documentUri: vscode.Uri
  ) {}

  async read(): Promise<DiagramSource> {
    const source = await this.inner.read();
    const lines = Array.from(source.lines);
    const origins = lines.map((_, i) => i + 1);
    const baseDirKey = vscode.Uri.joinPath(this.documentUri, "..").toString();

    const expanded = await expandIncludes(
      lines,
      origins,
      baseDirKey,
      this.resolver,
      new Set([this.documentUri.toString()])
    );

    if (expanded.lines === lines) {
      // !includeが無かった(または展開する必要が無かった)。展開前と同じ内容。
      return new DiagramSource(lines);
    }
    return new DiagramSource(expanded.lines, expanded.origins);
  }

  private readonly resolver: IncludeFileResolver = {
    resolveKey: (currentDirKey, path) => {
      // "/"始まりの絶対パスは今回のスコープ外(vscode.workspace.fsは複数の
      // ワークスペースフォルダをまたぐ絶対パス解決の標準的な方法を提供しないため、
      // 誤った場所を読みにいくくらいなら未対応のままにする方が安全と判断した。
      // 既存のcannot include表示にフォールバックする。docs/design/
      // include-directive-support.md「既知の制約」参照)。
      if (path.startsWith("/")) {
        return `unsupported:${path}`;
      }
      return vscode.Uri.joinPath(vscode.Uri.parse(currentDirKey), path).toString();
    },
    dirOf: (key) => vscode.Uri.joinPath(vscode.Uri.parse(key), "..").toString(),
    readLines: async (key) => {
      if (key.startsWith("unsupported:")) {
        return undefined;
      }
      try {
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.parse(key));
        return new TextDecoder("utf-8").decode(bytes).split(/\r\n|\r|\n/);
      } catch {
        // 存在しない/読み取り権限が無い等。undefinedを返すとexpandIncludes側が
        // !include行をそのまま残し、PlantUMLのネイティブな "cannot include" 表示に委ねる。
        return undefined;
      }
    },
  };
}
