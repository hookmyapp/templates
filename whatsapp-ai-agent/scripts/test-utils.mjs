import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

export function loadErrors(console = { error() {} }) {
  const context = { exports: {}, console };
  vm.runInNewContext(ts.transpileModule(
    readFileSync(new URL('../lib/errors.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText, context);
  return context.exports;
}
