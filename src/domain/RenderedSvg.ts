/**
 * レンダリング成功結果(SVG文字列)を表す値オブジェクト。
 *
 * `note` は、レンダラが自動縮小フォールバックを適用した場合などに、利用者へ
 * 控えめに伝えるための短い注記(例: "図が大きいため縮小して表示しています")。
 * 通常のレンダリングでは `undefined`。
 *
 * `syntaxErrorLine` は、PlantUML自体が構文エラーと判断した場合に設定される
 * 1始まりの行番号(元ファイル上の行番号。`!include`展開があっても
 * `DiagramSource.originalLineNumber` で変換済み)。PlantUMLは構文エラーの場合でも
 * 例外を投げず「エラー内容を書き込んだSVG画像」を成功として返すため、
 * これを検出してVS Codeの診断(該当行への波線)として利用者に伝える
 * (docs/design/syntax-error-diagnostics.md参照)。通常のレンダリングでは `undefined`。
 */
export class RenderedSvg {
  constructor(
    readonly svg: string,
    readonly note?: string,
    readonly syntaxErrorLine?: number
  ) {}
}
