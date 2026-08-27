/**
 * PlantUMLの構文エラー検出。
 *
 * PlantUMLは構文エラーの場合、`renderToString` を**失敗させない**。代わりに
 * 「エラー内容を書き込んだSVG画像」を成功として返す(実機検証で確認済み。
 * docs/design/syntax-error-diagnostics.md参照)。そのSVGには、失敗した行を示す
 * `[From textarea (line N) ]` というテキストが埋め込まれている(Nは1始まり)。
 *
 * この関数はそのパターンを検出し、行番号を取り出す。これにより、単に画像を
 * 表示するだけでなく、VS Codeの診断(Problems パネル・該当行への波線)として
 * 利用者に伝えられるようになる。
 */
export interface SyntaxErrorInfo {
  /** 1始まりの行番号(PlantUMLソースの行番号と同じ数え方)。 */
  line: number;
}

const SYNTAX_ERROR_LINE_PATTERN = /\[From textarea \(line (\d+)\)/;

export function detectSyntaxErrorLine(svg: string): SyntaxErrorInfo | null {
  const match = SYNTAX_ERROR_LINE_PATTERN.exec(svg);
  if (!match) {
    return null;
  }
  return { line: Number(match[1]) };
}
