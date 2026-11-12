import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { CompileError } from '../../src/labels/index.ts';
import transform from './util';

function parses(code: string): boolean {
  return parseSync('out.tsx', code, { lang: 'tsx', sourceType: 'module' }).errors.length === 0;
}

describe('writes', () => {
  it('does not leave await inside the setter callback', () => {
    const out = transform('let x = $signal(0);\nasync function f() { x += await g(); }');
    expect(parses(out)).toBe(true);
    expect(out).toContain('const tmp_1 = await g();');
    expect(out).not.toMatch(/setX\([^)]*await/);
  });

  it('compiles a write through a non-null or type assertion like a plain write', () => {
    const plain = transform('let x = $signal(0);\nx = 1;');
    expect(transform('let x = $signal(0);\nx! = 1;')).toBe(plain);
    expect(transform('let x = $signal(0);\n(x as any) = 1;')).toBe(plain);
  });

  it('closes the setter call of a write inside another write', () => {
    const out = transform('let s = $signal(0);\nlet t = $signal(0);\ns = t++;');
    expect(parses(out)).toBe(true);
  });

  it('compiles a write in a concise async arrow', () => {
    const out = transform('let x = $signal(0);\nconst f = async () => x = await g();');
    expect(parses(out)).toBe(true);
  });

  it('reports a write in a for-of head as unsupported', () => {
    expect(() => transform('let x = $signal(0);\nfor (x of xs) {}')).toThrow(CompileError);
    expect(() => transform('let x = $signal(0);\nfor (x of xs) {}')).toThrow(/Unsupported write/);
  });
});

describe('arrow CTFs', () => {
  it('keeps the arrow around an argument that starts with an alias or a CTF', () => {
    const out = transform('const m = $memo($latest(x));');
    expect(out).toMatch(/_createMemo\(\(\) => _latest\(\(\) => x\)\)/);
  });

  it('wraps the argument of $isPending and $latest unless it is a function', () => {
    expect(transform('const a = $isPending(q);')).toContain('_isPending(() => q)');
    expect(transform('const a = $latest(() => q);')).toContain('_latest(() => q)');
  });
});

describe('dev names', () => {
  it('puts the name option after the argument', () => {
    const out = transform('let c = $signal(0);\nconst m = $memo((c + 1));', { dev: true });
    expect(parses(out)).toBe(true);
    expect(out).toContain('{ name: "m" }');
    expect(out).toContain('_createMemo((() => c() + 1), { name: "m" })');
  });
});

describe('new compile-time functions', () => {
  const cases: [string, string, string][] = [
    ['const a = $onFlush(fn);', 'onFlush as _onFlush', '_onFlush(fn)'],
    ['const a = $isDisposed();', 'isDisposed as _isDisposed', '_isDisposed()'],
    ['const a = $observer();', 'getObserver as _getObserver', '_getObserver()'],
    ['const a = $from(src);', 'from as _from', '_from(src)'],
    ['const a = $flatten(src);', 'flatten as _flatten', '_flatten(src)'],
    ['$useHead(tags);', 'useHead as _useHead', '_useHead(tags)'],
    ['const a = $isWrappable(v);', 'isWrappable as _isWrappable', '_isWrappable(v)'],
    ['const a = $until(cond);', 'until as _until', '_until(() => cond)'],
    ['const a = $lazyModule(load);', 'lazyModule as _lazyModule', '_lazyModule(() => load)'],
    ['const a = $clientOnly(load);', 'clientOnly as _clientOnly', '_clientOnly(() => load)'],
    ['const d = $deferred(v);', 'createDeferred as _createDeferred', '_createDeferred(() => v)'],
  ];
  for (const [source, importText, callText] of cases) {
    it(`compiles ${source}`, () => {
      const out = transform(source);
      expect(out).toContain(importText);
      expect(out).toContain(callText);
      expect(out).not.toMatch(/\$[a-zA-Z]+\(/);
      expect(parses(out)).toBe(true);
    });
  }

  it('reads a $deferred result as an accessor', () => {
    const out = transform('let n = $signal(0);\nconst d = $deferred(n);\nconsole.log(d);');
    expect(out).toContain('_createDeferred(() => n())');
    expect(out).toContain('console.log(d())');
  });
});

describe('namespace components', () => {
  it('rejects a namespace component the registry does not have', () => {
    expect(() => transform('const a = <solid:for each={x} />;')).toThrow(/Unknown namespace/);
  });
});
