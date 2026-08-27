import { describe, it, expect } from "vitest";
import { DiagramSource } from "../../src/domain/DiagramSource.js";

describe("DiagramSource.originalLineNumber", () => {
  it("originLinesが無い場合は入力の行番号をそのまま返す(!include展開されていない通常のケース)", () => {
    const source = new DiagramSource(["@startuml", "class Foo", "@enduml"]);
    expect(source.originalLineNumber(2)).toBe(2);
  });

  it("originLinesがある場合、展開後の行番号を展開前(元ファイル)の行番号に変換する", () => {
    // !include展開で3行→5行に増えたケースを想定。
    // 元の2行目(!include行)が展開後は2〜4行目になり、それらは全て元の2行目にマップされる。
    const source = new DiagramSource(
      ["@startuml", "class Included1", "class Included2", "class Included3", "@enduml"],
      [1, 2, 2, 2, 3]
    );
    expect(source.originalLineNumber(1)).toBe(1);
    expect(source.originalLineNumber(3)).toBe(2);
    expect(source.originalLineNumber(5)).toBe(3);
  });

  it("範囲外の行番号を渡された場合はそのまま返す(防御的)", () => {
    const source = new DiagramSource(["@startuml", "@enduml"], [1, 2]);
    expect(source.originalLineNumber(99)).toBe(99);
  });
});
