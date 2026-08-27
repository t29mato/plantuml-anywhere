/**
 * PlantUMLソース中の `!include` ディレクティブのうち、「ローカルファイルへの
 * 相対/絶対パス参照」だけを検出する純粋関数。vscode・DOM・ファイルI/Oいずれにも
 * 依存しない(実際のファイル読み込みは infrastructure/vscode 側の責務)。
 *
 * 対象外(検出しない):
 * - `!include <libname/Something>`(山括弧 = 同梱されていない標準ライブラリ/
 *   スプライトへの参照。ファイルではない)
 * - `!include http://...` / `!include https://...`(URL。今回はスコープ外)
 * - `!include_once` `!include_many` などアンダースコア付きの亜種
 *   (`!include` の直後に空白を要求する正規表現により自然に除外される)
 *
 * これらはこの関数が展開対象にしないだけで、PlantUML自身のネイティブ処理に
 * そのまま渡される(既存の挙動どおり。docs/design/known-gaps-verification.md参照)。
 */
export interface LocalIncludeDirective {
  /** 0始まりの行インデックス。 */
  lineIndex: number;
  /** `!include` の後に書かれた生のパス文字列。 */
  path: string;
}

const INCLUDE_PATTERN = /^\s*!include\s+(\S.*?)\s*$/;

export function findLocalIncludeDirectives(lines: readonly string[]): LocalIncludeDirective[] {
  const result: LocalIncludeDirective[] = [];
  lines.forEach((line, lineIndex) => {
    const match = INCLUDE_PATTERN.exec(line);
    if (!match) {
      return;
    }
    const path = match[1];
    if (path.startsWith("<") || /^https?:\/\//i.test(path)) {
      return;
    }
    result.push({ lineIndex, path });
  });
  return result;
}
