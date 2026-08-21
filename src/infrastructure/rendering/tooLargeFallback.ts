/**
 * @plantuml/core(TeaVMビルド)は `MAX_SVG_SIZE = 4096`(px)という
 * ハードコードされた定数を持ち、これを超えるとSVG出力そのものが
 * `RuntimeException: Diagram too large for browser rendering: WxH (max 4096)` で
 * 失敗する(実際のソース: plantuml/plantuml
 * src/main/java/net/sourceforge/plantuml/teavm/browser/PlantUMLBrowser.java)。
 *
 * 通常のJava版PlantUMLにある `PLANTUML_LIMIT_SIZE` 環境変数はこのTeaVMビルドには
 * 実装されておらず、外部から上限を変更する手段は存在しない。
 * また `scale` ディレクティブは、このサイズ判定(`calculateDimension`で得られる
 * 生のレイアウト座標)より**後**に適用される(表示上の拡大縮小のみ)ため、
 * `scale` では回避できないことを実機検証で確認済み
 * (docs/design/large-diagram-fallback.md 参照)。
 *
 * そこで、実際のレイアウト計算結果(`dim`)自体を縮小できる
 * `skinparam defaultFontSize` を使い、超過幅から必要なフォントサイズを逆算して
 * 自動的に縮小再試行するフォールバックを実装する。
 */

export const DEFAULT_PLANTUML_FONT_SIZE = 14;
export const MIN_FALLBACK_FONT_SIZE = 5;
/** 縮小してもなお安全マージンぶん小さくする係数(0.85 = 15%余裕を持たせる) */
const SAFETY_MARGIN = 0.85;
/** リトライのたびにさらに強める追加の縮小係数 */
const RETRY_STRENGTHEN_FACTOR = 0.85;

export interface TooLargeDimensions {
  width: number;
  height: number;
  max: number;
}

const TOO_LARGE_PATTERN = /Diagram too large for browser rendering:\s*(\d+)x(\d+)\s*\(max (\d+)\)/;

/**
 * PlantUMLの"too large"エラーメッセージから幅・高さ・上限を抽出する。
 * マッチしない(サイズ超過以外の)エラーの場合は null を返す。
 */
export function parseTooLargeError(message: string): TooLargeDimensions | null {
  const m = TOO_LARGE_PATTERN.exec(message);
  if (!m) {
    return null;
  }
  return { width: Number(m[1]), height: Number(m[2]), max: Number(m[3]) };
}

/**
 * 超過寸法から、再試行に使うフォントサイズを計算する。
 * `attempt` は0始まりのリトライ回数(2回目以降はより強く縮小する)。
 */
export function computeFallbackFontSize(dims: TooLargeDimensions, attempt: number): number {
  const longestSide = Math.max(dims.width, dims.height);
  const rawFactor = (dims.max / longestSide) * SAFETY_MARGIN * Math.pow(RETRY_STRENGTHEN_FACTOR, attempt);
  const fontSize = Math.round(DEFAULT_PLANTUML_FONT_SIZE * rawFactor);
  return Math.max(MIN_FALLBACK_FONT_SIZE, fontSize);
}

/**
 * PlantUMLソースの `@startuml` 行の直後に `skinparam defaultFontSize` を挿入する。
 * `@startuml` が見つからない場合は元の行をそのまま返す(防御的、通常起きない)。
 */
export function injectSkinparam(lines: readonly string[], fontSize: number): string[] {
  const index = lines.findIndex((line) => line.trim().startsWith("@startuml"));
  if (index === -1) {
    return Array.from(lines);
  }
  const result = Array.from(lines);
  result.splice(index + 1, 0, `skinparam defaultFontSize ${fontSize}`);
  return result;
}
