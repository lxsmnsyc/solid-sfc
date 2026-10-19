// Packages the extension. `vsce` never packages `node_modules`, so this adds
// the TypeScript plugin package to the archive afterwards.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writePluginPack } from './plugin-pack.mjs';

const out = path.resolve(process.argv[2] ?? 'solid-sfc.vsix');
execFileSync('vsce', ['package', '--no-dependencies', '--out', out], { stdio: 'inherit' });

const stage = mkdtempSync(path.join(tmpdir(), 'solid-sfc-vsix-'));
try {
  writePluginPack(path.join(stage, 'extension'));
  execFileSync('zip', ['-r', out, 'extension'], { cwd: stage, stdio: 'ignore' });
} finally {
  rmSync(stage, { recursive: true, force: true });
}
console.log(`Added the TypeScript plugin package to ${path.basename(out)}`);
