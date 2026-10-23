# API · schema_version 1

公共根包 `AlexenderSokolov/moonmetamath` 暴露 `dispatch_json(String) -> String`。它接受一个 JSON 请求并返回一个 JSON 响应；数学语义由 MoonBit 核心执行。JS 构建产物 `dist/moonmetamath-core.mjs` 导出同名函数。根包与 `src/core` 的实际导出分别见 `pkg.generated.mbti`、`src/core/pkg.generated.mbti`。

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
| `start` | `database_id`, `target_label`, 可选 `limits` | `session_id`, `view`；从空栈开始重做现有 `$p` |
| `apply_label` | `session_id`, `label` | `event`, `view`；所有检查通过后原子提交 |
| `inspect` | `session_id` | `view`；只读快照 |
| `rewind` | `session_id`, `successful_step_count` | `view`；用相同执行器重放成功前缀 |
| `finish` | `session_id` | `view`；只有栈恰有一项且与目标逐 token 相等才完成 |
| `export` | `session_id`, `new_label` | `text`, `new_label`, `source_ids`；导出自足普通证明 |
| `replay` | `database_id`, `target_label`, 可选 `limits` | `view`, `events`, `mode: "replay"`；只读检查原证明 |
| `reset` | 无额外字段 | data 为 null；释放本实例全部数据库和会话句柄 |

`sources` 是 `{source_id: String, text: String}` 数组。源名是逻辑名字，不授予磁盘或网络访问权限。include 只在集合内解析；相对路径以包含文件所在逻辑目录为基准，规范化后同名源只处理第一次。

所有句柄只属于当前 dispatcher 实例。当前最多持有 16 个数据库、64 个构造会话；达到上限时返回资源诊断。`reset` 后旧句柄失效；它不重置数学语义或为旧句柄绑定新库。宿主重建模块或终止 Worker 同样会丢弃上下文。

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
apply_label(MMSession, String) -> Result[MMStepEvent, MMError]
inspect_session(MMSession) -> MMSessionView
rewind(MMSession, Int) -> Result[MMSessionView, MMError]
finish(MMSession) -> Result[MMSessionView, MMError]
export_normal_proof(MMSession, String) -> Result[MMExport, MMError]
replay_proof(MMDatabase, String, Limits) -> Result[MMSession, MMError]
```

数据库、会话与声明字段保持私有。完整签名及公开结果字段以生成接口为准；对宿主集成优先使用稳定的 schema 1 dispatcher。

## 额度与取消

默认额度见 [COMPATIBILITY.md](COMPATIBILITY.md)。同步 `dispatch_json` 不接收可中断当前调用的 cancel 消息。Web 宿主使用 Worker.terminate() 真正取消；最后确认视图只读，继续需要重新加载。Node CLI 将操作放入 worker_threads，默认 120000 ms 截止及 512 MiB old-generation heap 限制；`--timeout-ms N` 可设为 1..300000，超时或 SIGINT 由宿主终止线程并以退出码 5 返回未完成。此机制不提供可恢复会话或精细进度。

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
