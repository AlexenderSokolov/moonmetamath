import { createNotebook, restoreNotebook } from './notebook.mjs';

const $ = (id) => document.getElementById(id);
const state = {
  worker: null, candidate: null, serial: 0, busy: false, epoch: 0, taskId: 0,
  db: null, bundle: null, uploaded: [], theorems: [], target: null,
  session: null, view: null, events: [], mode: 'construct', replay: null, position: 0,
  rules: [], rule: null, ruleOffset: 0, ruleTotal: 0, hasLocalSave: false,
};
const LOCAL_SAVE_KEY = 'moonmetamath-work-schema1';
const LOCAL_SAVE_LIMIT = 2 * 1024 * 1024;
const FILE_SAVE_LIMIT = 128 * 1024 * 1024;
const RULE_PAGE_SIZE = 20;
const BUDGETED_OPERATIONS = new Set(['load', 'verify', 'start', 'replay', 'create_goal']);
const exercises = {
  '01-first-steps': { title: '01 · 两步构造', help: '先应用 wph，再应用 identity；检查完成。试着搜索结论中的 ->，查看 identity 如何用必要假设构造结论。' },
  '02-essential-hypothesis': { title: '02 · 必要假设', help: '先查看 lift 的必要假设。依次应用 wph、premise、lift，再检查完成。缺少 premise 时预览 lift，会得到栈不足诊断。' },
  '03-disjoint': { title: '03 · 不交变量诊断', help: '尝试 vx、vx，再预览 pair-rule：同一个变量不能满足 $d x y。撤回第二步，应用 vy，然后预览并应用 pair-rule。合法顺序为 vx、vy、pair-rule。' },
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

function createWorkerClient() {
  const worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
  const client = { worker, pending: new Map(), alive: true };
  worker.addEventListener('message', ({ data }) => {
    const pending = client.pending.get(data.request_id);
    if (!pending) return;
    client.pending.delete(data.request_id);
    if (!client.alive || pending.epoch !== state.epoch) {
      pending.reject(new Error('任务已取消。'));
    } else if (data.schema_version !== 1 || data.operation !== pending.operation) {
      pending.reject(new Error('内核响应协议不匹配。'));
    } else if (data.status !== 'ok') {
      pending.reject(new Error(diagnostics(data)));
    } else pending.resolve(data);
  });
  worker.addEventListener('error', (event) => {
    event.preventDefault();
    const error = new Error(`内核启动或运行失败：${event.message || '请确认已构建 dist/moonmetamath-core.mjs，并通过本地服务器打开。'}`);
    if (state.worker === client) {
      invalidateWorker(error);
      notice(error.message);
    } else terminateClient(client, error);
  });
  return client;
}

function terminateClient(client, error = new Error('工作线程已终止。')) {
  if (!client) return;
  client.alive = false;
  client.worker.terminate();
  for (const pending of client.pending.values()) pending.reject(error);
  client.pending.clear();
}

function invalidateWorker(error) {
  terminateClient(state.worker, error);
  terminateClient(state.candidate, error);
  state.worker = null;
  state.candidate = null;
  state.epoch += 1;
  state.db = null;
  state.session = null;
  renderControls();
}

function request(operation, fields = {}) {
  if (!state.worker) return Promise.reject(new Error('工作线程已终止；请重新加载。'));
  return requestClient(state.worker, operation, fields);
}

function requestClient(client, operation, fields = {}) {
  if (!client.alive) return Promise.reject(new Error('工作线程已终止；请重新加载。'));
  const request_id = `web-${++state.serial}`;
  return new Promise((resolve, reject) => {
    client.pending.set(request_id, { resolve, reject, operation, epoch: state.epoch });
    const limits = BUDGETED_OPERATIONS.has(operation)
      ? { limits: { max_operations: Number($('operation-budget').value) } } : {};
    client.worker.postMessage({ schema_version: 1, request_id, operation, ...fields, ...limits });
  });
}

async function task(label, action) {
  if (state.busy) return;
  const taskId = ++state.taskId;
  const epoch = state.epoch;
  state.busy = true;
  clearNotice();
  $('activity').textContent = label;
  $('activity').classList.add('busy');
  renderControls();
  try { await action(epoch); }
  catch (error) { if (epoch === state.epoch) notice(error.message || String(error)); }
  finally {
    if (taskId !== state.taskId) return;
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
  for (const id of ['load-builtin', 'builtin', 'files', 'construct-tab', 'replay-tab', 'operation-budget']) $(id).disabled = busy;
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
  for (const id of ['new-goal-label', 'new-goal-expression', 'create-goal']) $(id).disabled = busy || !active;
  for (const id of ['rule-query', 'rule-typecode', 'find-rules']) $(id).disabled = busy || !active;
  $('preview-rule').disabled = $('apply-rule').disabled = busy || !open || !state.rule;
  $('rules-prev').disabled = busy || !active || state.ruleOffset === 0;
  $('rules-next').disabled = busy || !active || state.ruleOffset + state.rules.length >= state.ruleTotal;
  $('save-work').disabled = busy || !construct || !state.bundle;
  $('import-work').disabled = busy;
  $('import-work').parentElement.classList.toggle('disabled', busy);
  $('restore-last').disabled = busy || !state.hasLocalSave;
  $('step-count').textContent = `${state.view?.successful_step_count || 0} 步已确认`;
  for (const node of document.querySelectorAll('.theorem-item')) node.disabled = busy || !state.db;
  for (const node of document.querySelectorAll('.hypothesis')) node.disabled = busy || !open;
  for (const node of document.querySelectorAll('.rule-item')) node.disabled = busy || !active;
}

function clearPreview() { $('preview-output').hidden = true; $('preview-output').replaceChildren(); }

function renderRules() {
  $('rules-list').replaceChildren();
  for (const rule of state.rules) {
    const button = element('button', `rule-item${state.rule?.label === rule.label ? ' selected' : ''}`);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(state.rule?.label === rule.label));
    button.append(element('code', '', rule.label), element('span', 'rule-kind', rule.kind), element('span', 'math', expression(rule.conclusion)));
    button.addEventListener('click', () => { state.rule = rule; clearPreview(); renderRules(); });
    $('rules-list').append(button);
  }
  if (!state.rules.length) $('rules-list').append(element('p', 'muted', state.db ? '没有匹配的可见规则。可减少搜索词或清空类型码。' : '选择目标后显示其可见规则。'));
  $('rules-count').textContent = state.ruleTotal ? `${state.ruleOffset + 1}–${state.ruleOffset + state.rules.length} / ${state.ruleTotal} 条` : '0 条';
  const detail = $('rule-detail');
  detail.replaceChildren();
  const rule = state.rule;
  if (!rule) detail.append(element('p', 'muted', '选择规则，查看其必要假设与结论。'));
  else {
    detail.append(element('strong', 'rule-title', `${rule.label} · ${rule.kind}`), element('div', 'detail-label', '必要假设（按栈顺序）'));
    if (!rule.mandatory_hypotheses.length) detail.append(element('p', 'muted', '无必要假设'));
    for (const hypothesis of rule.mandatory_hypotheses) {
      const row = element('div', 'rule-hypothesis');
      row.append(element('code', '', `${hypothesis.label} ${hypothesis.kind}`), element('span', 'math', expression(hypothesis.expression)));
      detail.append(row);
    }
    detail.append(element('div', 'detail-label', '结论'), element('div', 'math', expression(rule.conclusion)), element('div', 'detail-label', '$d 不交变量约束'));
    detail.append(element('p', 'math', rule.disjoint.length ? rule.disjoint.map((pair) => pair.join(' ≠ ')).join('；') : '无'));
  }
  renderControls();
}

async function searchRules(offset = 0) {
  const epoch = state.epoch;
  const response = await request('rules', { database_id: state.db, target_label: state.target.label,
    query: $('rule-query').value.trim(), typecode: $('rule-typecode').value.trim(), offset, limit: RULE_PAGE_SIZE });
  if (epoch !== state.epoch) return;
  state.rules = response.data.rules;
  state.ruleOffset = response.data.offset;
  state.ruleTotal = response.data.total;
  state.rule = state.rules.find((rule) => rule.label === state.rule?.label) || state.rules[0] || null;
  clearPreview();
  renderRules();
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

function requireCurrent(epoch, client) {
  if (epoch !== state.epoch || !client.alive) throw new Error('任务已取消。');
}

async function release(client, session, database = null) {
  if (!client?.alive) return;
  if (session) await requestClient(client, 'close_session', { session_id: session });
  if (database && client.alive) await requestClient(client, 'unload_database', { database_id: database });
}

async function prepareTarget(client, database, theorem, epoch) {
  let session = null;
  try {
    const started = await requestClient(client, 'start', { database_id: database, target_label: theorem.label });
    session = started.data.session_id;
    const rules = await requestClient(client, 'rules', { database_id: database, target_label: theorem.label,
      query: $('rule-query').value.trim(), typecode: $('rule-typecode').value.trim(), offset: 0, limit: RULE_PAGE_SIZE });
    requireCurrent(epoch, client);
    return { session, view: started.data.view, rules: rules.data };
  } catch (error) {
    await release(client, session);
    throw error;
  }
}

function commitTarget(theorem, prepared) {
  state.target = theorem;
  state.session = prepared?.session || null;
  state.view = prepared?.view || null;
  state.events = [];
  state.replay = null;
  state.rules = prepared?.rules.rules || [];
  state.rule = state.rules[0] || null;
  state.ruleOffset = prepared?.rules.offset || 0;
  state.ruleTotal = prepared?.rules.total || 0;
  clearPreview();
  $('replay-controls').hidden = true;
  $('new-goal-expression').value = expression(state.view?.goal);
  renderTheorems();
  renderRules();
  renderView();
}

async function selectTarget(theorem) {
  const epoch = state.epoch, client = state.worker, previous = state.session;
  const prepared = await prepareTarget(client, state.db, theorem, epoch);
  requireCurrent(epoch, client);
  commitTarget(theorem, prepared);
  await release(client, previous);
}

async function loadBundle(bundle) {
  const epoch = state.epoch, candidate = createWorkerClient();
  state.candidate = candidate;
  try {
    const loaded = await requestClient(candidate, 'load', { entry: bundle.entry, sources: bundle.sources });
    const database = loaded.data.database_id;
    const verified = await requestClient(candidate, 'verify', { database_id: database });
    const listed = await requestClient(candidate, 'list', { database_id: database });
    const theorem = listed.data.theorems[0] || null;
    const prepared = theorem ? await prepareTarget(candidate, database, theorem, epoch) : null;
    requireCurrent(epoch, candidate);
    terminateClient(state.worker);
    state.worker = candidate;
    state.candidate = null;
    state.db = database;
    state.bundle = bundle;
    state.theorems = listed.data.theorems;
    $('database-info').textContent = `${bundle.entry} · ${bundle.sources.length} 个源文件 · ${loaded.data.declaration_count} 条声明`;
    $('search').value = '';
    renderReport(verified);
    renderExercise();
    commitTarget(theorem, prepared);
  } finally {
    if (state.candidate === candidate) state.candidate = null;
    if (state.worker !== candidate) terminateClient(candidate);
  }
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
  const path = exercises[name] ? `../examples/exercises/${name}.mm` : `../tests/fixtures/upstream/set-mm/${name}.mm`;
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`示例库读取失败 (${response.status})。请先获取项目测试数据。`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (epoch !== state.epoch) return;
  await loadBundle({ entry: `${name}.mm`, sources: [{ source_id: `${name}.mm`, text: decodeSource(bytes, `${name}.mm`) }] });
  if (epoch === state.epoch) renderExercise(name);
}

function renderExercise(name) {
  const guide = exercises[name];
  $('exercise-guide').hidden = !guide;
  $('exercise-guide').replaceChildren();
  if (guide) $('exercise-guide').append(element('strong', '', guide.title), element('p', '', guide.help));
}

function apply(label) {
  if (!label.trim() || state.busy || !state.session || state.mode !== 'construct') return;
  return task(`检查标签 ${label.trim()}…`, async () => {
    const response = await request('apply_label', { session_id: state.session, label: label.trim() });
    state.view = response.data.view;
    state.events.push(response.data.event);
    clearPreview();
    $('label').value = '';
    renderView();
    // Focus only once the task's finally has enabled the input again.
    setTimeout(() => { if (!$('label').disabled) $('label').focus(); }, 0);
  });
}

function download(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = element('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function inspectLocalSave() {
  try {
    const saved = localStorage.getItem(LOCAL_SAVE_KEY);
    state.hasLocalSave = !!saved;
    $('local-save-info').textContent = saved
      ? '本机有一份上次保存。点击“恢复本机上次保存”会重新验证和重放；当前工作在恢复成功后替换。仅保存按钮会更新它，大小上限 2 MiB。'
      : '点击保存时，至多 2 MiB 的工作也会留在本机浏览器；不会自动上传或无限量自动保存。';
  } catch {
    state.hasLocalSave = false;
    $('local-save-info').textContent = '浏览器不允许访问本机存储；仍可下载和导入工作文件。';
  }
}

async function restoreWork(document, epoch) {
  if (epoch !== state.epoch) return;
  const candidate = createWorkerClient();
  state.candidate = candidate;
  try {
    const restored = await restoreNotebook(document, ({ operation, ...fields }) => {
      if (epoch !== state.epoch || state.candidate !== candidate) throw new Error('恢复已取消。');
      return requestClient(candidate, operation, fields);
    });
    if (epoch !== state.epoch || state.candidate !== candidate || !candidate.alive) throw new Error('恢复已取消。');
    // Commit only a completely verified/replayed candidate; failed imports never
    // replace the active Worker or its opaque handles and confirmed state.
    terminateClient(state.worker);
    state.worker = candidate;
    state.candidate = null;
    state.bundle = restored.bundle;
    state.db = restored.database_id;
    state.session = restored.session_id;
    state.view = restored.view;
    state.events = restored.events;
    state.theorems = restored.theorems;
    state.target = restored.target;
    state.replay = null;
    state.rule = null;
    state.rules = [];
    state.ruleTotal = state.ruleOffset = 0;
    $('replay-controls').hidden = true;
    $('search').value = '';
    $('new-goal-expression').value = expression(state.view.goal);
    $('database-info').textContent = `${state.bundle.entry} · ${state.bundle.sources.length} 个源文件 · 从工作文件重新验证`;
    renderReport(restored.report);
    renderTheorems();
    renderRules();
    renderExercise();
    setMode('construct');
    notice(`已重新验证并恢复 ${state.events.length} 步${state.view.state === 'complete' ? '，完成状态已再次检查' : '，可继续构造'}。`, true);
  } finally {
    if (state.candidate === candidate) state.candidate = null;
    if (state.worker !== candidate) terminateClient(candidate);
  }
  // Rule browsing is supplementary. A later lookup error cannot turn a
  // successfully committed restore into an apparently failed atomic restore.
  try { await searchRules(); }
  catch (error) { if (epoch === state.epoch) notice(`工作已恢复；规则列表暂未加载：${error.message}`); }
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
$('rules-form').addEventListener('submit', (event) => { event.preventDefault(); task('查找目标上下文中的可见规则…', () => searchRules()); });
$('rules-prev').addEventListener('click', () => task('读取上一页规则…', () => searchRules(Math.max(0, state.ruleOffset - RULE_PAGE_SIZE))));
$('rules-next').addEventListener('click', () => task('读取下一页规则…', () => searchRules(state.ruleOffset + RULE_PAGE_SIZE)));
$('apply-rule').addEventListener('click', () => { if (state.rule) apply(state.rule.label); });
$('preview-rule').addEventListener('click', () => task('在副本中检查这一步…', async () => {
  const label = state.rule.label;
  clearPreview();
  try {
    const response = await request('preview', { session_id: state.session, label });
    const output = $('preview-output');
    output.classList.remove('failed');
    output.append(element('strong', '', `${label}：当前栈可执行这一步`), element('p', '', '仅预览，当前栈和已确认动作均未改变。是否有助于目标，需要你判断。'), element('div', 'detail-label', '预计得到的表达式'), element('div', 'math', expression(response.data.event.result)), element('p', '', `预计弹出 ${response.data.event.popped} 项、推入 ${response.data.event.pushed} 项；预览后栈共 ${response.data.view.stack.length} 项。`));
    output.hidden = false;
  } catch (error) {
    if (!state.session) throw error;
    $('preview-output').classList.add('failed');
    $('preview-output').append(element('strong', '', `${label}：当前栈无法执行`), element('p', '', error.message), element('p', '', '当前栈和已确认动作均未改变。检查必要假设顺序、表达式和 $d 约束。'));
    $('preview-output').hidden = false;
  }
}));
$('new-goal-form').addEventListener('submit', (event) => {
  event.preventDefault();
  task('继承当前上下文并创建新目标…', async (epoch) => {
    const new_label = $('new-goal-label').value.trim();
    const goalText = $('new-goal-expression').value.trim();
    if (!new_label || !goalText) throw new Error('请填写新目标标签和目标表达式。');
    const client = state.worker, previousSession = state.session, previousDatabase = state.db;
    let created = null, prepared = null, committed = false;
    try {
      const response = await requestClient(client, 'create_goal', { database_id: previousDatabase, context_label: state.target.label, new_label, goal: goalText.split(/\s+/) });
      created = response.data;
      const report = await requestClient(client, 'verify', { database_id: created.database_id });
      const listed = await requestClient(client, 'list', { database_id: created.database_id });
      const target = listed.data.theorems.find((theorem) => theorem.label === created.target_label);
      if (!target) throw new Error('新目标未出现在核心定理列表中，当前工作已保留。');
      prepared = await prepareTarget(client, created.database_id, target, epoch);
      requireCurrent(epoch, client);
      state.bundle = { entry: created.entry, sources: created.sources.map(({ source_id, text }) => ({ source_id, text })) };
      state.db = created.database_id;
      state.theorems = listed.data.theorems;
      commitTarget(target, prepared);
      committed = true;
      $('database-info').textContent = `${created.entry} · 继承上下文的新目标`;
      renderReport(report);
      renderExercise();
      setMode('construct');
      await release(client, previousSession, previousDatabase);
      notice(`已创建 ${created.target_label}，继承活动假设及 $d 约束。目标尚未证明，请从空栈开始。`, true);
    } finally {
      if (created && !committed) await release(client, prepared?.session, created.database_id);
    }
  });
});
$('save-work').addEventListener('click', () => task('保存源文件与当前动作前缀…', async (epoch) => {
  const saved = await createNotebook({ bundle: state.bundle, target_label: state.target.label,
    actions: state.events.map((event) => ({ operation: 'apply_label', label: event.label })), completed: state.view.state === 'complete' });
  if (epoch !== state.epoch) return;
  const text = JSON.stringify(saved);
  download(text, `${state.target.label}-work.json`, 'application/json');
  let message = '已生成工作文件，可在导入时重新验证和重放。';
  if (new TextEncoder().encode(text).length <= LOCAL_SAVE_LIMIT) {
    try { localStorage.setItem(LOCAL_SAVE_KEY, text); message += ' 本机上次保存也已更新，可刷新后恢复。'; }
    catch { message += ' 浏览器本机存储不可用；请保留下载文件。'; }
  } else message += ' 此文件超过 2 MiB，仅提供下载；本机上次保存未覆盖。';
  inspectLocalSave();
  notice(message, true);
}));
$('import-work').addEventListener('change', () => {
  const file = $('import-work').files[0];
  if (!file) return;
  task('在独立内核中验证并恢复工作…', async (epoch) => {
    try {
      if (file.size > FILE_SAVE_LIMIT) throw new Error('工作文件超过 128 MiB 限制。当前工作已保留。');
      const text = await file.text();
      if (epoch !== state.epoch) return;
      let document;
      try { document = JSON.parse(text); }
      catch { throw new Error('工作文件不是有效的 JSON。当前工作已保留。'); }
      await restoreWork(document, epoch);
    } finally { $('import-work').value = ''; }
  });
});
$('restore-last').addEventListener('click', () => task('重新验证本机上次保存…', async (epoch) => {
  const text = localStorage.getItem(LOCAL_SAVE_KEY);
  if (!text) { inspectLocalSave(); throw new Error('本机没有可恢复的保存文件。'); }
  if (new TextEncoder().encode(text).length > LOCAL_SAVE_LIMIT) throw new Error('本机保存超出 2 MiB 限制；请从工作文件导入。');
  await restoreWork(JSON.parse(text), epoch);
}));
$('apply-form').addEventListener('submit', (event) => { event.preventDefault(); apply($('label').value); });
$('construct-tab').addEventListener('click', () => setMode('construct'));
$('replay-tab').addEventListener('click', () => setMode('replay'));
$('restart').addEventListener('click', () => task('创建新的空栈会话…', () => selectTarget(state.target)));
$('rewind').addEventListener('click', () => task('重放成功动作前缀…', async () => {
  const successful_step_count = state.events.length - 1;
  const response = await request('rewind', { session_id: state.session, successful_step_count });
  state.events = state.events.slice(0, successful_step_count);
  state.view = response.data.view;
  clearPreview();
  renderView();
}));
$('finish').addEventListener('click', () => task('检查最终栈与目标是否一致…', async () => {
  const response = await request('finish', { session_id: state.session });
  state.view = response.data.view;
  clearPreview();
  renderView();
  notice('构造完成：最终栈与目标一致。现在可以下载普通 .mm 证明。', true);
}));
$('export').addEventListener('click', () => task('生成自足普通证明文件…', async () => {
  const new_label = $('export-label').value.trim();
  if (!new_label) throw new Error('请填写一个新的定理标签。');
  const response = await request('export', { session_id: state.session, new_label });
  download(response.data.text, `${new_label}.mm`, 'text/plain;charset=us-ascii');
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
  invalidateWorker(new Error('已取消：活动及恢复工作线程已终止。显示的只是最后确认视图；请重新加载数据库或恢复保存文件。'));
  state.taskId += 1;
  state.busy = false;
  renderControls();
  $('activity').classList.remove('busy');
  $('activity').textContent = '已取消 · 原数据库与会话句柄已失效';
  notice('已终止活动及恢复工作线程。最后确认视图保留为只读；继续操作须重新加载数据库或恢复保存文件。', true);
});

inspectLocalSave();
renderControls();
task('读取 demo0 示例并启动原生核心…', loadBuiltin);
