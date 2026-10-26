import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root } from './common.mjs';

export function verifyData(record, bytes) {
  const sha = createHash('sha256').update(bytes).digest('hex');
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (bytes.length !== record.bytes || sha !== record.sha256 || blob !== record.git_blob_sha) {
    throw new Error(`Pinned bytes do not match: ${record.id}`);
  }
}
export async function acquire(lock, { offline = false } = {}) {
  const folder = resolve(root, '.references/performance');
  await mkdir(folder, { recursive: true });
  const files = [...lock.files, {
    id: 'LICENSE', path: lock.source.license_path, sha256: lock.source.license_sha256,
    url: `https://raw.githubusercontent.com/${lock.source.repo}/${lock.source.commit}/LICENSE`,
  }];
  for (const record of files) {
    const file = resolve(root, record.path);
    if (!file.startsWith(folder + sep)) throw new Error('Dataset path must stay in .references/performance');
    let bytes;
    try { bytes = await readFile(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!bytes) {
      if (offline) throw new Error(`Missing pinned file in offline mode: ${record.id}`);
      const response = await fetch(record.url, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error(`Fetch ${record.id}: ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      // Check before adopting downloaded bytes, never overwrite a mismatched cache.
      if (record.id !== 'LICENSE') verifyData(record, bytes);
      else if (createHash('sha256').update(bytes).digest('hex') !== record.sha256) throw new Error('License checksum mismatch');
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, bytes, { flag: 'wx' });
    }
    if (record.id !== 'LICENSE') verifyData(record, bytes);
    else if (createHash('sha256').update(bytes).digest('hex') !== record.sha256) throw new Error('License checksum mismatch');
    console.log(`${record.id}: ${bytes.length} pinned bytes verified`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some(arg => arg !== '--offline')) throw new Error('Usage: node scripts/fetch-performance-data.mjs [--offline]');
  const lock = JSON.parse(await readFile(resolve(root, 'benchmarks/databases.lock.json'), 'utf8'));
  await acquire(lock, { offline: process.argv.includes('--offline') });
}
