const $ = (id) => document.getElementById(id);
const state = {
  worker: null, pending: new Map(), serial: 0, busy: false, epoch: 0,
  db: null, bundle: null, uploaded: [], theorems: [], target: null,
  session: null, view: null, events: [], mode: 'construct', replay: null, position: 0,
};
const statusText = { verified: '已验证', not_checked: '未检查', invalid: '无效', incomplete: '未完成', valid: '验证通过', unsupported: '不支持', resource_limit: '达到资源限制', cancelled: '已取消' };
const expression = (tokens) => Array.isArray(tokens) ? tokens.join(' ') : '';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function notice(message, info = false) {
  $('notice-content').textContent = message;
  $('notice').classList.toggle('info', info);
  $('notice').hidden = false;
}
function clearNotice() { $('notice').hidden = true; }
function diagnostics(response) {
  const items = response.diagnostics || [];
  return items.map((d) => `${d.code}: ${d.message}${d.source && d.source !== 'request' ? `（${d.source}:${d.line || 1}:${d.column || 1}）` : ''}`).join('\n') || `请求未完成：${response.outcome || response.status}`;
}

function initWorker() {
  if (state.worker) return;
  const worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
  state.worker = worker;
  worker.addEventListener('message', ({ data }) => {
    const pending = state.pending.get(data.request_id);
    if (!pending) return;
    state.pending.delete(data.request_id);
    if (data.schema_version !== 1 || data.operation !== pending.operation) {
      pending.reject(new Error('内核响应协议不匹配。'));
    } else if (data.status !== 'ok') {
      pending.reject(new Error(diagnostics(data)));
    } else pending.resolve(data);
  });
  worker.addEventListener('error', (event) => {
    if (state.worker !== worker) return;
    event.preventDefault();
    invalidateWorker(new Error(`内核启动或运行失败：${event.message || '请确认已构建 dist/moonmetamath-core.mjs，并通过本地服务器打开。'}`));
  });
}

function invalidateWorker(error) {
  state.worker?.terminate();
  state.worker = null;
  state.epoch += 1;
  for (const pending of state.pending.values()) pending.reject(error);
  state.pending.clear();
  state.db = null;
  state.session = null;
  renderControls();
}

function request(operation, fields = {}) {
  initWorker();
  const request_id = `web-${++state.serial}`;
  return new Promise((resolve, reject) => {
    state.pending.set(request_id, { resolve, reject, operation });
    state.worker.postMessage({ schema_version: 1, request_id, operation, ...fields });
  });
}

async function task(label, action) {
  if (state.busy) return;
  state.busy = true;
  clearNotice();
  $('activity').textContent = label;
  $('activity').classList.add('busy');
  renderControls();
  try { await action(); }
  catch (error) { notice(error.message || String(error)); }
  finally {
    state.busy = false;
    $('activity').classList.remove('busy');
    $('activity').textContent = state.db ? '内核就绪 · 显示最后一次已确认状态' : '尚无活动数据库 · 选择示例或上传文件重新加载';
    renderControls();
  }
}

function renderControls() {
  const busy = state.busy;
  const active = !!state.db && !!state.target;
  const construct = active && state.mode === 'construct' && !!state.session;
  const open = construct && state.view?.state !== 'complete';
  for (const id of ['load-builtin', 'builtin', 'files', 'construct-tab', 'replay-tab']) $(id).disabled = busy;
  $('load-upload').disabled = busy || !state.uploaded.length;
  $('entry').disabled = busy || !state.uploaded.length;
  $('verify').disabled = busy || !state.db;
  $('search').disabled = busy || !state.theorems.length;
  $('cancel').disabled = !busy;
  $('restart').disabled = busy || !active;
  $('apply').disabled = $('label').disabled = busy || !open;
  $('finish').disabled = busy || !open;
  $('rewind').disabled = busy || !construct || !state.events.length;
  $('run-replay').disabled = busy || !active;
  $('export').disabled = busy || !construct || state.view?.state !== 'complete';
  $('export-label').disabled = busy || state.mode !== 'construct';
  $('step-count').textContent = `${state.view?.successful_step_count || 0} 步已确认`;
  for (const node of document.querySelectorAll('.theorem-item')) node.disabled = busy || !state.db;
  for (const node of document.querySelectorAll('.hypothesis')) node.disabled = busy || !open;
}

function renderTheorems() {
  $('theorem-count').textContent = String(state.theorems.length);
  const query = $('search').value.toLowerCase();
  const list = $('theorems');
  list.replaceChildren();
  for (const theorem of state.theorems.filter((t) => t.label.toLowerCase().includes(query))) {
    const button = element('button', `theorem-item${state.target?.label === theorem.label ? ' selected' : ''}`);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(state.target?.label === theorem.label));
    button.append(element('code', '', theorem.label), element('span', `theorem-status ${theorem.status}`, statusText[theorem.status] || theorem.status));
    button.addEventListener('click', () => task('恢复目标活动上下文…', () => selectTarget(theorem)));
    list.append(button);
  }
  if (!list.children.length) list.append(element('p', 'muted', state.theorems.length ? '没有匹配的定理。' : '数据库中没有 $p 定理。'));
}

function renderView(view = state.view, events = state.events) {
  $('target-label').textContent = state.target?.label || '选择一个定理';
  $('goal').textContent = expression(view?.goal || state.target?.goal) || '⊢ …';
  const targetStatus = state.target?.status;
  $('target-status').textContent = view?.state === 'complete' && state.mode === 'construct' ? '构造已完成' : statusText[targetStatus] || '未选择';
  $('target-status').className = `badge ${targetStatus || 'neutral'}`;
  const hypotheses = view?.active_hypotheses || [];
  $('hypothesis-count').textContent = String(hypotheses.length);
  $('hypotheses').replaceChildren();
  if (!view) $('hypotheses').append(element('span', 'muted', '开始会话后显示目标的活动上下文。'));
  else if (!hypotheses.length) $('hypotheses').append(element('span', 'muted', '当前目标没有活动假设。'));
  else for (const hypothesis of hypotheses) {
    const button = element('button', 'hypothesis');
    button.type = 'button';
    button.title = `应用假设 ${hypothesis.label}`;
    button.append(element('code', '', hypothesis.label), element('span', 'math', expression(hypothesis.expression)));
    button.addEventListener('click', () => apply(hypothesis.label));
    $('hypotheses').append(button);
  }
  const stack = view?.stack || [];
  $('stack-count').textContent = String(stack.length);
  $('stack').replaceChildren();
  if (!stack.length) {
    const empty = element('div', 'empty-state');
    empty.append(element('span', '', '∅'), element('strong', '', '空栈也是一个起点'), element('p', '', '应用假设或断言后，表达式会出现在这里。'));
    $('stack').append(empty);
  } else {
    stack.forEach((tokens, index) => {
      const row = element('div', 'stack-row');
      row.append(element('span', 'index', String(index + 1).padStart(2, '0')), element('span', 'math', expression(tokens)));
      $('stack').append(row);
    });
    $('stack').append(element('div', 'stack-caption', '栈顶在下方 ↓'));
  }
  const event = events.at(-1);
  $('event-label').textContent = event?.label || '等待动作';
  $('event').replaceChildren();
  if (!event) $('event').append(element('p', 'muted', '成功步骤将显示必要假设、同时代换及栈变化。'));
  else {
    $('event').append(element('p', 'event-meta', `弹出 ${event.popped} 项 · 推入 ${event.pushed} 项`));
    $('event').append(element('div', 'detail-label', '必要假设'), element('p', 'muted', event.hypotheses?.join(' · ') || '无'));
    $('event').append(element('div', 'detail-label', '同时代换'));
    if (!event.substitutions?.length) $('event').append(element('p', 'muted', '无变量代换'));
    for (const sub of event.substitutions || []) {
      const row = element('div', 'substitution');
      row.append(element('code', '', sub.variable), element('span', 'muted', '↦'), element('span', 'math', expression(sub.expression) || 'ε（空表达式）'));
      $('event').append(row);
    }
    $('event').append(element('div', 'detail-label', '得到表达式'), element('div', 'math', expression(event.result)));
  }
  $('history').replaceChildren(...events.map((event) => element('li', '', event.label)));
  $('export-hint').textContent = state.mode === 'replay' ? '回放只用于查看原证明；导出需要完成一个手动构造会话。' : view?.state === 'complete' ? '核心已确认构造完成。导出包含合法前缀与新标签；独立检查可在 CLI 运行。' : '手动构造完成并通过检查后，可导出自足 .mm 文件。';
  renderControls();
}

function renderReport(response) {
  const report = response.data;
  const holder = $('report');
  holder.replaceChildren();
  holder.append(element('div', 'report-heading', `${statusText[response.outcome] || response.outcome} · ${report.complete ? '检查完整' : '检查未完整通过'}`));
  const counts = element('div', 'report-counts');
  for (const [key, label] of [['verified_count', '已验证'], ['invalid_count', '无效'], ['incomplete_count', '未完成'], ['not_checked_count', '未检查']]) {
    const cell = element('span', '', label);
    cell.append(element('b', '', String(report[key] ?? '—')));
    counts.append(cell);
  }
  holder.append(counts);
  if (response.diagnostics?.length) notice(diagnostics(response));
}

async function refreshList() {
  state.theorems = (await request('list', { database_id: state.db })).data.theorems;
  if (state.target) state.target = state.theorems.find((t) => t.label === state.target.label) || null;
  renderTheorems();
}

async function selectTarget(theorem) {
  state.target = theorem;
  state.session = null;
  state.view = null;
  state.events = [];
  state.replay = null;
  $('replay-controls').hidden = true;
  renderTheorems();
  renderView();
  // A native start gives the actual active context and an empty construction.
  const response = await request('start', { database_id: state.db, target_label: theorem.label });
  state.session = response.data.session_id;
  state.view = response.data.view;
  renderView();
}

async function loadBundle(bundle) {
  // New input owns a fresh worker, so previous opaque handles cannot leak across loads.
  invalidateWorker(new Error('已加载新的输入，旧会话失效。'));
  state.bundle = bundle;
  state.target = null;
  state.view = null;
  state.events = [];
  state.replay = null;
  state.theorems = [];
  $('report').replaceChildren();
  $('search').value = '';
  $('replay-controls').hidden = true;
  renderTheorems();
  renderView();
  const loaded = await request('load', { entry: bundle.entry, sources: bundle.sources });
  state.db = loaded.data.database_id;
  $('database-info').textContent = `${bundle.entry} · ${bundle.sources.length} 个源文件 · ${loaded.data.declaration_count} 条声明`;
  $('activity').textContent = '正在验证数据库（解析成功不代表证明有效）…';
  const verified = await request('verify', { database_id: state.db });
  renderReport(verified);
  await refreshList();
  if (state.theorems.length) await selectTarget(state.theorems[0]);
}

function decodeSource(bytes, sourceId) {
  if (bytes.length > 64 * 1024 * 1024) throw new Error(`${sourceId} 超过单文件 64 MiB 限制。`);
  const invalid = bytes.findIndex((byte) => !((byte >= 32 && byte <= 126) || [9, 10, 12, 13].includes(byte)));
  if (invalid !== -1) throw new Error(`${sourceId} 在字节 ${invalid} 包含非 ASCII 字符或不支持的控制字符（BOM 也不允许）。`);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

async function loadBuiltin() {
  const name = $('builtin').value;
  const epoch = state.epoch;
  const response = await fetch(new URL(`../tests/fixtures/upstream/set-mm/${name}.mm`, import.meta.url));
  if (!response.ok) throw new Error(`示例库读取失败 (${response.status})。请先获取项目测试数据。`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (epoch !== state.epoch) return;
  await loadBundle({ entry: `${name}.mm`, sources: [{ source_id: `${name}.mm`, text: decodeSource(bytes, `${name}.mm`) }] });
}

function apply(label) {
  if (!label.trim() || state.busy || !state.session || state.mode !== 'construct') return;
  return task(`检查标签 ${label.trim()}…`, async () => {
    const response = await request('apply_label', { session_id: state.session, label: label.trim() });
    state.view = response.data.view;
    state.events.push(response.data.event);
    $('label').value = '';
    renderView();
    // Focus only once the task's finally has enabled the input again.
    setTimeout(() => { if (!$('label').disabled) $('label').focus(); }, 0);
  });
}

function setMode(mode) {
  state.mode = mode;
  $('construct-tab').setAttribute('aria-selected', String(mode === 'construct'));
  $('replay-tab').setAttribute('aria-selected', String(mode === 'replay'));
  $('construct-panel').hidden = mode !== 'construct';
  $('replay-panel').hidden = mode !== 'replay';
  clearNotice();
  if (mode === 'replay' && state.replay) renderReplay();
  else renderView(mode === 'replay' && state.view ? { ...state.view, stack: [], successful_step_count: 0 } : state.view, mode === 'replay' ? [] : state.events);
}

function renderReplay() {
  const { view, events } = state.replay;
  const prefix = events.slice(0, state.position);
  const stack = [];
  for (const event of prefix) {
    stack.splice(stack.length - event.popped, event.popped);
    if (event.pushed) stack.push(event.result);
  }
  // These are snapshots of already checked core events, never a second verifier.
  renderView({ ...view, stack, successful_step_count: prefix.length, state: 'replay' }, prefix);
  $('replay-position').value = String(state.position);
  $('replay-progress').textContent = `${state.position} / ${events.length}`;
  $('replay-prev').disabled = state.position === 0;
  $('replay-next').disabled = state.position === events.length;
  for (const [index, button] of [...$('proof-labels').children].entries()) button.classList.toggle('current', index === state.position - 1);
}

$('dismiss').addEventListener('click', clearNotice);
$('load-builtin').addEventListener('click', () => task('读取真实示例库…', loadBuiltin));
$('files').addEventListener('change', () => {
  state.uploaded = [...$('files').files];
  $('entry').replaceChildren(...state.uploaded.map((file) => {
    const option = element('option', '', file.webkitRelativePath || file.name);
    option.value = file.webkitRelativePath || file.name;
    return option;
  }));
  renderControls();
});
$('load-upload').addEventListener('click', () => task('读取已选择的文件集合…', async () => {
  const epoch = state.epoch;
  if (state.uploaded.reduce((total, file) => total + file.size, 0) > 128 * 1024 * 1024) throw new Error('文件集合超过 128 MiB 限制。');
  const sources = [];
  const names = new Set();
  for (const file of state.uploaded) {
    const source_id = file.webkitRelativePath || file.name;
    if (names.has(source_id)) throw new Error(`重复源文件名：${source_id}。请使用唯一文件名。`);
    names.add(source_id);
    sources.push({ source_id, text: decodeSource(new Uint8Array(await file.arrayBuffer()), source_id) });
  }
  if (epoch !== state.epoch) return;
  await loadBundle({ entry: $('entry').value, sources });
}));
$('verify').addEventListener('click', () => task('按声明次序验证数据库…', async () => {
  const response = await request('verify', { database_id: state.db });
  renderReport(response);
  await refreshList();
  renderView();
}));
$('search').addEventListener('input', renderTheorems);
$('apply-form').addEventListener('submit', (event) => { event.preventDefault(); apply($('label').value); });
$('construct-tab').addEventListener('click', () => setMode('construct'));
$('replay-tab').addEventListener('click', () => setMode('replay'));
$('restart').addEventListener('click', () => task('创建新的空栈会话…', () => selectTarget(state.target)));
$('rewind').addEventListener('click', () => task('重放成功动作前缀…', async () => {
  const successful_step_count = state.events.length - 1;
  const response = await request('rewind', { session_id: state.session, successful_step_count });
  state.events = state.events.slice(0, successful_step_count);
  state.view = response.data.view;
  renderView();
}));
$('finish').addEventListener('click', () => task('检查最终栈与目标是否一致…', async () => {
  const response = await request('finish', { session_id: state.session });
  state.view = response.data.view;
  renderView();
  notice('构造完成：最终栈与目标一致。现在可以下载普通 .mm 证明。', true);
}));
$('export').addEventListener('click', () => task('生成自足普通证明文件…', async () => {
  const new_label = $('export-label').value.trim();
  if (!new_label) throw new Error('请填写一个新的定理标签。');
  const response = await request('export', { session_id: state.session, new_label });
  const url = URL.createObjectURL(new Blob([response.data.text], { type: 'text/plain;charset=us-ascii' }));
  const link = element('a');
  link.href = url;
  link.download = `${new_label}.mm`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notice('已生成下载文件。此导出由 MoonBit 核心构造；独立检查器复核需另行运行。', true);
}));
$('run-replay').addEventListener('click', () => task('检查数据库原证明并生成回放…', async () => {
  const response = await request('replay', { database_id: state.db, target_label: state.target.label });
  state.replay = response.data;
  state.position = 0;
  $('replay-position').max = String(state.replay.events.length);
  $('replay-controls').hidden = false;
  $('proof-labels').replaceChildren(...state.replay.events.map((event, index) => {
    const button = element('button', '', event.label);
    button.type = 'button';
    button.title = `查看第 ${index + 1} 步：${event.label}`;
    button.addEventListener('click', () => { state.position = index + 1; renderReplay(); });
    return button;
  }));
  renderReplay();
}));
$('replay-position').addEventListener('input', () => { state.position = Number($('replay-position').value); renderReplay(); });
$('replay-prev').addEventListener('click', () => { if (state.position > 0) { state.position -= 1; renderReplay(); } });
$('replay-next').addEventListener('click', () => { if (state.position < state.replay.events.length) { state.position += 1; renderReplay(); } });
$('cancel').addEventListener('click', () => {
  invalidateWorker(new Error('已取消：工作线程已终止。显示的只是最后确认视图；请重新加载数据库开始新会话。'));
  $('activity').classList.remove('busy');
  $('activity').textContent = '已取消 · 原数据库与会话句柄已失效';
  notice('已终止工作线程。最后确认视图保留为只读；继续操作须重新加载数据库。', true);
});

renderControls();
task('读取 demo0 示例并启动原生核心…', loadBuiltin);
