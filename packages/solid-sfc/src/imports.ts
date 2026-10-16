/**
 * Imports in the scripts of blocks. The compiler moves them to the top of the
 * module, since an import cannot be inside a function. An import that is the
 * same as another one is only written once. A local name that something else
 * in the file also declares is renamed, so the import keeps its meaning in
 * its block.
 */
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import type { MagicString } from 'magic-string';
import { parseSync } from 'oxc-parser';
import type { Node } from './labels/ast.ts';
import { analyze } from './labels/scope.ts';
import type { Range } from './template.ts';

export interface ImportedName {
  /** `default`, `*` or the name that the module exports. */
  imported: string;
  local: string;
  /** The local name in the file. */
  localStart: number;
  localEnd: number;
  /** The whole specifier in the file, such as `type a as b`. */
  start: number;
  end: number;
  kind: 'default' | 'namespace' | 'named';
  /** True if a named specifier has `as`. Renaming one without adds it. */
  aliased: boolean;
  typeOnly: boolean;
}

export interface ImportInfo {
  /** The whole statement in the file. */
  start: number;
  end: number;
  /** The module string, with its quotes, in the file. */
  sourceStart: number;
  sourceEnd: number;
  source: string;
  /** True for `import type`. */
  typeOnly: boolean;
  names: ImportedName[];
}

export interface BlockImport extends ImportInfo {
  /** The part of the file where the import is in scope, from the script to the end of its block. */
  scope: Range;
}

/** Reads an `ImportDeclaration` node of code that starts at `offset` in the file. */
export function readImport(node: Node, offset: number): ImportInfo {
  const typeOnly = node.importKind === 'type';
  const names = (node.specifiers as Node[]).map((spec): ImportedName => {
    const kind =
      spec.type === 'ImportDefaultSpecifier'
        ? 'default'
        : spec.type === 'ImportNamespaceSpecifier'
          ? 'namespace'
          : 'named';
    const imported =
      kind === 'default'
        ? 'default'
        : kind === 'namespace'
          ? '*'
          : (spec.imported.name ?? spec.imported.value);
    return {
      imported,
      local: spec.local.name,
      localStart: offset + spec.local.start,
      localEnd: offset + spec.local.end,
      start: offset + spec.start,
      end: offset + spec.end,
      kind,
      aliased: kind === 'named' && spec.imported.start !== spec.local.start,
      typeOnly: typeOnly || spec.importKind === 'type',
    };
  });
  return {
    start: offset + node.start,
    end: offset + node.end,
    sourceStart: offset + node.source.start,
    sourceEnd: offset + node.source.end,
    source: node.source.value,
    typeOnly,
    names,
  };
}

/** Identifies what an imported name refers to, apart from its local name. */
function importKey(info: ImportInfo, name: ImportedName): string {
  return `${info.source}\0${name.imported}\0${name.local}`;
}

/**
 * True if `name` adds nothing to an import that is already written, because
 * both import the same thing under the same local name. A value import also
 * covers the types of the same name.
 */
function covers(written: { key: string; typeOnly: boolean }, key: string, typeOnly: boolean) {
  return written.key === key && (typeOnly || !written.typeOnly);
}

/** A local name of a block import, together with every block import that shares it. */
interface NameGroup {
  key: string;
  local: string;
  entries: { info: BlockImport; name: ImportedName }[];
}

function groupNames(imports: BlockImport[]): NameGroup[] {
  const groups = new Map<string, NameGroup>();
  for (const info of imports) {
    for (const name of info.names) {
      const key = importKey(info, name);
      let group = groups.get(key);
      if (!group) {
        group = { key, local: name.local, entries: [] };
        groups.set(key, group);
      }
      group.entries.push({ info, name });
    }
  }
  return [...groups.values()];
}

/**
 * Replaces each block import with a local declaration of its names, so the
 * scope analysis sees where each name is in scope. `analysis` is the copy of
 * the output that the analysis reads.
 */
export function declareImportsLocally(analysis: MagicString, imports: BlockImport[]): void {
  for (const info of imports) {
    const values = info.names.filter((name) => !name.typeOnly);
    if (values.length === 0) {
      analysis.remove(info.start, info.end);
      continue;
    }
    analysis.overwrite(info.start, values[0]!.localStart, 'const ');
    values.forEach((name, index) => {
      const next = values[index + 1];
      analysis.overwrite(
        name.localEnd,
        next ? next.localStart : info.end,
        next ? ' = null as any, ' : ' = null as any;',
      );
    });
  }
}

/** Names that type declarations and type parameters declare. */
function collectTypeNames(program: Node): Set<string> {
  const names = new Set<string>();
  const visit = (node: Node): void => {
    switch (node.type) {
      case 'TSInterfaceDeclaration':
      case 'TSTypeAliasDeclaration':
      case 'TSEnumDeclaration':
      case 'TSModuleDeclaration':
        if (node.id?.name) {
          names.add(node.id.name);
        }
        break;
      case 'TSTypeParameter':
        names.add(node.name.name);
        break;
      default:
        break;
    }
    eachNode(node, visit);
  };
  visit(program);
  return names;
}

/** The first identifier of a type name, `A` in `A.B.C`. */
function root(name: Node): Node {
  let current = name;
  while (current.type === 'TSQualifiedName') {
    current = current.left;
  }
  return current;
}

/** The identifiers that name a type, such as `A` in `A.B<C>` and in `typeof A`. */
function collectTypeReferences(program: Node): Node[] {
  const references: Node[] = [];
  const visit = (node: Node): void => {
    if (node.type === 'TSTypeReference') {
      references.push(root(node.typeName));
    } else if (node.type === 'TSTypeQuery' && node.exprName.type !== 'TSImportType') {
      references.push(root(node.exprName));
    }
    eachNode(node, visit);
  };
  visit(program);
  return references.filter((node) => node.type === 'Identifier');
}

export interface ImportRename {
  /** A range of the file and the text that replaces it. */
  start: number;
  end: number;
  text: string;
}

/**
 * Finds the renames that keep each block import in its block. `code` and
 * `map` are the output in which `declareImportsLocally` replaced the block
 * imports. `written` holds the imports of the component and module scripts.
 * Returns no renames if the code does not parse, because the compiler
 * reports that error later.
 */
export function localizeImports(options: {
  source: string;
  code: string;
  /** The source map of `code`, from magic-string. */
  map: object;
  imports: BlockImport[];
  written: ImportInfo[];
}): ImportRename[] {
  const { source, code, imports, written } = options;
  const { program, errors } = parseSync('component.tsx', code, {
    sourceType: 'module',
    lang: 'tsx',
  });
  if (errors.length > 0) {
    return [];
  }
  const analysis = analyze(program as unknown as Node);
  const trace = new TraceMap(options.map as never);
  const sourceLines = lineOffsets(source);
  const codeLines = lineOffsets(code);
  // Maps an offset of the output to the offset of the file it comes from.
  const toSource = (offset: number): number | undefined => {
    const line = codeLines.findLastIndex((start) => start <= offset);
    const position = originalPositionFor(trace, {
      line: line + 1,
      column: offset - codeLines[line]!,
    });
    return position.line === null ? undefined : sourceLines[position.line - 1]! + position.column;
  };

  const groups = groupNames(imports);
  const localStarts = new Map<number, NameGroup>();
  for (const group of groups) {
    for (const { name } of group.entries) {
      localStarts.set(name.localStart, group);
    }
  }

  // Every declaration in the file, by name. A block import counts as its group.
  const declarations = new Map<string, Set<string | Node>>();
  const declare = (name: string, what: string | Node): void => {
    let set = declarations.get(name);
    if (!set) {
      set = new Set();
      declarations.set(name, set);
    }
    set.add(what);
  };
  const bindingGroups = new Map<unknown, NameGroup>();
  for (const binding of analysis.bindings) {
    // Module imports are the imports of the scripts, declared below.
    if (binding.kind === 'import') {
      continue;
    }
    const start = toSource(binding.node.start);
    const group = start === undefined ? undefined : localStarts.get(start);
    if (group) {
      bindingGroups.set(binding, group);
      declare(binding.name, group.key);
    } else {
      declare(binding.name, binding.node);
    }
  }
  for (const group of groups) {
    declare(group.local, group.key);
  }
  for (const name of collectTypeNames(program as unknown as Node)) {
    declare(name, `type:${name}`);
  }
  for (const info of written) {
    for (const name of info.names) {
      // An import of the scripts that is the same as a block import does not conflict.
      const key = importKey(info, name);
      const group = groups.find((item) => item.key === key);
      const same =
        group &&
        group.entries.every((entry) =>
          covers({ key, typeOnly: name.typeOnly }, key, entry.name.typeOnly),
        );
      declare(name.local, same ? key : `written:${key}`);
    }
  }

  const taken = new Set([...analysis.names, ...declarations.keys()]);
  const unique = (name: string): string => {
    let index = 1;
    while (taken.has(`${name}_${index}`) || source.includes(`${name}_${index}`)) {
      index++;
    }
    taken.add(`${name}_${index}`);
    return `${name}_${index}`;
  };

  const renames: ImportRename[] = [];
  const renamed = new Map<NameGroup, string>();
  for (const group of groups) {
    if ((declarations.get(group.local)?.size ?? 0) <= 1) {
      continue;
    }
    const local = unique(group.local);
    renamed.set(group, local);
    for (const { name } of group.entries) {
      renames.push({
        start: name.localStart,
        end: name.localEnd,
        text: name.kind === 'named' && !name.aliased ? `${name.local} as ${local}` : local,
      });
    }
  }
  if (renamed.size === 0) {
    return renames;
  }

  const rename = (node: Node, group: NameGroup, shorthand = false): void => {
    const start = toSource(node.start);
    const local = renamed.get(group);
    // Text that the compiler copies maps to
    // another place in the file. Only the name itself is renamed.
    const end = start === undefined ? 0 : start + group.local.length;
    if (
      start === undefined ||
      !local ||
      source.slice(start, end) !== group.local ||
      /[\w$]/.test(source[start - 1] ?? '') ||
      /[\w$]/.test(source[end] ?? '')
    ) {
      return;
    }
    renames.push({ start, end, text: shorthand ? `${group.local}: ${local}` : local });
  };
  for (const binding of analysis.bindings) {
    const group = bindingGroups.get(binding);
    if (!group) {
      continue;
    }
    for (const ref of binding.refs) {
      rename(ref.node, group, ref.shorthand !== undefined);
    }
  }
  for (const name of analysis.jsxNames) {
    const group = bindingGroups.get(name.binding);
    if (group) {
      rename(name.root, group);
      if (name.closing) {
        let closing = name.closing;
        while (closing.type === 'JSXMemberExpression') {
          closing = closing.object;
        }
        rename(closing, group);
      }
    }
  }
  // Types are matched by name, in the innermost block that imports the name.
  for (const node of collectTypeReferences(program as unknown as Node)) {
    const start = toSource(node.start);
    if (start === undefined) {
      continue;
    }
    let match: { group: NameGroup; scope: Range } | undefined;
    for (const group of renamed.keys()) {
      if (group.local !== node.name) {
        continue;
      }
      for (const { info } of group.entries) {
        const inside = info.scope.start <= start && start < info.scope.end;
        if (inside && (!match || info.scope.start >= match.scope.start)) {
          match = { group, scope: info.scope };
        }
      }
    }
    if (match) {
      rename(node, match.group);
    }
  }
  return renames;
}

/**
 * Writes the block imports at the top of the module, one statement per
 * name, after the imports of the scripts. Names that an import of the
 * scripts or an earlier block import already covers are left out.
 */
export function writeImports(
  imports: BlockImport[],
  written: ImportInfo[],
  addRange: (start: number, end: number, inline?: boolean) => void,
  addText: (text: string, inline?: boolean) => void,
): void {
  const done: { key: string; typeOnly: boolean }[] = [];
  const sideEffects = new Set<string>();
  for (const info of written) {
    sideEffects.add(info.source);
    for (const name of info.names) {
      done.push({ key: importKey(info, name), typeOnly: name.typeOnly });
    }
  }
  const names = imports.flatMap((info) => info.names.map((name) => ({ info, name })));
  // Value imports go first, so they cover the type imports of the same name.
  names.sort((a, b) => Number(a.name.typeOnly) - Number(b.name.typeOnly));
  for (const info of imports) {
    if (info.names.length === 0 && !sideEffects.has(info.source)) {
      sideEffects.add(info.source);
      addRange(info.start, info.end);
    }
  }
  for (const { info, name } of names) {
    const key = importKey(info, name);
    if (done.some((item) => covers(item, key, name.typeOnly))) {
      continue;
    }
    done.push({ key, typeOnly: name.typeOnly });
    const type = info.typeOnly ? 'type ' : '';
    const braces = name.kind === 'named';
    addText(`import ${type}${braces ? '{ ' : ''}`);
    addRange(name.start, name.end, true);
    addText(braces ? ' } from ' : ' from ', true);
    addRange(info.sourceStart, info.sourceEnd, true);
    addText(';', true);
  }
}

/** Calls `visit` for each child node, including the nodes of types. */
function eachNode(node: Node, visit: (child: Node) => void): void {
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object' && typeof item.type === 'string') {
          visit(item);
        }
      }
    } else if (value && typeof value === 'object' && typeof value.type === 'string') {
      visit(value);
    }
  }
}

function lineOffsets(text: string): number[] {
  const offsets = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}
