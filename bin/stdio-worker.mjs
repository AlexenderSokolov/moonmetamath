import { parentPort } from 'node:worker_threads';
import { create_dispatcher } from '../dist/moonmetamath-core.mjs';
const dispatch = create_dispatcher();
// Keep the parsed source bundle out of the dispatch call's live scope.
function requestMetadata(request) {
  let request_id = '', operation = '';
  try {
    const value = JSON.parse(request);
    if (typeof value?.request_id === 'string') request_id = value.request_id;
    if (typeof value?.operation === 'string') operation = value.operation;
  } catch { /* Malformed JSON remains a core protocol error. */ }
  return { kind: 'metadata', request_id, operation };
}
parentPort.on('message', (request) => {
  parentPort.postMessage(requestMetadata(request));
  parentPort.postMessage({ kind: 'response', text: dispatch(request) });
});
