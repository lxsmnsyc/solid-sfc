/**
 * Compile-time functions (CTFs). These are global functions such as
 * `$signal` and `$memo` that the compiler replaces with SolidJS calls.
 */
import type {
  AssignmentExpression,
  BindingPattern,
  BindingIdentifier,
  CallExpression,
  IdentifierName,
  IdentifierReference,
  Node,
  ObjectPattern,
  Program,
  VariableDeclarator,
} from '@oxc-project/types';
import { MagicString } from 'magic-string';
import { parseSync } from 'oxc-parser';
import { ScopeTracker, isReferenceIdentifier, walk } from 'oxc-walker';

type Identifier = BindingIdentifier | IdentifierName | IdentifierReference;

const SOLID = 'solid-js';
const STORE = 'solid-js/store';
const WEB = 'solid-js/web';

type Import = readonly [source: string, name: string];

/** CTFs that are renamed to a SolidJS function. */
const ALIASES: Record<string, Import> = {
  $effect: [SOLID, 'createEffect'],
  $computed: [SOLID, 'createComputed'],
  $renderEffect: [SOLID, 'createRenderEffect'],
  $merge: [SOLID, 'mergeProps'],
  $uid: [SOLID, 'createUniqueId'],
  $createContext: [SOLID, 'createContext'],
  $useContext: [SOLID, 'useContext'],
  $resource: [SOLID, 'createResource'],
  $reaction: [SOLID, 'createReaction'],
  $mount: [SOLID, 'onMount'],
  $cleanup: [SOLID, 'onCleanup'],
  $error: [SOLID, 'onError'],
  $catchError: [SOLID, 'catchError'],
  $startTransition: [SOLID, 'startTransition'],
  $useTransition: [SOLID, 'useTransition'],
  $owner: [SOLID, 'getOwner'],
  $runWithOwner: [SOLID, 'runWithOwner'],
  $store: [STORE, 'createStore'],
  $mutable: [STORE, 'createMutable'],
  $produce: [STORE, 'produce'],
  $reconcile: [STORE, 'reconcile'],
  $unwrap: [STORE, 'unwrap'],
};

/** CTFs whose first argument is wrapped in an arrow function. */
const WRAPPED: Record<string, Import> = {
  $untrack: [SOLID, 'untrack'],
  $batch: [SOLID, 'batch'],
  $selector: [SOLID, 'createSelector'],
  $on: [SOLID, 'on'],
  $observable: [SOLID, 'observable'],
  $lazy: [SOLID, 'lazy'],
  $root: [SOLID, 'createRoot'],
};

interface AccessorFunction {
  import?: Import;
  /** Wraps the first argument in an arrow function. */
  wrap?: boolean;
  /** `createMemo` takes the options as the third argument. */
  memo?: boolean;
}

/** CTFs that declare a read-only variable. Reads become accessor calls. */
const ACCESSORS: Record<string, AccessorFunction> = {
  $: { import: [SOLID, 'createMemo'], wrap: true, memo: true },
  $memo: { import: [SOLID, 'createMemo'], wrap: true, memo: true },
  $deferred: { import: [SOLID, 'createDeferred'], wrap: true },
  $mapArray: { import: [SOLID, 'mapArray'], wrap: true },
  $indexArray: { import: [SOLID, 'indexArray'], wrap: true },
  $children: { import: [SOLID, 'children'], wrap: true },
  $from: { import: [SOLID, 'from'] },
  $derefMemo: {},
};

/** CTFs that declare a writable variable. */
const SIGNALS = new Set(['$signal', '$derefSignal']);

/** CTFs that read the accessor or setter of a reactive variable. */
const REFERENCES = new Set(['$get', '$set', '$refSignal', '$refMemo']);

/** CTFs that turn an object property into a getter, a setter, or both. */
const PROPERTIES = new Set(['$getter', '$setter', '$property']);

/** Components that are imported when they are used without an import. */
const COMPONENTS: Record<string, string> = {
  For: SOLID,
  Show: SOLID,
  Switch: SOLID,
  Match: SOLID,
  Index: SOLID,
  ErrorBoundary: SOLID,
  Suspense: SOLID,
  SuspenseList: SOLID,
  Dynamic: WEB,
  Portal: WEB,
  Assets: WEB,
  HydrationScript: WEB,
  NoHydration: WEB,
};

/** Labels from `solid-labels`. They are not supported. */
const LABELS = new Set([
  'effect',
  'computed',
  'renderEffect',
  'mount',
  'cleanup',
  'error',
  'root',
  'untrack',
  'batch',
  'signal',
  'memo',
  'deferred',
  'destructure',
  'children',
]);

type Binding = { kind: 'signal'; setter: string } | { kind: 'accessor' };

export interface CTFOptions {
  /** The props parameter. Destructuring it keeps the props reactive. */
  props: string;
  fail: (message: string, offset: number) => never;
}

function isCall(node: Node | null | undefined, names?: Set<string>): node is CallExpression {
  return (
    node?.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    (names === undefined || names.has(node.callee.name))
  );
}

function getCallee(node: CallExpression): string {
  return (node.callee as Identifier).name;
}

function isFunction(node: Node | undefined): boolean {
  return node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression';
}

const ACCESSOR_NAMES = new Set(Object.keys(ACCESSORS));
const DESTRUCTURE = new Set(['$destructure']);
const DECLARATIONS = new Set([...SIGNALS, ...ACCESSOR_NAMES, ...DESTRUCTURE]);

/**
 * Replaces the compile-time functions in `code` and rewrites reads and writes
 * of reactive variables. `code` is TSX.
 */
export function transformCTF(code: string, options: CTFOptions): MagicString {
  // An explicit type lets TypeScript narrow after a call to `fail`.
  const fail: CTFOptions['fail'] = options.fail;
  const output = new MagicString(code);
  const program = parseProgram(code, fail);

  const imports = new Map<string, Map<string, string>>();
  const useImport = ([source, name]: Import): string => {
    let names = imports.get(source);
    if (!names) {
      names = new Map();
      imports.set(source, names);
    }
    const local = `__${name}`;
    names.set(name, local);
    return local;
  };

  let uid = 0;
  const unique = (name: string): string => `__${name}${uid++}`;

  // The first pass finds every declaration, so references can be resolved
  // even when a function uses a variable that is declared after it.
  const scopes = new ScopeTracker({ preserveExitedScopes: true });
  const bindings = new Map<Node, Binding>();
  walk(program, {
    scopeTracker: scopes,
    enter(node) {
      if (node.type !== 'VariableDeclarator') {
        return;
      }
      // A local function with the same name is not a CTF.
      if (isCall(node.init) && scopes.isDeclared(getCallee(node.init))) {
        return;
      }
      if (isCall(node.init, SIGNALS)) {
        if (node.id.type !== 'Identifier') {
          fail(`${getCallee(node.init)}() must be assigned to an identifier`, node.id.start);
        }
        bindings.set(node.id, { kind: 'signal', setter: `__set_${node.id.name}` });
      } else if (isCall(node.init, ACCESSOR_NAMES)) {
        if (node.id.type !== 'Identifier') {
          fail(`${getCallee(node.init)}() must be assigned to an identifier`, node.id.start);
        }
        bindings.set(node.id, { kind: 'accessor' });
      } else if (isDestructure(node)) {
        if (node.id.type !== 'ObjectPattern') {
          fail('Only object patterns can be destructured', node.id.start);
        }
        collectPattern(node.id, bindings);
      }
    },
  });
  scopes.freeze();

  const isCTF = (node: Node | null | undefined, names: Set<string>): node is CallExpression =>
    isCall(node, names) && !scopes.isDeclared(getCallee(node));

  function isDestructure(node: VariableDeclarator): boolean {
    return (
      isCall(node.init, DESTRUCTURE) ||
      (node.init?.type === 'Identifier' &&
        node.init.name === options.props &&
        node.id.type === 'ObjectPattern')
    );
  }

  function getBinding(node: Identifier): Binding | undefined {
    const declaration = scopes.getDeclaration(node.name);
    return declaration ? bindings.get(declaration.node) : undefined;
  }

  function getReactiveArgument(call: CallExpression): { name: string; binding: Binding } {
    const argument = call.arguments[0];
    const binding = argument?.type === 'Identifier' ? getBinding(argument) : undefined;
    if (argument?.type !== 'Identifier' || !binding) {
      return fail(`${getCallee(call)}() expects a reactive variable`, call.start);
    }
    return { name: argument.name, binding };
  }

  /** Wraps the first argument of a call in an arrow function. */
  function wrapArgument(call: CallExpression): void {
    const argument = call.arguments[0];
    if (argument && argument.type !== 'SpreadElement') {
      output.appendLeft(argument.start, '() => (');
      // Inserted on the right, so it comes after edits at the end of the argument.
      output.appendRight(argument.end, ')');
    }
  }

  function renameCallee(call: CallExpression, name: string): void {
    output.update(call.callee.start, call.callee.end, name);
  }

  function transformDeclarator(node: VariableDeclarator): void {
    const init = node.init as CallExpression;
    const name = getCallee(init);
    const id = node.id as Identifier;
    const annotation = id.typeAnnotation;
    // A type annotation on the variable becomes a type argument of the call.
    let typeArgument = '';
    if (annotation) {
      typeArgument = `<${code.slice(annotation.typeAnnotation.start, annotation.typeAnnotation.end)}>`;
      output.remove(annotation.start, annotation.end);
    }
    const hasTypeArguments = init.typeArguments != null;
    const setTypeArguments = (): void => {
      if (typeArgument && !hasTypeArguments) {
        output.appendLeft(init.callee.end, typeArgument);
      }
    };

    if (name === '$signal') {
      const binding = bindings.get(id) as { setter: string };
      output.update(id.start, id.start + id.name.length, `[${id.name}, ${binding.setter}]`);
      renameCallee(init, useImport([SOLID, 'createSignal']));
      setTypeArguments();
      return;
    }
    if (name === '$derefSignal') {
      const binding = bindings.get(id) as { setter: string };
      output.update(id.start, id.start + id.name.length, `[${id.name}, ${binding.setter}]`);
      unwrapCall(init);
      return;
    }
    const accessor = ACCESSORS[name]!;
    if (!accessor.import) {
      unwrapCall(init);
      return;
    }
    renameCallee(init, useImport(accessor.import));
    setTypeArguments();
    if (accessor.wrap) {
      wrapArgument(init);
    }
    const callOptions = init.arguments[1];
    if (accessor.memo && callOptions) {
      output.appendLeft(callOptions.start, 'undefined, ');
    }
  }

  /** Replaces `$fn(value)` with `value`. */
  function unwrapCall(call: CallExpression): void {
    const argument = call.arguments[0];
    if (!argument || call.arguments.length > 1) {
      fail(`${getCallee(call)}() takes one argument`, call.start);
    }
    output.remove(call.start, argument.start);
    output.remove(argument.end, call.end);
  }

  /**
   * Rewrites a destructuring declaration into one accessor per binding. The
   * source moves to the front. Default values and computed keys stay in place
   * and keep their order.
   */
  function transformDestructure(node: VariableDeclarator): void {
    const pattern = node.id as ObjectPattern;
    const init = node.init!;
    const isProps = !isCall(init);
    const source = isProps ? options.props : unique('source');
    let cursor = pattern.start;
    let pending = '';

    const flush = (end: number, text: string): void => {
      const content = pending + text;
      if (end > cursor) {
        output.update(cursor, end, content);
      } else if (content) {
        output.appendLeft(end, content);
      }
      pending = '';
      cursor = end;
    };

    if (isProps) {
      // Props are already an object, so the source is used directly.
      output.remove(pattern.end, init.end);
    } else {
      const call = init as CallExpression;
      unwrapCall(call);
      output.remove(pattern.end, init.start);
      output.move(init.start, init.end, pattern.start);
      output.prependRight(init.start, `${source} = `);
    }
    pending = isProps ? '' : ', ';

    const visit = (current: ObjectPattern, object: string): void => {
      const keys: string[] = [];
      for (const property of current.properties) {
        if (property.type === 'RestElement') {
          const argument = property.argument;
          if (argument.type !== 'Identifier') {
            fail('Expected an identifier', argument.start);
          }
          pending += `${argument.name} = ${useImport([SOLID, 'splitProps'])}(${object}, [${keys.join(', ')}])[1], `;
          continue;
        }
        let key: string;
        if (property.computed) {
          key = unique('key');
          flush(property.key.start, `${key} = `);
          cursor = property.key.end;
          pending = ', ';
        } else if (property.key.type === 'Identifier') {
          key = JSON.stringify(property.key.name);
        } else {
          key = code.slice(property.key.start, property.key.end);
        }
        keys.push(key);
        const read = `${object}[${key}]`;

        let value: BindingPattern = property.value;
        let fallback: string | undefined;
        if (value.type === 'AssignmentPattern') {
          fallback = unique('default');
          flush(value.right.start, `${fallback} = `);
          cursor = value.right.end;
          pending = ', ';
          value = value.left;
        }
        const getter = fallback
          ? `((value) => value === undefined ? ${fallback} : value)(${read})`
          : read;

        if (value.type === 'Identifier') {
          pending += `${value.name} = () => ${getter}, `;
        } else if (value.type === 'ObjectPattern') {
          const nested = unique('object');
          pending += `${nested} = () => ${getter}, `;
          visit(value, `${nested}()`);
        } else {
          fail('Only object patterns can be destructured', value.start);
        }
      }
    };
    visit(pattern, source);
    pending = pending.replace(/, $/, '');
    flush(pattern.end, '');
  }

  /** Rewrites `x = value`, `x += value` and similar for a signal. */
  function transformAssignment(node: AssignmentExpression, setter: string): void {
    const operator = node.operator;
    const prefix =
      operator === '='
        ? `${setter}(() => (`
        : `${setter}((__value) => __value ${operator.slice(0, -1)} (`;
    output.update(node.start, node.right.start, prefix);
    output.appendRight(node.end, '))');
  }

  const stack: Node[] = [];

  walk(program, {
    scopeTracker: scopes,
    leave() {
      stack.pop();
    },
    enter(node, parent) {
      stack.push(node);

      if (node.type === 'LabeledStatement' && LABELS.has(node.label.name)) {
        fail(
          `The "${node.label.name}:" label is not supported. Use a compile-time function instead`,
          node.start,
        );
      }

      if (node.type === 'JSXOpeningElement' && node.name.type === 'JSXIdentifier') {
        const source = COMPONENTS[node.name.name];
        if (source && !scopes.isDeclared(node.name.name)) {
          const names = imports.get(source) ?? new Map<string, string>();
          names.set(node.name.name, node.name.name);
          imports.set(source, names);
        }
        return;
      }

      if (node.type === 'VariableDeclarator') {
        // Only the callee and the pattern are replaced here. Arguments,
        // default values and computed keys are visited after this.
        if (isDestructure(node)) {
          transformDestructure(node);
        } else if (isCTF(node.init, DECLARATIONS)) {
          transformDeclarator(node);
        }
        return;
      }

      if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
        if (transformCall(node, parent)) {
          // The whole call is replaced.
          this.skip();
        }
        return;
      }

      if (node.type === 'Identifier') {
        transformIdentifier(node, parent);
      }
    },
  });

  /** Returns true if the whole call is replaced. */
  function transformCall(node: CallExpression, parent: Node | null): boolean {
    const name = getCallee(node);
    if (!name.startsWith('$') || scopes.isDeclared(name)) {
      return false;
    }
    const alias = ALIASES[name];
    if (alias) {
      renameCallee(node, useImport(alias));
      return false;
    }
    const wrapped = WRAPPED[name];
    if (wrapped) {
      renameCallee(node, useImport(wrapped));
      if (name !== '$root' || !isFunction(node.arguments[0] as Node | undefined)) {
        wrapArgument(node);
      }
      return false;
    }
    if (REFERENCES.has(name)) {
      const { name: variable, binding } = getReactiveArgument(node);
      const setter = binding.kind === 'signal' ? binding.setter : undefined;
      let text: string;
      if (name === '$get' || name === '$refMemo') {
        text = variable;
      } else if (setter) {
        text = name === '$set' ? setter : `[${variable}, ${setter}]`;
      } else {
        return fail(`${name}() expects a signal`, node.start);
      }
      output.update(node.start, node.end, text);
      return true;
    }
    if (PROPERTIES.has(name)) {
      transformProperty(node, name, parent);
      return true;
    }
    if (name === '$' && parent?.type === 'ExpressionStatement') {
      renameCallee(node, useImport([SOLID, 'createEffect']));
      wrapArgument(node);
      return false;
    }
    if (DECLARATIONS.has(name)) {
      const declarator = parent?.type === 'VariableDeclarator' && parent.init === node;
      if (!declarator) {
        fail(`${name}() can only be used in a variable declaration`, node.start);
      }
    }
    return false;
  }

  function transformProperty(node: CallExpression, name: string, parent: Node | null): void {
    if (parent?.type !== 'Property' || parent.value !== node || parent.kind !== 'init') {
      fail(`${name}() can only be used as an object property value`, node.start);
    }
    const { name: variable, binding } = getReactiveArgument(node);
    const key = parent.computed
      ? `[${code.slice(parent.key.start, parent.key.end)}]`
      : code.slice(parent.key.start, parent.key.end);
    const members: string[] = [];
    if (name !== '$setter') {
      members.push(`get ${key}() { return ${variable}(); }`);
    }
    if (name !== '$getter' && binding.kind === 'signal') {
      members.push(`set ${key}(__value) { ${binding.setter}(() => __value); }`);
    } else if (name === '$setter') {
      fail('$setter() expects a signal', node.start);
    }
    output.update(parent.start, parent.end, members.join(', '));
  }

  function transformIdentifier(node: Identifier, parent: Node | null): void {
    if (!parent || !isReferenceIdentifier(node, parent) || parent.type === 'TSTypeQuery') {
      return;
    }
    // Keys and bindings inside a destructuring pattern are not references.
    if (parent.type === 'Property' && stack[stack.length - 3]?.type === 'ObjectPattern') {
      return;
    }
    const declaration = scopes.getDeclaration(node.name);
    const binding = declaration ? bindings.get(declaration.node) : undefined;
    if (!binding || declaration?.node === node) {
      return;
    }

    if (parent.type === 'AssignmentExpression' && parent.left === node) {
      if (binding.kind !== 'signal') {
        fail(`Cannot assign to "${node.name}" because it is read-only`, node.start);
      }
      transformAssignment(parent, binding.setter);
      return;
    }
    if (parent.type === 'UpdateExpression') {
      if (binding.kind !== 'signal') {
        fail(`Cannot assign to "${node.name}" because it is read-only`, node.start);
      }
      const operator = parent.operator === '++' ? '+' : '-';
      const grandparent = stack[stack.length - 3];
      const isStatement =
        grandparent?.type === 'ExpressionStatement' ||
        (grandparent?.type === 'ForStatement' && grandparent.update === parent);
      const update = `${binding.setter}((__value) => __value ${operator} 1)`;
      output.update(
        parent.start,
        parent.end,
        parent.prefix || isStatement
          ? update
          : `((__value) => (${binding.setter}(__value ${operator} 1), __value))(${node.name}())`,
      );
      return;
    }
    if (
      parent.type === 'ArrayPattern' ||
      (parent.type === 'AssignmentPattern' && parent.left === node) ||
      parent.type === 'RestElement' ||
      (parent.type === 'ForOfStatement' && parent.left === node) ||
      (parent.type === 'ForInStatement' && parent.left === node)
    ) {
      fail(`Cannot destructure into the reactive variable "${node.name}"`, node.start);
    }
    if (parent.type === 'ExportSpecifier') {
      fail(`Cannot export the reactive variable "${node.name}"`, node.start);
    }
    if (parent.type === 'Property' && parent.shorthand) {
      output.update(parent.start, parent.end, `${node.name}: ${node.name}()`);
      return;
    }
    output.appendLeft(node.end, '()');
  }

  const statements: string[] = [];
  for (const [source, names] of imports) {
    const specifiers = [...names].map(([name, local]) =>
      name === local ? name : `${name} as ${local}`,
    );
    statements.push(`import { ${specifiers.join(', ')} } from '${source}';\n`);
  }
  output.prepend(statements.join(''));
  return output;
}

function collectPattern(pattern: ObjectPattern, bindings: Map<Node, Binding>): void {
  for (const property of pattern.properties) {
    if (property.type === 'RestElement') {
      continue;
    }
    let value: BindingPattern = property.value;
    if (value.type === 'AssignmentPattern') {
      value = value.left;
    }
    if (value.type === 'Identifier') {
      bindings.set(value, { kind: 'accessor' });
    } else if (value.type === 'ObjectPattern') {
      collectPattern(value, bindings);
    }
  }
}

function parseProgram(code: string, fail: (message: string, offset: number) => never): Program {
  const result = parseSync('component.tsx', code, { sourceType: 'module', lang: 'tsx' });
  const error = result.errors[0];
  if (error) {
    fail(error.message, error.labels[0]?.start ?? 0);
  }
  return result.program as unknown as Program;
}
