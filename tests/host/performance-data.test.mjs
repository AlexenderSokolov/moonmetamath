import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyData } from '../../scripts/fetch-performance-data.mjs';

test('performance corpus refuses changed bytes, length and Git blob identity', () => {
  const data = Buffer.from('pinned input');
  const record = { id: 'test', bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), git_blob_sha: createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex') };
  verifyData(record, data);
  assert.throws(() => verifyData(record, Buffer.from('pinned Input')), /do not match/);
  assert.throws(() => verifyData({ ...record, bytes: data.length + 1 }, data), /do not match/);
  assert.throws(() => verifyData({ ...record, git_blob_sha: '0'.repeat(40) }, data), /do not match/);
});
