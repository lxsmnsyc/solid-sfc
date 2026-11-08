import { describe, expect, it } from 'vitest';
import solidSFC, { renameManifestModules, withStyleExclude } from '../src/vite.ts';

function isExcluded(exclude: unknown, id: string): boolean {
  const patterns = Array.isArray(exclude) ? exclude : [exclude];
  for (const pattern of patterns) {
    if (pattern instanceof RegExp && pattern.test(id)) {
      return true;
    }
  }
  return false;
}

describe('style query exclusion', () => {
  it('excludes style query ids from the Solid plugin filter', () => {
    const { exclude } = withStyleExclude({});
    expect(isExcluded(exclude, '/a/App.solid?solid-sfc&type=style&inline&lang.css')).toBe(true);
    expect(isExcluded(exclude, '/a/App.solid?solid-sfc&type=style&lang.scss.js')).toBe(true);
    expect(isExcluded(exclude, '/a/App.solid')).toBe(false);
    expect(isExcluded(exclude, '/a/App.tsx')).toBe(false);
  });

  it('keeps the exclude patterns of the user', () => {
    const user = /legacy/;
    expect(withStyleExclude({ exclude: user }).exclude).toContain(user);
    expect(withStyleExclude({ exclude: [user] }).exclude).toContain(user);
    expect(withStyleExclude({ exclude: [user] }).exclude).toHaveLength(2);
  });

  it('builds the plugin list', () => {
    expect(solidSFC().length).toBeGreaterThan(1);
  });
});

describe('server function manifest', () => {
  it('renames the modules of the array shape', () => {
    expect(renameManifestModules(['src/App.solid.tsx', 'src/b.ts'])).toEqual([
      'src/App.solid',
      'src/b.ts',
    ]);
  });

  it('renames the modules of the object shape and keeps the other keys', () => {
    const functions = [{ id: 'f1', name: 'save', module: 'src/App.solid.tsx' }];
    expect(
      renameManifestModules({
        modules: ['src/App.solid.tsx', 'src/b.ts'],
        functions,
        buildId: 'abc',
      }),
    ).toEqual({ modules: ['src/App.solid', 'src/b.ts'], functions, buildId: 'abc' });
  });
});
