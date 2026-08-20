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
  return { showSuccess: vi.fn(), showError: vi.fn() };
}

describe("ShowPreviewUseCase", () => {
  it("正常系: reader→renderer→presenter.showSuccess の順に呼ばれる", async () => {
    const source = new DiagramSource(["@startuml", "class A", "@enduml"]);
    const svg = new RenderedSvg("<svg></svg>");
    const reader = fakeReader(source);
    const renderer: DiagramRenderPort = { render: vi.fn().mockResolvedValue(svg) };
    const presenter = fakePresenter();

    const useCase = new ShowPreviewUseCase(reader, renderer, presenter);
    await useCase.execute();

    expect(reader.read).toHaveBeenCalledOnce();
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
