#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Worker, isMainThread, workerData } from 'node:worker_threads';
import { readBundle, coreClient, exitFor, root, HostError, ResourceLimitError } from './host.mjs';
import { validateActions } from './actions.mjs';

const args = isMainThread ? process.argv.slice(2) : workerData.args;
const buildInfo = join(root, 'dist', 'build.json');
const version = existsSync(buildInfo)
  ? JSON.parse(readFileSync(buildInfo, 'utf8')).version
  : readFileSync(join(root, 'moon.mod'), 'utf8').match(/version\s*=\s*"([^"]+)"/)[1];

function help() {
  console.log(`MoonMetamath ${version}
Usage:
  moonmetamath verify FILE [--format json|text] [--timeout-ms N]
  moonmetamath list FILE [--format json]
  moonmetamath replay FILE --theorem LABEL
  moonmetamath session FILE --theorem LABEL --actions ACTIONS.json --export OUT.mm
  moonmetamath --version
Options: --root DIR, --max-operations N, --timeout-ms N, --format json|text.
Session export: --new-label LABEL (default moonmm-session-1).
Files are read-only. Session export never overwrites existing files.
CLI workers have a 512 MiB heap and default 120000 ms deadline.`);
}

function parseOptions(operation, rest) {
  const allowed = ['--format', '--root', '--timeout-ms', '--max-operations'];
  if (operation === 'replay') allowed.push('--theorem');
  if (operation === 'session') allowed.push('--theorem', '--actions', '--export', '--new-label');
  const opts = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const value = rest[i + 1];
    if (!allowed.includes(key) || !value || value.startsWith('--') || key in opts) {
      throw new Error('Unknown, duplicate or missing option: ' + key);
    }
    opts[key] = value;
  }
  if (opts['--new-label'] && !opts['--export']) {
    throw new Error('--new-label requires --export.');
  }
  const operations = opts['--max-operations'] === undefined
    ? undefined : Number(opts['--max-operations']);
  if (operations !== undefined &&
      (!Number.isInteger(operations) || operations < 0 || operations > 2147483647)) {
    throw new Error('--max-operations must be 0..2147483647.');
  }
  if (opts['--format'] && !['json', 'text'].includes(opts['--format'])) {
    throw new Error('Format must be json or text.');
  }
  const budget = operations === undefined ? {} : { limits: { max_operations: operations } };
  return { opts, budget };
}

if (isMainThread && args.length && !args.includes('--help') && !args.includes('--version')) {
  const timeoutAt = args.indexOf('--timeout-ms');
  const timeout = timeoutAt < 0 ? 120000 : Number(args[timeoutAt + 1]);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 300000) {
    console.log(JSON.stringify({
      schema_version: 1, operation: args[0], status: 'error', outcome: null, data: null,
      diagnostics: [{ code: 'INPUT_ERROR', message: '--timeout-ms must be 1..300000' }],
    }));
    process.exitCode = 2;
  } else {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { args }, resourceLimits: { maxOldGenerationSizeMb: 512 },
    });
    let stopped = false;
    function stop(outcome, message) {
      if (stopped) return;
      stopped = true;
      worker.terminate();
      console.log(JSON.stringify({
        schema_version: 1, operation: args[0], status: 'ok', outcome,
        data: { complete: false }, diagnostics: [{ code: 'ResourceLimit', message }],
      }));
      process.exitCode = 5;
    }
    const timer = setTimeout(() => stop('resource_limit', 'CLI worker exceeded its deadline.'), timeout);
    process.once('SIGINT', () => stop('cancelled', 'CLI worker was cancelled.'));
    worker.on('error', error => {
      if (error.code === 'ERR_WORKER_OUT_OF_MEMORY') {
        stop('resource_limit', error.message);
        return;
      }
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      console.log(JSON.stringify({
        schema_version: 1, operation: args[0], status: 'error', outcome: null, data: null,
        diagnostics: [{ code: 'HOST_IO', message: error.message }],
      }));
      process.exitCode = 3;
    });
    worker.on('exit', code => {
      clearTimeout(timer);
      if (!stopped) process.exitCode = code;
    });
  }
} else {
  try {
    if (args.includes('--help') || args.length === 0) {
      help();
    } else if (args.includes('--version')) {
      console.log(`MoonMetamath ${version}`);
    } else {
      const [operation, file, ...rest] = args;
      if (!['verify', 'list', 'replay', 'session'].includes(operation) || !file || file.startsWith('--')) {
        throw new Error('Expected a command and FILE. Use --help.');
      }
      const { opts, budget } = parseOptions(operation, rest);
      const client = await coreClient();
      let result = client({ operation: 'load', ...readBundle(file, opts['--root']), ...budget });
      if (result.status !== 'error') {
        const database_id = result.data.database_id;
        if (operation === 'list') {
          result = client({ operation: 'list', database_id });
        } else {
          result = client({ operation: 'verify', database_id, ...budget });
          if (result.status !== 'error' && operation !== 'verify') {
            if (!opts['--theorem']) throw new Error('--theorem LABEL is required.');
            if (operation === 'replay') {
              result = client({ operation: 'replay', database_id, target_label: opts['--theorem'], ...budget });
            } else {
              if (!opts['--actions']) throw new Error('--actions ACTIONS.json is required.');
              let actionText;
              try {
                actionText = readFileSync(opts['--actions'], 'utf8');
              } catch (error) {
                throw new HostError(`Cannot read actions file: ${error.message}`);
              }
              const actions = validateActions(JSON.parse(actionText));
              result = client({ operation: 'start', database_id, target_label: opts['--theorem'], ...budget });
              const session_id = result.data?.session_id;
              if (session_id) {
                for (const action of actions) {
                  result = client({ ...action, session_id });
                  if (result.status === 'error') break;
                }
              }
              if (session_id && result.status !== 'error') {
                result = client({ operation: 'finish', session_id });
              }
              if (result.status !== 'error' && opts['--export']) {
                result = client({
                  operation: 'export', session_id,
                  new_label: opts['--new-label'] || 'moonmm-session-1',
                });
                if (result.status !== 'error') {
                  const destination = resolve(opts['--export']);
                  if (existsSync(destination) || destination === resolve(file)) {
                    throw new HostError('Refuse to overwrite export destination.');
                  }
                  try {
                    writeFileSync(destination, result.data.text, { flag: 'wx', encoding: 'ascii' });
                  } catch (error) {
                    throw new HostError(`Cannot write export: ${error.message}`);
                  }
                  result.data.export_path = destination;
                }
              }
            }
          }
        }
      }
      const output = opts['--format'] === 'text'
        ? `${result.operation}: ${result.outcome ?? result.status}\n${JSON.stringify(result.data, null, 2)}\n${result.diagnostics.map(d => d.message).join('\n')}`
        : JSON.stringify(result);
      console.log(output);
      process.exitCode = exitFor(result);
    }
  } catch (error) {
    const resourceLimit = error instanceof ResourceLimitError;
    const code = resourceLimit ? 'resource_limit' : error instanceof HostError ? 'HOST_IO' : 'INPUT_ERROR';
    console.log(JSON.stringify({
      schema_version: 1, operation: args[0] ?? 'help', status: 'error',
      outcome: resourceLimit ? 'resource_limit' : null, data: null,
      diagnostics: [{ code, message: error.message }],
    }));
    process.exitCode = resourceLimit ? 5 : error instanceof HostError ? 3 : 2;
  }
}
