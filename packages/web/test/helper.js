// Shared helper: transpile a src/web .ts module (and its relative deps) to CJS.
// Output goes to test/.tmp/ so bare imports (node-pty, ws) resolve via src/web/node_modules.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.join(__dirname, '..');
const CACHE_DIR = path.join(__dirname, '.tmp');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const compiled = new Map();

function compiledPath(name) {
  const abs = path.join(WEB_SRC, name);
  if (compiled.has(abs)) return compiled.get(abs);
  const source = fs.readFileSync(abs, 'utf8');
  let js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  // Rewrite relative requires to the transpiled dependency output.
  js = js.replace(/require\(["'](\.[^"']*)["']\)/g, (_m, rel) => {
    let resolved = path.normalize(path.join(path.dirname(name), rel));
    if (!/\.[a-z]+$/i.test(resolved)) resolved += '.ts';
    return `require(${JSON.stringify(compiledPath(resolved))})`;
  });
  const file = path.join(CACHE_DIR, name.replace(/\//g, '_').replace(/\.ts$/, '.cjs'));
  fs.writeFileSync(file, js);
  compiled.set(abs, file);
  return file;
}

function loadModule(name) {
  const file = compiledPath(name);
  delete require.cache[file];
  return require(file);
}

export { loadModule, WEB_SRC };
