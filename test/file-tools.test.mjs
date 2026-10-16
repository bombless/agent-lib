import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('readFile and replaceLines preserve safe, deterministic file editing behavior', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-lib-file-tools-'));
  process.env.AGENT_WORKSPACE = root;
  process.env.MAX_READ_FILE_BYTES = '8';
  process.env.MAX_READ_FILE_LINES = '2';
  const { readFile, replaceLines } = await import('../dist/file-tools.js');
  const file = path.join(root, 'sample.txt');
  try {
    await fs.writeFile(file, 'alpha\r\nbeta\r\ngamma\r\n', 'utf8');
    const range = await readFile({ path: file, startLine: 2, endLine: 3 });
    assert.equal(range.numberedContent, '2 | beta\n3 | gamma');
    assert.equal(range.lineCount, 3);
    const full = await readFile({ path: file });
    assert.match(full.message, /specify startLine and endLine/);

    const mismatch = await replaceLines({ path: file, startLine: 2, endLine: 2, oldText: 'wrong', newText: 'delta' });
    assert.equal(mismatch.success, false);
    assert.equal(mismatch.error.code, 'CONTENT_MISMATCH');
    assert.equal(await fs.readFile(file, 'utf8'), 'alpha\r\nbeta\r\ngamma\r\n');

    const replaced = await replaceLines({ path: file, startLine: 2, endLine: 2, oldText: 'beta', newText: 'delta' });
    assert.equal(replaced.success, true);
    assert.equal(await fs.readFile(file, 'utf8'), 'alpha\r\ndelta\r\ngamma\r\n');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
