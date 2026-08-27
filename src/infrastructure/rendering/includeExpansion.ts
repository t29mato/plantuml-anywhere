import { findLocalIncludeDirectives } from "./includeDirective.js";

/**
 * `!include` 展開の再帰アルゴリズム。ファイルI/O・パス解決の実際のやり方は
 * `IncludeFileResolver` に委譲するため、このモジュール自体はvscode・DOM・
 * ファイルシステムいずれにも依存しない(単体テストで完結する)。
 * 実際のvscode.Uri経由の実装は infrastructure/vscode/IncludeResolvingSourceReader
 * にある。
 */
export interface IncludeFileResolver {
  /** 現在のディレクトリを表すキーと`!include`のパスから、参照先のキーを求める。 */
  resolveKey(currentDirKey: string, path: string): string;
  /** キーの親ディレクトリを表すキーを返す(そのファイル内のさらなる`!include`の基準)。 */
  dirOf(key: string): string;
  /** 指定キーの内容を行配列で返す。読めない(存在しない等)場合は`undefined`。 */
  readLines(key: string): Promise<string[] | undefined>;
}

export interface ExpandedLines {
  lines: readonly string[];
  /** 展開後の各行(1始まりでlines[i]に対応)が、元々どのトップレベル行に由来するか。 */
  origins: readonly number[];
}

/** 無限ループ防止の安全弁(循環参照は`visited`で検出するが、二重の保険として)。 */
const MAX_INCLUDE_DEPTH = 20;

export async function expandIncludes(
  lines: readonly string[],
  origins: readonly number[],
  dirKey: string,
  resolver: IncludeFileResolver,
  visited: ReadonlySet<string> = new Set(),
  depth = 0
): Promise<ExpandedLines> {
  const directives = findLocalIncludeDirectives(lines);
  if (directives.length === 0 || depth >= MAX_INCLUDE_DEPTH) {
    // 変更なし。呼び出し側が「展開されたかどうか」を参照同一性で安く判定できるように、
    // 新しい配列を作らずそのまま返す。
    return { lines, origins };
  }

  const resultLines: string[] = [];
  const resultOrigins: number[] = [];
  let cursor = 0;

  for (const directive of directives) {
    // このディレクティブより前の行はそのままコピー
    for (; cursor < directive.lineIndex; cursor++) {
      resultLines.push(lines[cursor]);
      resultOrigins.push(origins[cursor]);
    }

    const targetKey = resolver.resolveKey(dirKey, directive.path);
    const alreadyVisiting = visited.has(targetKey);
    const includedLines = alreadyVisiting ? undefined : await resolver.readLines(targetKey);

    if (includedLines === undefined) {
      // 循環参照 or 見つからないファイル: !include行をそのまま残す。
      // PlantUML自身のネイティブ処理(cannot include等の赤字表示)に委ねる
      // (docs/design/known-gaps-verification.md参照)。
      resultLines.push(lines[cursor]);
      resultOrigins.push(origins[cursor]);
      cursor++;
      continue;
    }

    const childOrigins = includedLines.map(() => origins[cursor]);
    const expandedChild = await expandIncludes(
      includedLines,
      childOrigins,
      resolver.dirOf(targetKey),
      resolver,
      new Set([...visited, targetKey]),
      depth + 1
    );
    resultLines.push(...expandedChild.lines);
    resultOrigins.push(...expandedChild.origins);
    cursor++; // !include行自体は結果に含めない(内容で置き換わったため)
  }

  for (; cursor < lines.length; cursor++) {
    resultLines.push(lines[cursor]);
    resultOrigins.push(origins[cursor]);
  }

  return { lines: resultLines, origins: resultOrigins };
}
