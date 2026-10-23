# API · schema_version 1

公共根包 `AlexenderSokolov/moonmetamath` 暴露 `dispatch_json(String) -> String`。它接受一个 JSON 请求并返回一个 JSON 响应；数学语义由 MoonBit 核心执行。JS 构建产物 `dist/moonmetamath-core.mjs` 导出同名函数。根包与 `src/core` 的实际导出分别见 `pkg.generated.mbti`、`src/core/pkg.generated.mbti`。

本文包含0.2.0新增的 `rules`、`preview`、`create_goal`；schema版本仍为1。0.2.0已从Mooncakes安装，并经独立消费者在JS/wasm-gc完成包含新增接口的15操作验收。

## 请求与响应

所有请求必须包含整数 `schema_version: 1`、字符串 `request_id` 与字符串 `operation`。未知操作、未知字段、错误字段类型都会被拒绝；不忽略调用者传入的未知动作。

```json
{"schema_version":1,"request_id":"load-1","operation":"load","entry":"mini.mm","sources":[{"source_id":"mini.mm","text":"$c |- a $. ax $a |- a $. th $p |- a $= ax $."}]}
```

响应统一包含：

```json
{"schema_version":1,"request_id":"load-1","operation":"load","status":"ok","outcome":null,"data":{"database_id":"db-1","declaration_count":3,"verified_count":0},"diagnostics":[]}
```

`status` 是请求执行状态 `ok|error`，不等于数学验证结论。数据库验证可以返回 `status: "ok", outcome: "invalid"`；纯查询的 outcome 为 null。结果枚举包括 `valid`、`invalid`、`incomplete`、`unsupported`、`resource_limit`、`cancelled`，实际操作按适用范围返回。单步拒绝返回 `status: "error"` 与诊断，普通拒绝的 outcome 可以是 null。

诊断字段为 `code`、`message`、`source`、`start`、`end`、`line`、`column`。位置以源文件为准：字节范围左闭右开，行列从 1 开始；请求结构错误使用 source `request`。宿主 IO 错误由 CLI/Web 宿主产生，不伪装成数学反例。

## 操作

表中“输入”不重复三项公共字段。`limits` 只接受额度表列出的整数字段；省略字段使用默认值。

| operation | 输入 | data 与作用 |
| --- | --- | --- |
| `load` | `entry`, `sources`, 可选 `limits` | `database_id`, `declaration_count`, `verified_count: 0`；解析源集合，不验证 `$p` |
| `verify` | `database_id`, 可选 `limits` | 顺序检查数据库；返回下述完整性与计数 |
| `list` | `database_id`, 可选 `limits` | `theorems`: label、decl_id、status、goal、proof；不会隐式验证 |
| `rules` | `database_id`, `target_label`，可选 `query`, `typecode`, `offset`, `limit` | `rules`, `total`, `offset`；按可信目标上下文查找可用规则，不返回 proof |
| `create_goal` | `database_id`, `context_label`, `new_label`, `goal: String[]`，可选 `limits` | 新 `database_id`, `target_label`, `entry`, `sources`, `goal`, `active_hypotheses`, `disjoint`；创建继承上下文的独立未完成目标，不创建会话 |
| `start` | `database_id`, `target_label`, 可选 `limits` | `session_id`, `view`；从空栈开始重做现有 `$p` |
| `apply_label` | `session_id`, `label` | `event`, `view`；所有检查通过后原子提交 |
| `preview` | `session_id`, `label` | `event`, `view`；返回执行该步后的假想视图，不修改原会话 |
| `inspect` | `session_id` | `view`；只读快照 |
| `rewind` | `session_id`, `successful_step_count` | `view`；用相同执行器重放成功前缀 |
| `finish` | `session_id` | `view`；只有栈恰有一项且与目标逐 token 相等才完成 |
| `export` | `session_id`, `new_label` | `text`, `new_label`, `source_ids`；导出自足普通证明 |
| `replay` | `database_id`, `target_label`, 可选 `limits` | `view`, `events`, `mode: "replay"`；只读检查原证明 |
| `reset` | 无额外字段 | data 为 null；释放本实例全部数据库和会话句柄 |

`sources` 是 `{source_id: String, text: String}` 数组。源名是逻辑名字，不授予磁盘或网络访问权限。include 只在集合内解析；相对路径以包含文件所在逻辑目录为基准，规范化后同名源只处理第一次。

所有句柄只属于当前 dispatcher 实例。当前最多持有 16 个数据库、64 个构造会话；达到上限时返回资源诊断。`reset` 后旧句柄失效；它不重置数学语义或为旧句柄绑定新库。宿主重建模块或终止 Worker 同样会丢弃上下文。

## 规则查找、预览与新目标

`rules` 使用与 `start`/标签应用相同的上下文与信任检查；前缀中的 `$p` 须先验证。候选规则为活动 `$f/$e`、此前可见 `$a` 和此前 verified 的 `$p`。原目标、未来声明和非活动假设被排除；已结束作用域内声明的公理仍按其原有必要假设框架使用。

`query` 默认空串，按大小写敏感的子串匹配标签或以空格连接的结论；`typecode` 默认空串，否则精确匹配结论的第一个 token。`offset` 默认 0 且须非负；`limit` 默认 20，范围 0..100。`total` 是筛选后的总条数，规则按声明顺序返回。每条规则的字段为：

```json
{"label":"copy","kind":"$a","conclusion":["t","x"],"mandatory_hypotheses":[{"label":"vx","kind":"$f","expression":["t","x"]}],"disjoint":[]}
```

`mandatory_hypotheses` 保持原声明次序；假设自身直接入栈，该数组为空。`disjoint` 为变量名二元数组。结果没有 proof 数组或源文本。旧 `list` **有意保留** `proof`，`replay` 有意读取原证明，二者适合显式教学或宿主查询，不能用作 AI 的观察输入。

`preview` 在私有会话副本上调用同一执行器。成功返回的 `view` 包含预计的新栈和成功步数；原会话的栈、日志、完成状态与额度都不变，错误同样不改变原会话。宿主可随后 `inspect` 比较当前状态，或显式 `apply_label` 真正提交。预览只检查这一步能否合法执行，不评估其对目标的帮助。

`create_goal` 的 `context_label` 必须是可开始构造的已有 `$p`。核心保留其原声明前缀、作用域、全部活动假设和 `$d`，以 `new_label $p ... $= ? $.` 替换原目标并关闭作用域。它排除原目标及全部后续声明，不插入新公理。新标签只能包含 ASCII 字母、数字、点、下划线或连字符，并不得与原数据库任何标签或数学符号冲突。目标不可为空，只能使用此前声明的常量和当前活动变量；解析器继续检查表达式/typecode 结构。

生成的独立数据库会重新解析并验证，只有前缀有效、恰有一个未完成目标时才登记新句柄。响应不含 `session_id`，须对返回的新 `database_id` 和 `target_label` 调用 `start`。`goal`、`active_hypotheses: {label, expression}[]` 与 `disjoint` 是新上下文的元数据；`entry` 和 `sources: {source_id, text}[]` 可供保存、下载和重新加载。

**生成源保留此前可信定理的完整证明。** 排除原目标的证明不等于源文件适合给模型：新源、旧源、`list`、`replay` 都不能进入 AI 策略观察。AI 宿主只能从允许字段构造目标/活动假设、规则元数据、`inspect` 视图和步骤反馈。

下面是可在仓库根目录运行的完整 0.2 示例，所有句柄均取自实际响应：

```js
import assert from 'node:assert/strict';
import { dispatch_json } from './dist/moonmetamath-core.mjs';
let serial = 0;
function call(operation, values = {}) {
  const result = JSON.parse(dispatch_json(JSON.stringify({
    schema_version: 1, request_id: String(++serial), operation, ...values
  })));
  assert.equal(result.status, 'ok', JSON.stringify(result));
  return result;
}
const loaded = call('load', { entry: 'mini.mm', sources: [{
  source_id: 'mini.mm',
  text: '$c t a $. $v x $. vx $f t x $. ax $a t a $. copy $a t x $. original $p t a $= ax $.'
}] });
const database_id = loaded.data.database_id;
assert.equal(call('verify', { database_id }).outcome, 'valid');
const rules = call('rules', { database_id, target_label: 'original',
  query: 'copy', typecode: 't', offset: 0, limit: 20 });
assert.equal(rules.data.rules[0].label, 'copy');
const created = call('create_goal', { database_id, context_label: 'original',
  new_label: 'fresh', goal: ['t', 'a'] }).data;
const session_id = call('start', { database_id: created.database_id,
  target_label: created.target_label }).data.session_id;
call('apply_label', { session_id, label: 'ax' });
const before = call('inspect', { session_id }).data.view;
call('preview', { session_id, label: 'copy' });
assert.deepEqual(call('inspect', { session_id }).data.view, before);
call('apply_label', { session_id, label: 'copy' });
assert.equal(call('finish', { session_id }).outcome, 'valid');
const exported = call('export', { session_id, new_label: 'fresh-export' });
console.log(exported.data.text);
```

## 读取验证结果

`verify.data` 包含 `complete`、`declaration_count`、`proof_count`、`verified_count`、`invalid_count`、`incomplete_count`、`not_checked_count`。只有本次范围完整检查且应验证的证明全部有效，才返回 outcome valid。`?` 是 incomplete；依赖未验证、无效或未完成证明的项不能升级为 verified。一个没有 `$p` 的合法数据库可以 valid，但 proof_count 为 0，不能据此声称验证过证明。

```json
{"schema_version":1,"request_id":"verify-1","operation":"verify","database_id":"db-1"}
```

不要硬编码示例句柄；实际应用从 load.data.database_id 取值。

## 会话与事件

`SessionView` 含 `target_label`、`goal: String[]`、`state: "open"|"complete"`、`mode: "construct"|"replay"`、`active_hypotheses: {label, expression}[]`、`successful_step_count`、`stack: String[][]`。栈的末项是栈顶。

`StepEvent` 含 `label`、必要假设标签 `hypotheses`、`substitutions: {variable, expression}[]`、`popped`、`pushed`、`result`。代换是同时代换；表达式是 token 数组，不能用视觉排版等价替代逐 token 相等。

`start` 固定目标原声明位置及活动作用域。允许活动 `$f/$e`、可见 `$a`、早于目标且 verified 的 `$p`；目标自身与未来标签被拒绝。目标之前存在未验证证明时不可开始。

失败的 apply 不改变栈、成功步数或日志。失败的 finish 保持会话可编辑。完成后想继续修改须显式 rewind 或重新 start。export 要求 complete 的构造会话与无冲突的新标签；它保留合法声明前缀及上下文，不把原目标或未来定理当作可用前提。replay 不产生可编辑会话句柄，也不把保存项冒充普通证明推导。

完整最小会话顺序为 `load → verify → start → apply_label("ax") → finish → export`，针对本页 mini.mm。每步使用前一步返回的真实句柄。

## 原生结构化 API

需要结果类型的 MoonBit 消费者可以导入 `AlexenderSokolov/moonmetamath/src/core`。主要签名为：

```moonbit
parse_sources(String, Array[(String, String)]) -> Result[MMDatabase, MMError]
parse_sources_with_limits(String, Array[(String, String)], Limits) -> Result[MMDatabase, MMError]
verify_database(MMDatabase, Limits) -> MMReport
start_proof(MMDatabase, String, Limits) -> Result[MMSession, MMError]
search_rules(MMDatabase, String, String, String, Int, Int) -> Result[MMRulePage, MMError]
create_goal(MMDatabase, String, String, Array[String], Limits) -> Result[MMCreatedGoal, MMError]
apply_label(MMSession, String) -> Result[MMStepEvent, MMError]
preview_label(MMSession, String) -> Result[(MMStepEvent, MMSessionView), MMError]
inspect_session(MMSession) -> MMSessionView
rewind(MMSession, Int) -> Result[MMSessionView, MMError]
finish(MMSession) -> Result[MMSessionView, MMError]
export_normal_proof(MMSession, String) -> Result[MMExport, MMError]
replay_proof(MMDatabase, String, Limits) -> Result[MMSession, MMError]
```

数据库、会话与声明字段保持私有。完整签名及公开结果字段以生成接口为准；对宿主集成优先使用稳定的 schema 1 dispatcher。

## 工作文件与恢复宿主

`web/notebook.mjs` 是异步宿主助手，不是新增 dispatcher 操作：

```js
const document = await createNotebook({ bundle: { entry, sources },
  target_label, actions, completed });
const restored = await restoreNotebook(document, isolatedRequest);
```

`createNotebook`、`restoreNotebook` 从该模块导入。工作文件严格包含 `schema_version: 1`、`entry`、`sources: [{source_id, text, sha256}]`、`target_label`、`actions: [{operation: "apply_label", label}]` 和布尔 `completed`；缺失或未知字段均拒绝。最多 128 MiB UTF-8 序列化数据和 10,000 个成功动作；源名需规范化、互不重复且不得逃出集合。撤回后只保存剩余成功前缀，不存 rewind/finish 动作、数据库/会话句柄、原始栈或内部可信状态。

恢复时先核对源文本 SHA-256，再在**新建且隔离**的核心/Worker 中执行 `load → verify → list → start → apply_label...`。`isolatedRequest` 是接收 `{operation, ...fields}` 并异步返回完整 schema 1 响应的函数；宿主补齐公共字段。verify 可报告 valid/incomplete/invalid；选定目标前缀是否可信仍由原生 start 决定。只有 `completed: true` 才额外调用 finish，且必须再次得到有效完成；该标记和源哈希都不是证明结论。返回 bundle、实际句柄、view、events、theorems、report 和 target。

调用者须在恢复全部成功后才采用返回的新内核，失败时保留当前工作。浏览器按此方式隔离候选 Worker；主动保存时至多 2 MiB 的文档另存本机上次保存，不自动上传，不自动持续保存。文件恢复和本机恢复均重新验证/重放。

## 额度与取消

默认额度见 [COMPATIBILITY.md](COMPATIBILITY.md)。同步 `dispatch_json` 不接收可中断当前调用的 cancel 消息。Web 宿主使用 Worker.terminate() 真正取消；最后确认视图只读，继续需要重新加载或恢复此前保存的工作文件。保存恢复通过新内核重放，不恢复已终止 Worker 的内部状态。Node CLI 将操作放入 worker_threads，默认 120000 ms 截止及 512 MiB old-generation heap 限制；`--timeout-ms N` 可设为 1..300000，超时或 SIGINT 由宿主终止线程并以退出码 5 返回未完成。CLI 不自动保存会话或提供精细进度。

## CLI 退出码

| 码 | 意义 |
| --- | --- |
| 0 | 验证/完成通过，或纯查询成功 |
| 1 | 输入证明被拒绝 |
| 2 | 参数、编码、请求结构或声明结构错误 |
| 3 | 宿主 IO、不可访问源或缺少构建产物 |
| 4 | 未完成或不支持的结果；含最终栈未达目标 |
| 5 | 资源额度或取消 |

具体诊断仍须读取 JSON。CLI session 接受动作数组或 `{schema_version:1, actions:[...]}`，可执行 apply_label、rewind、finish；由宿主注入 session_id，执行后最终调用 finish。CLI export 使用新标签 `moonmm-session-1`，不覆盖任何已有目的文件。Web/直接 API 可指定新标签。
