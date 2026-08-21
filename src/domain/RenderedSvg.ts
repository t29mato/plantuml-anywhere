/**
 * レンダリング成功結果(SVG文字列)を表す値オブジェクト。
 *
 * `note` は、レンダラが自動縮小フォールバックを適用した場合などに、利用者へ
 * 控えめに伝えるための短い注記(例: "図が大きいため縮小して表示しています")。
 * 通常のレンダリングでは `undefined`。
 */
export class RenderedSvg {
  constructor(readonly svg: string, readonly note?: string) {}
}
