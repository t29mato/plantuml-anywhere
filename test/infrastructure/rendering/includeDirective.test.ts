import { describe, it, expect } from "vitest";
import { findLocalIncludeDirectives } from "../../../src/infrastructure/rendering/includeDirective.js";

describe("findLocalIncludeDirectives", () => {
  it("ローカルファイルへの!includeを検出する", () => {
    const lines = ["@startuml", "!include shared.puml", "class Main", "@enduml"];
    expect(findLocalIncludeDirectives(lines)).toEqual([{ lineIndex: 1, path: "shared.puml" }]);
  });

  it("先頭・末尾の空白は無視してパスを取り出す", () => {
    const lines = ["  !include   sub/shared.puml  "];
    expect(findLocalIncludeDirectives(lines)).toEqual([{ lineIndex: 0, path: "sub/shared.puml" }]);
  });

  it("複数行にわたる!includeを検出順に返す", () => {
    const lines = ["!include a.puml", "class X", "!include b.puml"];
    expect(findLocalIncludeDirectives(lines)).toEqual([
      { lineIndex: 0, path: "a.puml" },
      { lineIndex: 2, path: "b.puml" },
    ]);
  });

  it("山括弧付き(標準ライブラリ/スプライト参照)は対象外", () => {
    const lines = ["!include <awslib/AWSCommon>"];
    expect(findLocalIncludeDirectives(lines)).toEqual([]);
  });

  it("URL(http/https)は対象外(スコープ外、PlantUML側のネイティブ処理に委ねる)", () => {
    const lines = ["!include http://example.com/shared.puml", "!include https://example.com/shared.puml"];
    expect(findLocalIncludeDirectives(lines)).toEqual([]);
  });

  it("!include_once・!include_many等、アンダースコア付きの亜種は対象外", () => {
    const lines = ["!include_once shared.puml", "!include_many shared.puml"];
    expect(findLocalIncludeDirectives(lines)).toEqual([]);
  });

  it("!includeを含まない行は無視する", () => {
    const lines = ["@startuml", "class Foo", "@enduml"];
    expect(findLocalIncludeDirectives(lines)).toEqual([]);
  });
});
