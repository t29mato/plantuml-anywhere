import * as vscode from "vscode";
import { DiagramSource } from "../../domain/DiagramSource.js";
import type { DiagramSourceReaderPort } from "../../domain/ports.js";

/**
 * vscode.workspace.fs 経由でファイルを読む(Node の fs は使わない = Web Extensionで動く)。
 * どのファイルを読むかはコンストラクタで受け取った uri に固定する。
 */
export class VsCodeWorkspaceFsSourceReader implements DiagramSourceReaderPort {
  constructor(private readonly uri: vscode.Uri) {}

  async read(): Promise<DiagramSource> {
    const bytes = await vscode.workspace.fs.readFile(this.uri);
    const text = new TextDecoder("utf-8").decode(bytes);
    return DiagramSource.fromText(text);
  }
}
