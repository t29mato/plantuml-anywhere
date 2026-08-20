/**
 * プレビュー対象となるPlantUMLソースコード(行の配列)を表す値オブジェクト。
 * vscode・DOM・@plantuml/coreいずれにも依存しない。
 */
export class DiagramSource {
  constructor(readonly lines: readonly string[]) {}

  static fromText(text: string): DiagramSource {
    return new DiagramSource(text.split(/\r\n|\r|\n/));
  }
}
