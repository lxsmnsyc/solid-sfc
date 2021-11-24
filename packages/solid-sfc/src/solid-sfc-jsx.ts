import * as t from '@babel/types';
import { PluginObj } from '@babel/core';

const NAMESPACE = 'solid';

const SOLID_FRAGMENT = 'fragment';
const SOLID_SLOT = 'slot';
const SOLID_CHILDREN = 'children';

const REPLACEMENTS: Record<string, string> = {
  for: 'For',
  switch: 'Switch',
  match: 'Match',
  show: 'Show',
  index: 'Index',
  'error-boundary': 'ErrorBoundary',
  suspense: 'Suspense',
  'suspense-list': 'SuspenseList',
  dynamic: 'Dynamic',
  portal: 'Portal',
  assets: 'Assets',
  'hydration-script': 'HydrationScript',
  'no-hydration': 'NoHydration',
};

export default function solidSFCPlugin(): PluginObj {
  return {
    visitor: {
      JSXElement(path) {
        const { openingElement, closingElement } = path.node;
        const id = openingElement.name;
        if (t.isJSXNamespacedName(id) && id.namespace.name === NAMESPACE) {
          if (id.name.name in REPLACEMENTS) {
            const replacement = t.jsxIdentifier(REPLACEMENTS[id.name.name]);
            id.name = replacement;
            if (closingElement) {
              closingElement.name = replacement;
            }
            return;
          }
          if (id.name.name === SOLID_CHILDREN) {
            path.replaceWith(
              t.jsxExpressionContainer(
                t.memberExpression(
                  t.identifier('props'),
                  t.identifier('children'),
                ),
              ),
            );
            return;
          }
          if (id.name.name === SOLID_SLOT) {
            const attrs = openingElement.attributes;
            let nameAttr: t.JSXAttribute | undefined;
            for (let i = 0, len = attrs.length; i < len; i += 1) {
              const attr = attrs[i];
              if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === 'name') {
                nameAttr = attr;
                break;
              }
            }
            if (!nameAttr) {
              throw new Error('Missing name attribute');
            }
            if (!nameAttr.value) {
              throw new Error('Missing name attribute value');
            }
            const expr = t.isJSXExpressionContainer(nameAttr.value)
              ? nameAttr.value.expression
              : nameAttr.value;
            if (t.isJSXEmptyExpression(expr)) {
              throw new Error('Unexpected JSXEmptyExpression');
            }
            path.replaceWith(
              t.jsxExpressionContainer(
                t.memberExpression(
                  t.identifier('props'),
                  expr,
                  true,
                ),
              ),
            );
          }
          if (id.name.name === SOLID_FRAGMENT) {
            const attrs = openingElement.attributes;
            let nameAttr: t.JSXAttribute | undefined;
            for (let i = 0, len = attrs.length; i < len; i += 1) {
              const attr = attrs[i];
              if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === 'name') {
                nameAttr = attr;
                break;
              }
            }
            if (!nameAttr) {
              throw new Error('Missing name attribute');
            }
            if (!nameAttr.value) {
              throw new Error('Missing name attribute value');
            }
            if (!t.isStringLiteral(nameAttr.value)) {
              throw new Error('Expected StringLiteral');
            }
            attrs.push(
              t.jsxAttribute(
                t.jsxIdentifier(nameAttr.value.value),
                t.jsxFragment(
                  t.jsxOpeningFragment(),
                  t.jsxClosingFragment(),
                  path.node.children,
                ),
              ),
            );
            path.remove();
          }
        }
      },
    },
  };
}
