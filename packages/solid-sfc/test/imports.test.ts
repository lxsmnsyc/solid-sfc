import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { compile, compileStructure } from '../src/index.ts';

function structure(source: string): string {
  const { code } = compileStructure(source, { filename: 'Imports.solid' });
  const { errors } = parseSync('out.tsx', code, { lang: 'tsx', sourceType: 'module' });
  expect(errors.map((error) => error.message)).toEqual([]);
  return code;
}

function imports(code: string): string[] {
  return code.split('\n').filter((line) => line.startsWith('import '));
}

describe('imports in block scripts', () => {
  it('moves them to the top of the module', () => {
    const code = structure(
      "#for (item of items) {\n  <script>\n    import { format } from './format';\n    const label = format(item);\n  </script>\n  <p>{label}</p>\n}",
    );
    expect(imports(code)).toEqual(["import { format } from './format';"]);
    expect(code).toContain('const label = format(item);');
    expect(code.indexOf("from './format'")).toBeLessThan(code.indexOf('export default'));
  });

  it('writes default, namespace, type and side effect imports', () => {
    const code = structure(
      "#if (a) {\n  <script>\n    import './a.css';\n    import Icon, * as icons from './icons';\n    import type { Item } from './item';\n    import { type Row, rows } from './rows';\n    const item: Item = rows[0] as Row;\n  </script>\n  <Icon />{icons.x}{item}\n}",
    );
    expect(imports(code)).toEqual([
      "import './a.css';",
      "import Icon from './icons';",
      "import * as icons from './icons';",
      "import { rows } from './rows';",
      "import type { Item } from './item';",
      "import { type Row } from './rows';",
    ]);
  });

  it('writes an import that is the same as another one once', () => {
    const code = structure(
      "<script>\n  import { format } from './format';\n</script>\n#if (a) {\n  <script>\n    import { format } from './format';\n    import { parse } from './parse';\n  </script>\n  {format(1)}\n}\n#if (b) {\n  <script>\n    import { parse } from './parse';\n    import type { format as F } from './format';\n  </script>\n  {parse(1)}\n}",
    );
    expect(imports(code)).toEqual([
      "import { format } from './format';",
      "import { parse } from './parse';",
      "import type { format as F } from './format';",
    ]);
  });

  it('renames a name that something else in the file declares', () => {
    const code = structure(
      "<script>\n  const format = (value: number) => String(value);\n</script>\n#if (a) {\n  <script>\n    import { format } from './format';\n    const text = format(1);\n    const all = { format };\n  </script>\n  <p title=format(2)>{format(3)}{text}{all}</p>\n}\n{format(4)}",
    );
    expect(imports(code)).toEqual(["import { format as format_1 } from './format';"]);
    expect(code).toContain('const text = format_1(1);');
    expect(code).toContain('const all = { format: format_1 };');
    expect(code).toContain('<p title={format_1(2)}>{format_1(3)}');
    expect(code).toContain('{format(4)}');
  });

  it('renames names that blocks import from different modules', () => {
    const code = structure(
      "#if (a) {\n  <script>\n    import Card from './a';\n  </script>\n  <Card />\n}\n#if (b) {\n  <script>\n    import { Card } from './b';\n    type Props = Parameters<typeof Card>[0];\n  </script>\n  <Card></Card>\n}",
    );
    expect(imports(code)).toEqual([
      "import Card_1 from './a';",
      "import { Card as Card_2 } from './b';",
    ]);
    expect(code).toContain('<Card_1 />');
    expect(code).toContain('type Props = Parameters<typeof Card_2>[0];');
    expect(code).toContain('<Card_2></Card_2>');
  });

  it('renames a name that a loop variable shadows', () => {
    const code = structure(
      "#for (item of items) {\n  #if (item) {\n    <script>\n      import { item as entry } from './item';\n      import item from './default';\n    </script>\n    {item}{entry}\n  }\n}",
    );
    expect(imports(code)).toContain("import item_1 from './default';");
    expect(code).toContain('{item_1}{entry}');
  });

  it('renames types', () => {
    const code = structure(
      "<script>\n  interface Item { id: number }\n</script>\n#if (a) {\n  <script>\n    import type { Item } from './item';\n    let selected: Item | undefined;\n  </script>\n  {selected}\n}",
    );
    expect(imports(code)).toEqual(["import type { Item as Item_1 } from './item';"]);
    expect(code).toContain('let selected: Item_1 | undefined;');
  });

  it('compiles with the compile-time functions', () => {
    const { code } = compile(
      "#for (item of items) {\n  <script>\n    import { format } from './format';\n    let open = $signal(false);\n  </script>\n  <button onClick=(() => (open = !open))>{format(item)}</button>\n}",
      { filename: 'Imports.solid' },
    );
    expect(code).toContain("import { format } from './format';");
    expect(code).toContain('format(item)');
  });
});
