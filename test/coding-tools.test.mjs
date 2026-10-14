import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('execute_bash tool', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-lib-test-'));
  process.env.AGENT_WORKSPACE = root;
  process.env.ALLOW_COMMAND_EXECUTION = 'true';

  const { runAgentTool } = await import('../dist/index.js');

  try {
    const result = await runAgentTool('execute_bash', { command: 'echo "hello from bash"' });
    assert.deepEqual(typeof result, 'object');
    assert.match(result.stdout, /hello from bash/);
    assert.equal(result.code, 0);

    // Test with cwd
    const subDir = path.join(root, 'subdir');
    await fs.mkdir(subDir);
    const pwdResult = await runAgentTool('execute_bash', { command: 'pwd', cwd: subDir });
    assert.match(pwdResult.stdout, new RegExp(subDir));

    // Test command failure returns code and stderr
    const failResult = await runAgentTool('execute_bash', { command: 'exit 42' });
    assert.equal(failResult.code, 42);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
