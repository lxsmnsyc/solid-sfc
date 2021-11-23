import { PluginObj, PluginPass } from '@babel/core';
import * as t from '@babel/types';

interface Options {
  dev?: boolean;
  hmr?: 'esm' | 'standard';
}

interface State extends PluginPass {
  opts: Options;
}

export default function solidSFCPlugin(): PluginObj<State> {
  return {
    visitor: {
      Program(path, { opts }) {
        if (opts.dev) {
          const comments = path.hub.file.ast.comments;
          for (let i = 0; i < comments.length; i++) {
            const comment = comments[i];
            const index = comment.value.indexOf("@refresh");
            if (index > -1) {
              if (comment.value.slice(index).includes("skip")) {
                path.hub.file.metadata.processedHot = true;
                break;
              }
              if (comment.value.slice(index).includes("reload")) {
                path.hub.file.metadata.processedHot = true;
                const pathToHot =
                  opts.hmr !== "esm"
                    ? t.memberExpression(t.identifier("module"), t.identifier("hot"))
                    : t.memberExpression(
                        t.memberExpression(t.identifier("import"), t.identifier("meta")),
                        t.identifier("hot")
                      );
                path.pushContainer(
                  "body",
                  t.ifStatement(
                    pathToHot,
                    t.expressionStatement(
                      t.callExpression(t.memberExpression(pathToHot, t.identifier("decline")), [])
                    )
                  )
                );
                break;
              }
            }
          }
        }
        let imports: t.ImportDeclaration[] = [];
        let statements: t.Statement[] = [];
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
          )
        ];
      },
      ExportDefaultDeclaration(path, { opts }) {
        if (!opts.dev) {
          return;
        }
        if (path.hub.file.metadata.processedHot) return;
        path.hub.file.metadata.processedHot = true;
        const decl = path.node.declaration;
        const HotComponent = t.identifier("$HotComponent");
        const HotImport = t.identifier("_$hot");
        const pathToHot =
          opts.hmr !== "esm"
            ? t.memberExpression(t.identifier("module"), t.identifier("hot"))
            : t.memberExpression(
                t.memberExpression(t.identifier("import"), t.identifier("meta")),
                t.identifier("hot")
              );
        if (!(t.isFunctionDeclaration(decl) || t.isExpression(decl))) {
          throw new Error('Unexpected export default');
        }
        const rename = t.variableDeclaration("const", [
          t.variableDeclarator(
            HotComponent,
            t.isFunctionDeclaration(decl)
              ? t.functionExpression(decl.id, decl.params, decl.body)
              : decl
          )
        ]);
        let replacement;
        if (opts.hmr === "esm") {
          const handlerId = t.identifier("_$handler");
          const componentId = t.identifier("_$Component");
          replacement = [
            t.importDeclaration(
              [t.importSpecifier(HotImport, t.identifier(opts.hmr || "standard"))],
              t.stringLiteral("solid-refresh")
            ),
            t.exportNamedDeclaration(rename),
            t.variableDeclaration("const", [
              t.variableDeclarator(
                t.objectPattern([
                  t.objectProperty(handlerId, handlerId, false, true),
                  t.objectProperty(componentId, componentId, false, true)
                ]),
                t.callExpression(HotImport, [
                  HotComponent,
                  t.unaryExpression("!", t.unaryExpression("!", pathToHot))
                ])
              )
            ]),
            t.ifStatement(
              pathToHot,
              t.expressionStatement(
                t.callExpression(t.memberExpression(pathToHot, t.identifier("accept")), [handlerId])
              )
            ),
            t.exportDefaultDeclaration(componentId)
          ];
        } else {
          replacement = [
            t.importDeclaration(
              [t.importSpecifier(HotImport, t.identifier(opts.hmr || "standard"))],
              t.stringLiteral("solid-refresh")
            ),
            rename,
            t.exportDefaultDeclaration(t.callExpression(HotImport, [HotComponent, pathToHot]))
          ];
        }

        path
          .replaceWithMultiple(replacement)
          .forEach(declaration => path.scope.registerDeclaration(declaration));
      }
    },
  };
}