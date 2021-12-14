import { PluginObj } from '@babel/core';
import * as t from '@babel/types';

function checkHoist(node: t.Node): 'after' | 'before' | null {
  const comments = node.leadingComments;
  if (!comments) {
    return null;
  }
  for (let i = 0, len = comments.length; i < len; i += 1) {
    if (/^\s*@solid-sfc before\s*$/.test(comments[i].value)) {
      return 'before';
    }
    if (/^\s*@solid-sfc after\s*$/.test(comments[i].value)) {
      return 'after';
    }
  }
  return null;
}

export default function solidSFCPlugin(): PluginObj {
  return {
    visitor: {
      Program(path) {
        const imports: t.ImportDeclaration[] = [];
        const statements: t.Statement[] = [];
        const before: t.Statement[] = [];
        const after: t.Statement[] = [];
        let exportDefaults: t.Expression | undefined;

        for (let i = 0, len = path.node.body.length; i < len; i += 1) {
          const node = path.node.body[i];
          if (t.isImportDeclaration(node)) {
            imports.push(node);
          } else if (t.isExportDefaultDeclaration(node) && t.isExpression(node.declaration)) {
            exportDefaults = node.declaration;
          } else {
            const hoist = checkHoist(node);
            if (hoist === 'before') {
              before.push(node);
            } else if (hoist === 'after') {
              after.push(node);
            } else {
              statements.push(node);
            }
          }
        }

        path.node.body = [
          ...imports,
          ...before,
          t.functionDeclaration(
            t.identifier('$$Component'),
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
          ...after,
          t.exportDefaultDeclaration(
            t.identifier('$$Component'),
          ),
        ];
      },
    },
  };
}
