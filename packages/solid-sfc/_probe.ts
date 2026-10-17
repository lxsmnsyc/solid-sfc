import { readFileSync } from 'node:fs';
import { compile } from './src/index.ts';
const file = process.argv[2]!;
console.log(compile(readFileSync(file, 'utf8'), { filename: file.split('/').pop() }).code);
