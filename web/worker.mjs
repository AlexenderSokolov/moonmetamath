import { create_dispatcher } from '../dist/moonmetamath-core.mjs';

const dispatch = create_dispatcher();

// The worker owns opaque native handles. Termination deliberately destroys them.
self.addEventListener('message', ({ data: request }) => {
  try {
    const response = JSON.parse(dispatch(JSON.stringify(request)));
    self.postMessage(response);
  } catch (error) {
    self.postMessage({
      schema_version: 1,
      request_id: request?.request_id ?? '',
      operation: request?.operation ?? 'unknown',
      status: 'error',
      outcome: null,
      data: null,
      diagnostics: [{ code: 'HostError', message: error.message || String(error) }],
    });
  }
});
