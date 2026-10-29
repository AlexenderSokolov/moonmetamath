# CLI

发行包使用 Node.js 24。运行 `node bin/moonmetamath.mjs --help` 查看命令。默认输出 JSON，失败时也从 stdout 读取响应，再判断退出码。

## 文件命令

| 命令 | 用途 |
| --- | --- |
| `verify FILE` | 验证数据库，读取 outcome 和完整性计数 |
| `theorems FILE` | 分页查询标签、目标与状态，不验证证明、不返回原证明 |
| `rules FILE --theorem LABEL` | 验证后查询指定目标可用的规则 |
| `list FILE` | 旧全量查询，包含原证明 |
| `replay FILE --theorem LABEL` | 检查并回放原证明 |
| `session FILE --theorem LABEL --actions FILE` | 执行动作并检查完成，可追加导出 |

```sh
node bin/moonmetamath.mjs theorems tests/fixtures/upstream/set-mm/demo0.mm --offset 0 --limit 1
node bin/moonmetamath.mjs rules tests/fixtures/upstream/set-mm/demo0.mm --theorem th1 --query tt --limit 1
node bin/moonmetamath.mjs session database.mm --theorem target --actions actions.json --export candidate.mm --new-label candidate
```

两种分页查询的 offset 默认 0，须为非负整数；limit 默认 20，范围 0..100。query 按标签或结论子串筛选，rules 还支持精确 typecode。查询结果中的 total 是筛选后的总数。rules 的前提可用性由核心检查；数据库中后续的未完成证明不会阻止合法目标前缀的查询。

公共选项为 `--format json|text`、`--root DIR`、`--timeout-ms N` 和 `--max-operations N`。include 默认限定在入口目录，可用 --root 指定源目录。默认操作预算为 10,000,000，超时为 120,000 ms，可设为 1..300000；各执行阶段分别使用操作预算。

session 的 --export 指定新文件，--new-label 指定新定理名；省略标签时沿用 moonmm-session-1。导出不会覆盖已有文件，处理以前导出的数据库时应使用未占用的标签。

## 动作失败与修正

动作文件接受数组或 `{ "schema_version": 1, "actions": [...] }`，支持 apply_label、rewind、finish，字段见 [API](API.md)。文件整体校验通过后才执行，末尾由宿主调用 finish。

session 返回错误时，原响应字段和退出码保持原义，另附 session_context：

| 字段 | 含义 |
| --- | --- |
| phase | validation、load、verify、start、action、finish 或 export |
| action_index | 失败输入动作的零基索引；不对应输入动作时为 null |
| successful_actions | 失败前成功执行的输入动作前缀，包含 rewind 和 finish |
| successful_action_count | 上述动作前缀长度 |
| view | 最近成功操作后的会话视图；尚未建立会话时为 null |

view.successful_step_count 是当前证明的步数。一次成功 rewind 会减少证明步数，但仍算一个已执行输入动作。失败步骤不改变会话，所以 view 可用于判断应如何修改动作。校验失败不执行有效前缀；硬超时或 Worker 崩溃时无法取得可靠会话快照，返回宿主错误。

例如，在 demo0.mm 的 th1 上依次执行 tt、missing-rule，第二个动作失败。实际响应中的相关字段如下（省略源定位和其余视图字段）：

```json
{
  "status": "error",
  "diagnostics": [
    {
      "code": "UnknownLabel",
      "message": "th1: Unknown proof label missing-rule"
    }
  ],
  "session_context": {
    "phase": "action",
    "action_index": 1,
    "successful_action_count": 1,
    "successful_actions": [
      {
        "operation": "apply_label",
        "label": "tt"
      }
    ],
    "view": {
      "state": "open",
      "successful_step_count": 1,
      "stack": [
        [
          "term",
          "t"
        ]
      ]
    }
  }
}
```

修正动作文件后重新运行 session。需要在同一会话中检查、修正和继续时，使用下面的 stdio 入口。

## 持续 JSONL 请求

```sh
node bin/moonmetamath.mjs stdio
```

进程启动后，可以直接输入这一行：

```json
{"schema_version":1,"request_id":"load-1","operation":"load","entry":"mini.mm","sources":[{"source_id":"mini.mm","text":"$c |- a $. ax $a |- a $. th $p |- a $= ax $."}]}
```

从响应 data.database_id 取得句柄，在同一进程继续发送 verify。下面的 `<database_id>` 须替换为刚收到的值：

```json
{"schema_version":1,"request_id":"verify-1","operation":"verify","database_id":"<database_id>"}
{"schema_version":1,"request_id":"start-1","operation":"start","database_id":"<database_id>","target_label":"th"}
```

start 返回 data.session_id。后续 preview、inspect、apply_label 使用该句柄；完成后 close_session，再 unload_database。保持 stdin/stdout 管道及进程存活，才能沿用这些句柄。

每个非空 UTF-8 行输入一个完整 schema 1 JSON 请求，stdout 返回一个 JSON 响应。保留返回的 database_id、session_id，用于同一进程中的后续请求。可调用 load、verify、theorems、rules、start、preview、inspect、apply_label、create_goal、finish、export、close_session、unload_database 等全部 [API 操作](API.md)。

请求中的 schema_version、request_id、operation 必须显式提供，宿主不补默认字段。请求错误和无效证明通过各自响应报告，随后仍可继续请求。空白行忽略，CRLF 可用，EOF 前最后一行无需换行；EOF 等待已读取请求处理完毕后正常退出。

文件输入示例：

```sh
node bin/moonmetamath.mjs stdio < requests.jsonl
```

PowerShell 可使用：

```powershell
Get-Content -Raw -Encoding utf8 requests.jsonl | node bin/moonmetamath.mjs stdio
```

stdio 仅接受 --timeout-ms 和 --max-line-bytes。默认每请求 120,000 ms，计时覆盖请求派发、Worker 中解析和执行；不包含等待用户输入或 stdout 消费者读取的时间。Worker old-generation heap 限额为 512 MiB，父进程输入缓冲另占内存。

默认单行传输上限为 256 MiB，可用 --max-line-bytes 显式设置 1..1,073,741,824 字节；LF 不计入，CR 计入。该额度约束编码后的 JSONL 行，源文本的 JSON 转义会增加体积。核心仍按 [资源额度](COMPATIBILITY.md) 检查源集合和证明。

超时、SIGINT 或行超限会终止 Worker，输出一次 resource_limit 或 cancelled 终态，退出码为 5，全部句柄失效。终态尽可能带当前 request_id 和 operation；尚未解析到标识或空闲时取消，两字段为空串。Worker 或 IO 故障退出 3。普通请求错误不会改变 stdio 的正常 EOF 退出码，调用者应逐条读取 status、outcome 和 diagnostics。

## 退出码

| 码 | 文件命令含义 |
| --- | --- |
| 0 | 验证或构造完成，或查询成功 |
| 1 | 证明被拒绝 |
| 2 | 参数、编码、请求或声明结构错误 |
| 3 | 文件 IO、缺少源或构建产物 |
| 4 | 未完成、不支持或最终栈未达目标 |
| 5 | 资源限制或取消 |
