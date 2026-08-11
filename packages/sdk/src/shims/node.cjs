function platform() {
  return 'browser';
}

function arch() {
  return 'x64';
}

function hostname() {
  return 'browser';
}

function homedir() {
  return '/';
}

function tmpdir() {
  return '/tmp';
}

function join(...parts) {
  return parts.join('/');
}

function resolve(...parts) {
  return parts.join('/');
}

function dirname() {
  return '/';
}

function basename(path) {
  return String(path).split('/').pop() ?? '';
}

function extname() {
  return '';
}

function normalize(path) {
  return path;
}

function relative() {
  return '';
}

function isAbsolute() {
  return false;
}

function existsSync() {
  return false;
}

function readFileSync() {
  return '';
}

function writeFileSync() {}

function mkdirSync() {}

function chmodSync() {}

function unlinkSync() {}

function rmSync() {}

function readdirSync() {
  return [];
}

function statSync() {
  return {};
}

function realpathSync(path) {
  return path;
}

module.exports = {
  platform,
  arch,
  hostname,
  homedir,
  tmpdir,
  join,
  resolve,
  dirname,
  basename,
  extname,
  normalize,
  relative,
  isAbsolute,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  chmodSync,
  unlinkSync,
  rmSync,
  readdirSync,
  statSync,
  realpathSync,
};
