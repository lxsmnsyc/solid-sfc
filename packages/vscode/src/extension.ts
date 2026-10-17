import * as serverProtocol from '@volar/language-server/protocol.js';
import { activateAutoInsertion, createLabsInfo } from '@volar/vscode';
import type { LabsInfo } from '@volar/vscode';
import { LanguageClient, TransportKind } from '@volar/vscode/node.js';
import * as vscode from 'vscode';

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<LabsInfo> {
  const serverModule = vscode.Uri.joinPath(context.extensionUri, 'dist', 'server.cjs').fsPath;
  client = new LanguageClient(
    'solid-sfc',
    'Solid SFC',
    {
      run: { module: serverModule, transport: TransportKind.ipc },
      debug: {
        module: serverModule,
        transport: TransportKind.ipc,
        options: { execArgv: ['--nolazy', '--inspect=6009'] },
      },
    },
    { documentSelector: [{ language: 'solid' }] },
  );
  await client.start();
  context.subscriptions.push(activateAutoInsertion([{ language: 'solid' }], client));

  // Lets Volar Labs inspect the virtual code.
  const labsInfo = createLabsInfo(serverProtocol);
  labsInfo.addLanguageClient(client);
  return labsInfo.extensionExports;
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
