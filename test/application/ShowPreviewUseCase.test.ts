import { describe, it, expect, vi } from "vitest";
import { ShowPreviewUseCase } from "../../src/application/ShowPreviewUseCase.js";
import { DiagramSource } from "../../src/domain/DiagramSource.js";
import { RenderedSvg } from "../../src/domain/RenderedSvg.js";
import { RenderError } from "../../src/domain/RenderError.js";
import type {
  DiagramRenderPort,
  DiagramSourceReaderPort,
  PreviewPresenterPort,
} from "../../src/domain/ports.js";

function fakeReader(source: DiagramSource): DiagramSourceReaderPort {
  return { read: vi.fn().mockResolvedValue(source) };
}

function fakePresenter(): PreviewPresenterPort {
  return { showLoading: vi.fn(), showSuccess: vi.fn(), showError: vi.fn() };
}

describe("ShowPreviewUseCase", () => {
  it("正常系: reader→presenter.showLoading→renderer→presenter.showSuccess の順に呼ばれる", async () => {
    const source = new DiagramSource(["@startuml", "class A", "@enduml"]);
    const svg = new RenderedSvg("<svg></svg>");
    const callOrder: string[] = [];
    const reader = fakeReader(source);
    const renderer: DiagramRenderPort = {
      render: vi.fn().mockImplementation(async () => {
        callOrder.push("render");
        return svg;
      }),
    };
    const presenter = fakePresenter();
    (presenter.showLoading as ReturnType<typeof vi.fn>).mockImplementation(() => callOrder.push("showLoading"));

    const useCase = new ShowPreviewUseCase(reader, renderer, presenter);
    await useCase.execute();

    expect(reader.read).toHaveBeenCalledOnce();
    // renderer.render(レンダリング開始、巨大な図では数秒〜数十秒ブロックしうる)より前に
    // showLoadingが呼ばれること。利用者に「処理中」であることを先に伝えるための順序
    // (docs/design/large-diagram-fallback.md「巨大図レンダリング中の無応答調査」参照)。
    expect(callOrder).toEqual(["showLoading", "render"]);
    expect(renderer.render).toHaveBeenCalledWith(source);
    expect(presenter.showSuccess).toHaveBeenCalledWith(svg);
    expect(presenter.showError).not.toHaveBeenCalled();
  });

  it("異常系: rendererが失敗した場合 presenter.showError が呼ばれる", async () => {
    const source = new DiagramSource(["broken"]);
    const error = new RenderError("parse failed");
    const reader = fakeReader(source);
    const renderer: DiagramRenderPort = { render: vi.fn().mockResolvedValue(error) };
    const presenter = fakePresenter();

    const useCase = new ShowPreviewUseCase(reader, renderer, presenter);
    await useCase.execute();

    expect(presenter.showError).toHaveBeenCalledWith(error);
    expect(presenter.showSuccess).not.toHaveBeenCalled();
  });
});
