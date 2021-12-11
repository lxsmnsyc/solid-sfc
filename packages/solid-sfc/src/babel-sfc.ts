import { PluginObj } from '@babel/core';
import * as t from '@babel/types';

export default function solidSFCPlugin(): PluginObj {
  return {
    visitor: {
      Program(path) {
        const imports: t.ImportDeclaration[] = [];
        const statements: t.Statement[] = [];
        let exportDefaults: t.Expression | undefined;

        for (let i = 0, len = path.node.body.length; i < len; i += 1) {
          const node = path.node.body[i];
          if (t.isImportDeclaration(node)) {
            imports.push(node);
          } else if (t.isExportDefaultDeclaration(node) && t.isExpression(node.declaration)) {
            exportDefaults = node.declaration;
          } else {
            statements.push(node);
          }
        }

        path.node.body = [
          ...imports,
          t.exportDefaultDeclaration(
            t.functionDeclaration(
              null,
              [
                t.identifier('props'),
              ],
              t.blockStatement([
                ...statements,
                t.returnStatement(
                  exportDefaults,
                ),
              ]),
            ),
          ),
        ];
      },
    },
  };
}
