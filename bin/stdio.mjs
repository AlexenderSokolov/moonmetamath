import { Worker } from 'node:worker_threads';

function response(meta, code, message, outcome = null) {
  return JSON.stringify({ schema_version: 1, ...meta, status: 'error', outcome, data: null, diagnostics: [{ code, message }] });
}
function options(args) {
  const result = { '--timeout-ms': 120000, '--max-line-bytes': 256 * 1024 * 1024 };
  const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i], value = Number(args[i + 1]);
    const max = key === '--timeout-ms' ? 300000 : 1024 * 1024 * 1024;
    if (!Object.hasOwn(result, key) || seen.has(key) || !Number.isSafeInteger(value) || value < 1 || value > max) throw new Error('Invalid stdio option: ' + key);
    seen.add(key);
    result[key] = value;
  }
  return result;
}
// Pause iteration at each newline until its request and output have completed.
async function* lines(input, maximum) {
  let parts = [], size = 0;
  for await (const chunk of input) {
    let start = 0;
    while (start < chunk.length) {
      const newline = chunk.indexOf(10, start);
      const end = newline < 0 ? chunk.length : newline;
      const part = chunk.subarray(start, end);
      size += part.length;
      if (size > maximum) throw Object.assign(new Error('JSONL line exceeds --max-line-bytes.'), { code: 'LINE_LIMIT' });
      parts.push(part);
      if (newline < 0) break;
      yield Buffer.concat(parts, size);
      parts = []; size = 0; start = newline + 1;
    }
  }
  if (size) yield Buffer.concat(parts, size);
}
export async function runStdio(args = []) {
  const empty = { request_id: '', operation: '' };
  const output = text => new Promise((resolve, reject) => process.stdout.write(text + '\n', error => error ? reject(error) : resolve()));
  let config;
  try { config = options(args); }
  catch (error) { await output(response(empty, 'INPUT_ERROR', error.message)); process.exitCode = 2; return; }
  const worker = new Worker(new URL('./stdio-worker.mjs', import.meta.url), {
    execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 512 },
  });
  let current = empty, pending = null, timer = null, stopped = false, ending = null;
  async function stop(code, message, outcome, exitCode) {
    if (stopped) return ending;
    stopped = true;
    clearTimeout(timer);
    const reject = pending?.reject;
    pending = null;
    process.exitCode = exitCode;
    ending = (async () => {
      await worker.terminate();
      process.stdin.destroy();
      try { await output(response(current, code, message, outcome)); }
      catch { process.exitCode = 3; }
      // A Windows pipe read can remain pending after destroy; terminal output is flushed.
      process.exit(process.exitCode);
    })();
    reject?.(new Error(message));
    return ending;
  }
  const interrupt = () => { void stop('ResourceLimit', 'Stdio session cancelled; all handles are invalid.', 'cancelled', 5); };
  process.on('SIGINT', interrupt);
  const outputError = error => { void stop('HOST_IO', error.message, null, 3); };
  process.stdout.on('error', outputError);
  worker.on('message', value => {
    if (!pending || stopped) return;
    if (value.kind === 'metadata') {
      current = {request_id: value.request_id, operation: value.operation};
      return;
    }
    clearTimeout(timer);
    const resolve = pending.resolve;
    pending = null;
    resolve(value.text);
  });
  worker.on('error', error => {
    const oom = error.code === 'ERR_WORKER_OUT_OF_MEMORY';
    void stop(oom ? 'ResourceLimit' : 'HOST_IO', error.message, oom ? 'resource_limit' : null, oom ? 5 : 3);
  });
  worker.on('exit', code => {
    if (!stopped) void stop('HOST_IO', `Worker exited before responding (${code}).`, null, 3);
  });
  try {
    for await (const bytes of lines(process.stdin, config['--max-line-bytes'])) {
      if (stopped) break;
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { await output(response(empty, 'INPUT_ERROR', 'JSONL request must be UTF-8.')); continue; }
      if (!text.trim()) continue;
      current = empty;
      const result = await new Promise((resolve, reject) => {
        pending = { resolve, reject };
        timer = setTimeout(() => { void stop('ResourceLimit', 'Stdio request exceeded its deadline; all handles are invalid.', 'resource_limit', 5); }, config['--timeout-ms']);
        worker.postMessage(text);
      });
      if (stopped) break;
      current = empty;
      await output(result);
    }
  } catch (error) {
    if (!stopped) await stop(error.code === 'LINE_LIMIT' ? 'ResourceLimit' : 'HOST_IO', error.message, error.code === 'LINE_LIMIT' ? 'resource_limit' : null, error.code === 'LINE_LIMIT' ? 5 : 3);
  } finally {
    process.off('SIGINT', interrupt);
    clearTimeout(timer);
    if (ending) await ending;
    process.stdout.off('error', outputError);
    stopped = true;
    await worker.terminate();
  }
}
