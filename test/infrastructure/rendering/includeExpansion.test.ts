import { describe, it, expect } from "vitest";
import { expandIncludes, type IncludeFileResolver } from "../../../src/infrastructure/rendering/includeExpansion.js";

/**
 * テスト用のインメモリ・ファイルシステム。キーはただの文字列パスとして扱う。
 */
function fakeResolver(files: Record<string, string[]>): IncludeFileResolver {
  return {
    resolveKey(currentDirKey, path) {
      // シンプルなテスト用結合(実際のvscode.Uriの挙動はIncludeResolvingSourceReader側でテスト)
      return currentDirKey === "." ? path : `${currentDirKey}/${path}`;
    },
    dirOf(key) {
      const idx = key.lastIndexOf("/");
      return idx === -1 ? "." : key.slice(0, idx);
    },
    async readLines(key) {
      return files[key];
    },
  };
}

describe("expandIncludes", () => {
  it("!includeが無ければ元の配列をそのまま返す(参照同一性、無駄な展開をしない)", async () => {
    const lines = ["@startuml", "class Foo", "@enduml"];
    const origins = [1, 2, 3];
    const result = await expandIncludes(lines, origins, ".", fakeResolver({}));
    expect(result.lines).toBe(lines);
    expect(result.origins).toBe(origins);
  });

  it("単純な!includeを展開し、展開後の各行のoriginを!include行の番号にする", async () => {
    const lines = ["@startuml", "!include shared.puml", "@enduml"];
    const origins = [1, 2, 3];
    const resolver = fakeResolver({ "shared.puml": ["class Shared1", "class Shared2"] });

    const result = await expandIncludes(lines, origins, ".", resolver);

    expect(result.lines).toEqual(["@startuml", "class Shared1", "class Shared2", "@enduml"]);
    expect(result.origins).toEqual([1, 2, 2, 3]);
  });

  it("入れ子の!includeを再帰的に展開する", async () => {
    const lines = ["@startuml", "!include a.puml", "@enduml"];
    const origins = [1, 2, 3];
    const resolver = fakeResolver({
      "a.puml": ["class A", "!include b.puml"],
      "b.puml": ["class B"],
    });

    const result = await expandIncludes(lines, origins, ".", resolver);

    expect(result.lines).toEqual(["@startuml", "class A", "class B", "@enduml"]);
    // b.puml由来の行も、元をたどればトップレベルの2行目(!include a.puml)に帰着する
    expect(result.origins).toEqual([1, 2, 2, 3]);
  });

  it("循環参照を検出し、無限ループせずそのまま(!include行を残して)返す", async () => {
    const lines = ["!include a.puml"];
    const origins = [1];
    const resolver = fakeResolver({
      "a.puml": ["!include b.puml"],
      "b.puml": ["!include a.puml"],
    });

    const result = await expandIncludes(lines, origins, ".", resolver);

    // 循環に行き着いた時点で展開を諦め、その!include行はそのまま残る
    // (PlantUML自身のネイティブ処理に委ねる。既存のcannot include表示と同じ扱い)
    expect(result.lines.some((l) => l.includes("!include"))).toBe(true);
  });

  it("見つからないファイルへの!includeはその行をそのまま残す(PlantUML側のcannot include表示に委ねる)", async () => {
    const lines = ["!include missing.puml"];
    const origins = [1];
    const result = await expandIncludes(lines, origins, ".", fakeResolver({}));

    expect(result.lines).toEqual(["!include missing.puml"]);
    expect(result.origins).toEqual([1]);
  });

  it("兄弟関係の複数の!includeを両方展開する", async () => {
    const lines = ["!include a.puml", "class Middle", "!include b.puml"];
    const origins = [1, 2, 3];
    const resolver = fakeResolver({
      "a.puml": ["class A"],
      "b.puml": ["class B"],
    });

    const result = await expandIncludes(lines, origins, ".", resolver);

    expect(result.lines).toEqual(["class A", "class Middle", "class B"]);
    expect(result.origins).toEqual([1, 2, 3]);
  });
});
