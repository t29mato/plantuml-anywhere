import { describe, it, expect } from "vitest";
import {
  parseTooLargeError,
  computeFallbackFontSize,
  computeFallbackSpacing,
  injectSkinparam,
} from "../../../src/infrastructure/rendering/tooLargeFallback.js";

describe("parseTooLargeError", () => {
  it("PlantUMLの「too large」エラーメッセージから幅・高さ・上限を抽出する", () => {
    const parsed = parseTooLargeError(
      "java.lang.RuntimeException: Diagram too large for browser rendering: 6388x1573 (max 4096)"
    );
    expect(parsed).toEqual({ width: 6388, height: 1573, max: 4096 });
  });

  it("無関係なエラーメッセージはnullを返す(サイズ超過以外はそのまま扱う)", () => {
    expect(parseTooLargeError("java.lang.RuntimeException: Unsupported diagram type")).toBeNull();
    expect(parseTooLargeError("Syntax Error")).toBeNull();
  });
});

describe("computeFallbackFontSize", () => {
  it("超過幅に応じてデフォルトフォントサイズより小さいサイズを計算する", () => {
    // 6388x1573, max 4096 → 幅が支配的。安全マージンを見込んで縮小する。
    const size = computeFallbackFontSize({ width: 6388, height: 1573, max: 4096 }, 0);
    expect(size).toBeLessThan(14); // PlantUMLのデフォルトフォントサイズ(14)より小さい
    expect(size).toBeGreaterThanOrEqual(5); // 可読性の下限を割らない
  });

  it("リトライ回数が増えるほどより強く縮小する", () => {
    const dims = { width: 6388, height: 1573, max: 4096 };
    const first = computeFallbackFontSize(dims, 0);
    const second = computeFallbackFontSize(dims, 1);
    expect(second).toBeLessThanOrEqual(first);
  });

  it("最小フォントサイズを下回らない", () => {
    // 極端に大きい図でも下限でクランプされる
    const size = computeFallbackFontSize({ width: 100000, height: 100000, max: 4096 }, 0);
    expect(size).toBeGreaterThanOrEqual(5);
  });
});

describe("injectSkinparam", () => {
  // フォントサイズだけでなく nodesep/ranksep(ノード間隔)も縮小する。多数の小さい
  // ノードが横に並ぶグリッド状の図では、幅の主要因がノード間隔(フォントサイズに
  // 比例しない固定要素)になるため、フォントサイズ縮小だけでは不十分なケースが
  // 実機検証で見つかったため追加した(docs/design/large-diagram-fallback.md参照)。
  it("@startumlの直後にskinparam defaultFontSize/nodesep/ranksepを挿入する", () => {
    const lines = ["@startuml", "class Foo", "@enduml"];
    const result = injectSkinparam(lines, 7);
    expect(result[0]).toBe("@startuml");
    expect(result[1]).toBe("skinparam defaultFontSize 7");
    expect(result[2]).toMatch(/^skinparam nodesep \d+$/);
    expect(result[3]).toMatch(/^skinparam ranksep \d+$/);
    expect(result[4]).toBe("class Foo");
    expect(result[5]).toBe("@enduml");
  });

  it("@startumlが先頭になくても正しい位置に挿入する", () => {
    const lines = ["' comment", "@startuml", "class Foo", "@enduml"];
    const result = injectSkinparam(lines, 7);
    expect(result[0]).toBe("' comment");
    expect(result[1]).toBe("@startuml");
    expect(result[2]).toBe("skinparam defaultFontSize 7");
    expect(result.at(-2)).toBe("class Foo");
    expect(result.at(-1)).toBe("@enduml");
  });

  it("@startumlが見つからない場合は元の行をそのまま返す(防御的)", () => {
    const lines = ["class Foo"];
    const result = injectSkinparam(lines, 7);
    expect(result).toEqual(lines);
  });
});

describe("computeFallbackSpacing", () => {
  it("フォントサイズの縮小に比例してnodesep/ranksepも縮小する", () => {
    const full = computeFallbackSpacing(14); // デフォルトフォントサイズ相当
    const half = computeFallbackSpacing(7);
    expect(half).toBeLessThan(full);
  });

  it("最小間隔を下回らない", () => {
    expect(computeFallbackSpacing(1)).toBeGreaterThanOrEqual(2);
  });
});
