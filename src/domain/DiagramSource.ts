/**
 * プレビュー対象となるPlantUMLソースコード(行の配列)を表す値オブジェクト。
 * vscode・DOM・@plantuml/coreいずれにも依存しない。
 *
 * `originLines` は、`!include` 展開などで実際にレンダラへ渡す行が元ファイルから
 * 変化した場合に、「展開後の行番号(1始まり)」→「元ファイルの行番号(1始まり)」の
 * 対応を保持する(展開後の配列と同じ長さ)。展開されていない通常のケースでは
 * `undefined` のままでよく、その場合は行番号がそのまま元ファイルの行番号になる。
 * 構文エラーの行番号をVS Codeの診断(該当行への波線)として正しい位置に出すために使う
 * (docs/design/syntax-error-diagnostics.md参照)。
 */
export class DiagramSource {
  constructor(
    readonly lines: readonly string[],
    readonly originLines?: readonly number[]
  ) {}

  static fromText(text: string): DiagramSource {
    return new DiagramSource(text.split(/\r\n|\r|\n/));
  }

  /** 展開後の1始まり行番号を、元ファイル上の1始まり行番号に変換する。 */
  originalLineNumber(expandedLine: number): number {
    if (!this.originLines) {
      return expandedLine;
    }
    return this.originLines[expandedLine - 1] ?? expandedLine;
  }
}
