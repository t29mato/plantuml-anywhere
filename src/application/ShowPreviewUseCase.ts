import { RenderedSvg } from "../domain/RenderedSvg.js";
import type {
  DiagramRenderPort,
  DiagramSourceReaderPort,
  PreviewPresenterPort,
} from "../domain/ports.js";

/**
 * 「ソースを読み取り、レンダリングし、結果を提示する」というPoCの唯一のユースケース。
 * VS Code拡張機能版・Chrome拡張機能版の両方から、コード変更なしで利用される
 * (docs/design/architecture.md「配布ターゲット別のレイヤー構成」参照)。
 */
export class ShowPreviewUseCase {
  constructor(
    private readonly reader: DiagramSourceReaderPort,
    private readonly renderer: DiagramRenderPort,
    private readonly presenter: PreviewPresenterPort
  ) {}

  async execute(): Promise<void> {
    const source = await this.reader.read();
    this.presenter.showLoading();
    const result = await this.renderer.render(source);
    if (result instanceof RenderedSvg) {
      this.presenter.showSuccess(result);
    } else {
      this.presenter.showError(result);
    }
  }
}
