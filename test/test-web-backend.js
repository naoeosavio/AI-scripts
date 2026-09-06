const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const WEB_SRC = path.join(__dirname, '..', 'src', 'web');
const CACHE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tell-web-backend-'));

function loadModule(name) {
  const source = fs.readFileSync(path.join(WEB_SRC, name), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const file = path.join(CACHE_DIR, name.replace(/\.ts$/, '.cjs'));
  fs.writeFileSync(file, js);
  return require(file);
}

const { parseCliArgs, printHelp } = loadModule('cli-args.ts');
const { resolveWithin } = loadModule('paths.ts');
const {
  emptySession,
  loadSession,
  saveSession,
  createSnapshot,
  listHistory,
  sessionPath,
  historyDir,
  sessionDir,
} = loadModule('session.ts');
const { buildProjectContext } = loadModule('context-builder.ts');

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL - ${name}: ${err.message}`);
  }
}

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tell-web-fixture-'));
}

// ---------------------------------------------------------------------------
// CLI args (flag-with-flag)
// ---------------------------------------------------------------------------
test('cli: --cwd followed by a flag is not swallowed', () => {
  const args = parseCliArgs(['--cwd', '--prompt', 'x'], '/tmp/defcwd');
  assert.strictEqual(args.cwd, path.resolve('/tmp/defcwd'));
  assert.strictEqual(args.initialPrompt, 'x');
});

test('cli: --prompt followed by a flag is not swallowed', () => {
  const args = parseCliArgs(['--prompt', '--chain'], '/tmp/defcwd');
  assert.strictEqual(args.initialPrompt, undefined);
  assert.strictEqual(args.chain, true);
});

test('cli: normal values still parse', () => {
  const args = parseCliArgs(['--cwd', '/tmp/proj', '--prompt', 'hello', '-m', 'g'], '/tmp/defcwd');
  assert.strictEqual(args.cwd, '/tmp/proj');
  assert.strictEqual(args.initialPrompt, 'hello');
  assert.strictEqual(args.model, 'g');
});

test('cli: --port parses numeric values only', () => {
  assert.strictEqual(parseCliArgs(['--port', '4000'], '/tmp').port, 4000);
  assert.strictEqual(parseCliArgs(['--port', '--chain'], '/tmp').port, undefined);
  assert.strictEqual(parseCliArgs(['--port', 'abc'], '/tmp').port, undefined);
});

test('cli: --help/-h is detected', () => {
  assert.strictEqual(parseCliArgs(['--help'], '/tmp').help, true);
  assert.strictEqual(parseCliArgs(['-h'], '/tmp').help, true);
  assert.strictEqual(parseCliArgs([], '/tmp').help, false);
});

test('cli: printHelp runs without throwing', () => {
  printHelp();
});

// ---------------------------------------------------------------------------
// Path traversal guard
// ---------------------------------------------------------------------------
test('paths: relative traversal is rejected', () => {
  assert.strictEqual(resolveWithin('/base/proj', '../outside.txt'), null);
  assert.strictEqual(resolveWithin('/base/proj', '../../etc/passwd'), null);
});

test('paths: absolute path outside base is rejected', () => {
  assert.strictEqual(resolveWithin('/base/proj', '/etc/passwd'), null);
});

test('paths: sibling prefix directory is rejected', () => {
  assert.strictEqual(resolveWithin('/base/proj', '../proj-evil/secret'), null);
});

test('paths: nested path inside base resolves', () => {
  assert.strictEqual(resolveWithin('/base/proj', 'src/app.ts'), path.resolve('/base/proj/src/app.ts'));
});

// ---------------------------------------------------------------------------
// Session robustness
// ---------------------------------------------------------------------------
test('session: partial malformed session loads with defaults', () => {
  const dir = tmpProject();
  fs.mkdirSync(sessionDir(dir), { recursive: true });
  fs.writeFileSync(
    sessionPath(dir),
    JSON.stringify({ messages: 'oops', terminal: { tabs: 'nope', activeTabId: 7 }, stats: 'junk' }),
  );
  const session = loadSession(dir);
  assert.ok(session);
  assert.deepStrictEqual(session.messages, []);
  assert.deepStrictEqual(session.terminal.tabs, []);
  assert.strictEqual(session.terminal.activeTabId, '');
  assert.deepStrictEqual(session.stats, { commandsRun: 0, aiTurns: 0, snapshots: 0 });
});

test('session: garbage file loads as null, not crash', () => {
  const dir = tmpProject();
  fs.mkdirSync(sessionDir(dir), { recursive: true });
  fs.writeFileSync(sessionPath(dir), '{not json at all');
  assert.strictEqual(loadSession(dir), null);
});

test('session: oversized session is refused by saveSession', () => {
  const dir = tmpProject();
  const session = emptySession(dir);
  session.messages = [{ role: 'user', content: 'x'.repeat(3 * 1024 * 1024) }];
  assert.strictEqual(saveSession(dir, session), false);
});

test('session: oversized snapshot is refused by createSnapshot', () => {
  const dir = tmpProject();
  const session = emptySession(dir);
  session.messages = [{ role: 'user', content: 'x'.repeat(3 * 1024 * 1024) }];
  assert.strictEqual(createSnapshot(dir, session), null);
});

test('session: listHistory sorts by numeric mtime', () => {
  const dir = tmpProject();
  const session = emptySession(dir);
  const old = createSnapshot(dir, session);
  const recent = createSnapshot(dir, session);
  assert.ok(old && recent);
  // Backdate the first snapshot so ISO-string sorting would misorder ties.
  const oldPath = path.join(historyDir(dir), old);
  const past = new Date(Date.now() - 60_000);
  fs.utimesSync(oldPath, past, past);
  const history = listHistory(dir);
  assert.strictEqual(history[0].name, recent);
  assert.strictEqual(history[history.length - 1].name, old);
});

test('session: dangling latest symlink is repaired by listHistory', () => {
  const dir = tmpProject();
  const session = emptySession(dir);
  createSnapshot(dir, session);
  const latest = path.join(sessionDir(dir), 'latest');
  fs.unlinkSync(latest);
  fs.symlinkSync(path.join('history', 'does-not-exist.json'), latest);
  listHistory(dir); // should remove the dangling link, not crash
  assert.strictEqual(fs.existsSync(latest), false);
});

// ---------------------------------------------------------------------------
// Context builder (symlink loop + CLAUDE.md)
// ---------------------------------------------------------------------------
test('context: symlink loop does not hang and is skipped', () => {
  const dir = tmpProject();
  fs.mkdirSync(path.join(dir, 'a'));
  fs.writeFileSync(path.join(dir, 'a', 'file.txt'), 'hi');
  fs.symlinkSync(path.join(dir, 'a'), path.join(dir, 'a', 'self-loop'));
  fs.symlinkSync(path.join(dir, 'a'), path.join(dir, 'parent-loop'));
  const ctx = buildProjectContext(dir);
  assert.ok(ctx.tree.includes('a/'));
  assert.ok(ctx.tree.includes('file.txt'));
  assert.ok(!ctx.tree.includes('self-loop'));
  assert.ok(!ctx.tree.includes('parent-loop'));
});

test('context: CLAUDE.md is matched as agents doc', () => {
  const dir = tmpProject();
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'claude conventions');
  const ctx = buildProjectContext(dir);
  assert.ok(ctx.agents && ctx.agents.includes('claude conventions'));
});

test('context: agents.md is matched as agents doc', () => {
  const dir = tmpProject();
  fs.writeFileSync(path.join(dir, 'agents.md'), 'agents conventions');
  const ctx = buildProjectContext(dir);
  assert.ok(ctx.agents && ctx.agents.includes('agents conventions'));
});

test('context: oversized doc is partially read, not exploded', () => {
  const dir = tmpProject();
  fs.writeFileSync(path.join(dir, 'README.md'), '# Big\n' + 'a'.repeat(128 * 1024));
  const ctx = buildProjectContext(dir);
  assert.ok(ctx.readme);
  assert.ok(ctx.readme.includes('[truncated'));
  assert.ok(ctx.readme.length < 128 * 1024);
});

if (failures > 0) {
  process.exit(1);
}
console.log('\nAll web backend tests passed.');
