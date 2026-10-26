import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readBundle, root } from '../../bin/host.mjs';

mkdirSync(join(root, 'artifacts'), { recursive: true });
const dir = mkdtempSync(join(root, 'artifacts', 'source-reader-memory-'));
const large = join(dir, 'many-tokens.mm');
const tokenCount = 6 * 1024 * 1024;
writeFileSync(large, 'a '.repeat(tokenCount));
function bounded(name, source) {
  const run = spawnSync(process.execPath, ['--max-old-space-size=64', '--input-type=module', '--eval', source], { cwd: root, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024, windowsHide: true });
  writeFileSync(join(dir, `${name}.stdout.txt`), run.stdout ?? '');
  writeFileSync(join(dir, `${name}.stderr.txt`), run.stderr ?? '');
  assert.equal(run.error, undefined, run.error?.message);
  return run;
}

test('negative control: the old eager token array exhausts a bounded 64MiB subprocess', () => {
  const run = bounded('old-eager', String.raw`import {readFileSync} from 'node:fs';
    const text=readFileSync(${JSON.stringify(large)}).toString('latin1');
    const tokens=text.replace(/\$\([\s\S]*?\$\)/g,' ').match(/\S+/g)??[];
    console.log(JSON.stringify({tokens:tokens.length}));`);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /heap out of memory/i);
});

test('source reader handles the same many-token input in a bounded 64MiB subprocess', () => {
  const run = bounded('source-reader', `import {readBundle} from ${JSON.stringify(pathToFileURL(join(root, 'bin', 'host.mjs')).href)};
    const bundle=readBundle(${JSON.stringify(large)});
    console.log(JSON.stringify({entry:bundle.entry,sources:bundle.sources.length,characters:bundle.sources[0].text.length}));`);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), { entry: 'many-tokens.mm', sources: 1, characters: tokenCount * 2 });
});

test('source reader releases the large scan input from the legacy RegExp cache', () => {
  const run = bounded('regexp-cache', `import {readBundle} from ${JSON.stringify(pathToFileURL(join(root, 'bin', 'host.mjs')).href)};
    const bundle=readBundle(${JSON.stringify(large)});
    const retained=RegExp.input.length;
    console.log(JSON.stringify({retained,characters:bundle.sources[0].text.length}));`);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), { retained: 0, characters: tokenCount * 2 });
});

test('include traversal keeps comment stripping, depth-first source order, deduplication and exact bytes', () => {
  const tree = join(dir, 'tree');
  mkdirSync(join(tree, 'nested'), { recursive: true });
  const entry = '$( ignored\r\n $[ absent-comment.mm $] $)\r\n$[ nested/first.mm $]\r\n$[ second.mm $] $[ nested/first.mm $]';
  const first = '$( ignored $[ absent-nested.mm $] $) $[ ../shared.mm $]';
  writeFileSync(join(tree, 'entry.mm'), entry, 'latin1');
  writeFileSync(join(tree, 'nested', 'first.mm'), first, 'latin1');
  writeFileSync(join(tree, 'shared.mm'), '$c t $.\xff', 'latin1');
  writeFileSync(join(tree, 'second.mm'), '$[ shared.mm $]');
  const bundle = readBundle(join(tree, 'entry.mm'), tree);
  assert.deepEqual(bundle.sources.map(s => s.source_id), ['entry.mm', 'nested/first.mm', 'shared.mm', 'second.mm']);
  assert.equal(bundle.sources[0].text, entry);
  assert.equal(bundle.sources[1].text, first);
  assert.equal(bundle.sources[2].text, '$c t $.\xff');
});

test('only exact three-token include triples are followed, including unmatched-comment behavior', () => {
  const tree = join(dir, 'triples');
  mkdirSync(tree);
  writeFileSync(join(tree, 'included.mm'), '$c t $.');
  writeFileSync(join(tree, 'entry.mm'), '$[ missing.mm extra $] $[included.mm$] $[ included.mm $]\n$( unclosed $[ included.mm $]');
  assert.deepEqual(readBundle(join(tree, 'entry.mm')).sources.map(s => s.source_id), ['entry.mm', 'included.mm']);
  writeFileSync(join(tree, 'unclosed.mm'), '$( unclosed $[ included.mm $]');
  assert.deepEqual(readBundle(join(tree, 'unclosed.mm')).sources.map(s => s.source_id), ['unclosed.mm', 'included.mm']);
});

test('include root allowlist, missing-file errors and quota codes remain unchanged', () => {
  const tree = join(dir, 'errors');
  mkdirSync(tree);
  const file = join(tree, 'entry.mm');
  writeFileSync(join(dir, 'outside.mm'), '$c t $.');
  writeFileSync(file, '$[ ../outside.mm $]');
  assert.throws(() => readBundle(file), error => error.code === 'HOST_IO' && /outside the selected source root/.test(error.message));
  writeFileSync(file, '$[ missing.mm $]');
  assert.throws(() => readBundle(file), error => error.code === 'HOST_IO' && /Cannot read/.test(error.message));
  writeFileSync(file, '$c t $.');
  for (const limits of [{ max_file_bytes: 1 }, { max_sources: 0 }]) assert.throws(() => readBundle(file, tree, limits), error => error.code === 'resource_limit');
  assert.equal(readFileSync(file, 'utf8'), '$c t $.');
});
