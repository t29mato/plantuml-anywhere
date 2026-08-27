import { describe, it, expect } from "vitest";
import { detectSyntaxErrorLine } from "../../../src/infrastructure/rendering/syntaxErrorDetection.js";

describe("detectSyntaxErrorLine", () => {
  it("PlantUMLが生成する構文エラー画像のSVGから行番号を抽出する", () => {
    // 実機検証で確認した実際のパターン(docs/design/syntax-error-diagnostics.md参照):
    // 構文エラー時、PlantUMLは失敗するのではなく「エラー内容を書き込んだSVG画像」を
    // 成功として返す。そのSVG内の <text> 要素に "[From textarea (line N) ]" という
    // 1始まりの行番号を含むテキストが埋め込まれている。
    const svg =
      '<svg><text>PlantUML version $version$</text>' +
      '<text>[From textarea (line 2) ]</text>' +
      '<text>@startuml</text>' +
      '<text>totallyBogusKeyword Foo Bar</text>' +
      '<text> Syntax Error? (Assumed diagram type: sequence)</text></svg>';

    expect(detectSyntaxErrorLine(svg)).toEqual({ line: 2 });
  });

  it("通常成功したSVG(構文エラーを含まない)にはnullを返す", () => {
    const svg = '<svg><g><rect/><text>Animal</text></g></svg>';
    expect(detectSyntaxErrorLine(svg)).toBeNull();
  });

  it("「textarea」を含むが行番号パターンに一致しない場合はnullを返す(誤検知防止)", () => {
    const svg = '<svg><text>a textarea somewhere unrelated</text></svg>';
    expect(detectSyntaxErrorLine(svg)).toBeNull();
  });
});
