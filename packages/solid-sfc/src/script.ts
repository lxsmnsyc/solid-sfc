import { parseSync } from 'oxc-parser';
import type { Range } from './template.ts';

export const PROPS_IDENTIFIER = '$$props';

export interface PropsCall extends Range {
  /** True if the call is destructured, as in `const { a } = $props()`. */
  destructured: boolean;
}

export interface InstanceScript {
  /** Top-level imports and type declarations, moved out of the component. */
  hoisted: Range[];
  /** `$props()` calls, replaced with the props parameter. */
  propsCalls: PropsCall[];
  /** The source text of the first `$props<T>()` type argument. */
  propsType: string | undefined;
}

interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && typeof (value as Node).type === 'string';
}

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const key in node) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) {
        if (isNode(child)) {
          walk(child, visit);
        }
      }
    } else if (isNode(value)) {
      walk(value, visit);
    }
  }
}

function isTypeDeclaration(node: unknown): boolean {
  return (
    isNode(node) &&
    (node.type === 'TSInterfaceDeclaration' || node.type === 'TSTypeAliasDeclaration')
  );
}

export type Fail = (message: string, offset: number) => never;

function parse(code: string, offset: number, fail: Fail) {
  const result = parseSync('script.ts', code, { sourceType: 'module', lang: 'ts' });
  const error = result.errors[0];
  if (error) {
    fail(error.message, offset + (error.labels[0]?.start ?? 0));
  }
  return result.program;
}

/** Checks a `<script module>` block for syntax errors. */
export function analyzeModuleScript(code: string, offset: number, fail: Fail): void {
  parse(code, offset, fail);
}

/**
 * Finds the parts of the instance script that need to move out of the
 * component function. All returned ranges are offsets into the file.
 */
export function analyzeInstanceScript(code: string, offset: number, fail: Fail): InstanceScript {
  const program = parse(code, offset, fail);
  const hoisted: Range[] = [];
  const propsCalls: PropsCall[] = [];
  const destructured = new Set<Node>();
  let propsType: string | undefined;

  for (const statement of program.body as unknown as Node[]) {
    switch (statement.type) {
      case 'ImportDeclaration':
      case 'TSInterfaceDeclaration':
      case 'TSTypeAliasDeclaration':
        hoisted.push({ start: offset + statement.start, end: offset + statement.end });
        break;
      case 'ExportNamedDeclaration':
        if (statement.exportKind === 'type' || isTypeDeclaration(statement.declaration)) {
          hoisted.push({ start: offset + statement.start, end: offset + statement.end });
        } else {
          fail(
            'Only types can be exported from the component script. Use <script module> to export values',
            offset + statement.start,
          );
        }
        break;
      case 'ExportDefaultDeclaration':
      case 'ExportAllDeclaration':
        fail('The component script cannot have this export', offset + statement.start);
        break;
      default:
        break;
    }
  }

  walk(program as unknown as Node, (node) => {
    if (
      node.type === 'VariableDeclarator' &&
      isNode(node.id) &&
      node.id.type === 'ObjectPattern' &&
      isNode(node.init)
    ) {
      destructured.add(node.init);
    }
    if (
      node.type !== 'CallExpression' ||
      !isNode(node.callee) ||
      node.callee.type !== 'Identifier' ||
      node.callee.name !== '$props'
    ) {
      return;
    }
    if ((node.arguments as unknown[]).length > 0) {
      fail('$props() takes no arguments', offset + node.start);
    }
    const typeArguments = node.typeArguments as { params: Node[] } | null | undefined;
    const type = typeArguments?.params[0];
    if (type && propsType === undefined) {
      propsType = code.slice(type.start, type.end);
    }
    propsCalls.push({
      start: offset + node.start,
      end: offset + node.end,
      destructured: destructured.has(node),
    });
  });

  return { hoisted, propsCalls, propsType };
}
