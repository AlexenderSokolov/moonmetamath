# MoonBit Metamath：规格与设计边界

版本：规格v1，2026-10-23。用户已授权Codex自主实现发布；核心/CLI/Web已实现，本地G0–G4通过。实际结构与状态见PROJECT/PROGRESS，实际接口见docs/API.md。原计划core/wire组织拆分已合并为单一core包，数学语义边界保持。

## 1. 产品与成功标准

核心产品是 MoonBit 原生 Metamath `.mm` 加载、验证与逐步证明库。附一个 Node CLI 和浏览器证明实验器，三个入口必须共用同一数学检查核心。

十月成功不是训练出新证明模型，而是用户可以直接：

1. 加载一个真实小库、选一个定理、查看并逐步重做证明，改错后得到可定位错误并修复。
2. 从独立 MoonBit 程序或 JSON 动作调用逐步接口，完成一个标准证明，导出并由另一检查器重放。
3. 对真实 `.mm` 数据库作批量检查，得到区分通过、错误、未完成和未检查范围的结构化结果。

目标人群：MoonBit 工具/agent 开发者、形式证明交互工具作者、Metamath 学习者。AI 用途有 GPT-f/Evariste 等先例，但**尚无新项目用户采用证据**。真实试用须单列，不能以作者三个演示替代。

不做：Lean `.lean/.olean` 兼容、TeX 自然语言证明认证、训练/部署模型、MCTS、通用统一/前提检索、逆向 tactic 全功能、数据库服务/账户系统、云协作。完整 `set.mm` 与更多证明表示属于增强目标，不挤压基本语义。

## 2. 全局约束

- 主体语义为 MoonBit；运行时不调用 Python、C 或 Rust 检查器判定证明。
- 主要移植参考为 `mmverify.py` 固定版本，项目建议 MIT；逐文件保留上游 MIT 版权。C/GPL 工具只作外部对照。
- 目标为 JS 与 wasm-gc 核心；Node.js 24 CLI 和现代浏览器为交付入口。native/wasm 额外后端仅在必要目标通过后添加，不宣称未测兼容。
- 工具链首选已经核实的 compiler `v0.10.14+7d59c7ec9`、moon `0.1.20260920`、对应 core；使用项目入口固定，不升级全局工具链。
- `.mm` 第一版以书中标准 ASCII profile 为准：可打印 ASCII 和规范空白（space/tab/CR/LF/form-feed）。非 ASCII、BOM、无效字节需有明确行为，不能替换后静默接受。
- 公共 wire schema 为整数 `schema_version=1`。状态、退出码与本规格一致；变更公共契约必须同步文档与消费者测试。
- 证明有效仅指在声明公理及有效假设下符合 Metamath 规则，不证明公理一致、自然语言含义正确或产生了新定理。

## 3. 文件与模块布局（PROJECT/CLAUDE/PROGRESS已备，其余实现待创建）

| 路径（相对新项目） | 职责 |
|---|---|
| `moon.mod`、`moon.pkg` | 模块与根 facade；公开包名在 T0 核实后固定 |
| `src/core/{types,source,lexer,parser,environment}.mbt` | token、源位置、声明、作用域、符号与标签 |
| `src/core/{substitution,proof_step,compressed,verifier}.mbt` | 同时代换、单步、压缩解码与顺序验证 |
| `src/core/{session,export,limits}.mbt` | 逐步会话、独立导出、取消和资源额度 |
| `src/core/moon.pkg` | 核心只依赖已固定标准库 |
| `src/wire/{json,render}.mbt`、`src/wire/moon.pkg` | 版本化 JSON 与可读结果，仍由 MoonBit 生成 |
| `src/js_bridge/{bridge.mbt,moon.pkg}` | JS 导出的薄入口，不拥有第二套数学逻辑 |
| `bin/moonmetamath.mjs` | Node 文件 IO、参数、退出码和加载编译产物 |
| `web/{index.html,app.mjs,worker.mjs,style.css}` | 简单可操作界面；不引入前端框架/打包器作为必要依赖 |
| `scripts/{toolchain,build,check,fixtures,oracle,acceptance,consumer}.mjs` | 固定工具链、构建、测试数据获取、对照及消费验证 |
| `scripts/toolchain.lock.json`、`references.lock.json` | 工具和外部来源固定版本/许可/实际取得情况 |
| `run_check.ps1`、`run_check.sh`、`run_demo.ps1`、`run_demo.sh`、`run_acceptance.ps1`、`run_acceptance.sh` | Windows/Linux 完整复现入口，调用同一 Node 编排；不包含删除操作 |
| `tests/fixtures/{local,upstream}`、`tests/fixtures/manifest.json` | 语义正反例和逐项期望；来源与许可清楚 |
| `tests/{cli,web,consumer}` | Node 集成、浏览器实际操作与全新消费者 |
| `examples/{learn,replay,check}` | 三场景输入、预期与步骤说明 |
| `PROJECT.md`、`PROGRESS.md`、`README.md`、`docs/{API,COMPATIBILITY,ACCEPTANCE,THIRD_PARTY}.md` | 背景、唯一进度入口、实际能力和边界 |
| `artifacts/`、`.references/`、`.toolchains/`、`_build/` | 忽略的执行产物/缓存，不与源代码混放 |

不要把 709 行参考机械拆成几十个空壳。上述文件在相关任务开始时创建；一个职责可由合理的小文件组合，不要求空文件占位。核心类型和接口变更由单一集成者负责，测试/文档可并行。

## 4. 数据、错误与信任状态

以下是接口契约；MoonBit 具体语法按锁定编译器实现，禁止照抄无法编译的伪语法。对外构造器保持最小，表达式、数据库和会话不透明。

| 类型 | 精确定义 |
|---|---|
| `SourceId` | 调用者提供的逻辑源名；不等于可自动访问的磁盘路径 |
| `SourceFile` | 源名与 ASCII 文本；保留文本和定位信息 |
| `SourceBundle` | entry 源名、源名到文件的映射、确定性 include resolver |
| `Span` | source_id、byte_start、byte_end（左闭右开）、line/column（1 起） |
| `TokenId`、`LabelId` | 当前数据库 intern 后的内部编号；不跨数据库持久化 |
| `Expr` | 不透明 token 序列；序列相等是逐 token 相等，不能用 pretty print 等价代替 |
| `DeclId` | 全库声明次序的单调编号；作用域关闭也不能重用旧次序 |
| `Assertion` | label、kind($a/$p)、decl_id、结论、按规范顺序的 mandatory hypotheses、mandatory `$d`、原始活动上下文 |
| `ProofStatus` | `NotChecked / Verified / Invalid / Incomplete`；保存具体诊断，不把资源中断写成 Invalid |
| `Outcome` | `Valid / Invalid / Incomplete / Unsupported / ResourceLimit / Cancelled`；wire 使用小写 snake_case |
| `Diagnostic` | code、phase、message、span、可选 theorem/step/related_span；code 为稳定标识，message 为解释 |
| `DatabaseReport` | outcome、complete、声明/证明计数、verified/invalid/incomplete/not_checked 计数、诊断与实际检查范围 |
| `SessionState` | `Open / Complete / Cancelled`；完整通过才能导出候选并注册到新的已验证环境 |

**三层状态必须分开：**

1. `parse_bundle` 只解析并记录声明，不能因此信任全部 `$p`。
2. `verify_database` 按声明次序检查，每个 `$p` 的依赖均已具备合法状态后才执行。
3. 会话应用标签还受目标原始声明位置、作用域和允许标签限制。

显式 `$a` 是已声明公理，不声称“证明过公理”。当前目标活动 `$f/$e` 是合法假设，可以使用。前置 `$p` 只有已验证且声明早于当前目标才可用。无效、未完成或未检查的前置证明不能作为成功前提。

数据库中某 `$p` 含 `?` 标记为 Incomplete；依赖它的证明不能标 Verified。总体 complete=false，明确列出被阻断/未检查项。核心不能暗自跳过坏定理后把全库标成成功。

## 5. 词法、声明与 include 语义

- 以固定规范为准处理关键词、标签和数学符号；标签必须唯一且不能与数学符号重名。
- 注释不嵌套；注释中的 `$[ ... $]` 只是注释。未知关键词、未闭合注释/声明/作用域、非法标签应定位报错。
- 常量/变量、类型码、活动假设、全局变量类型约束按规范检查；不能只在“应用证明”时补查所有语法。
- mandatory variables 来自断言结论和所有活动 `$e`；mandatory hypotheses 按**声明次序**构造，不能硬排成所有 `$f` 再所有 `$e`。
- include 只能在顶层且不在声明内部；被包含文件自身不得留下未闭合注释、include 或声明。
- **同一文件只包含第一次；自包含、回引顶层和已访问文件按规范忽略，不一概判循环错误。** resolver返回规范化SourceId；`a.mm`与`./a.mm`映射同一身份，Node按解析后的root内路径，浏览器按规范化逻辑路径处理。首次展开前登记，顶层源预先登记。测试文件边界处的注释、声明和`${/$}`块完整性，不允许借另一个文件偷偷补全不完整包含文件；若对照实现存在分歧，回到R1的语法定义定位，不私改预期。
- 规范没有统一规定路径分隔符情况下相对路径基准。本项目宿主策略明确为“相对包含文件所在逻辑目录”，结果中记录；无分隔符的标准文件必须可移植。
- core 通过 resolver 获取源文件，不读磁盘/网络。Node resolver 只解析调用者给定 root 内文件；浏览器 resolver 只使用上传的文件集合。无 URL include、自动联网拉库或文件编辑器。
- 缺文件/不可读为宿主错误，不是数学 Invalid。重复/嵌套 include 测试必须与所选源身份策略一致。

## 6. 普通/压缩证明的共用检查

普通证明每个 label 解成 `ApplyLabel`。压缩证明解码成 `ApplyLabel / SaveTop / ReuseSaved` 后进入同一个执行器，不重新实现代换逻辑。

单步应用断言时：

1. 检查标签合法、可见、声明早于目标；若是 `$p`，其 proof status 必须可用。
2. 从栈中取与 mandatory hypotheses 数量相同的候选，不先破坏原栈。
3. 根据 `$f` 检查类型码，构造同时代换；允许合法的空表达式替换。
4. 用代换后的 `$e` 与对应栈项逐 token 比较。
5. 对断言要求的每一 `$d` 对，计算两边代换结果中的活动变量集合：不相交，且跨集合每一对都在当前上下文的有效 disjoint 关系中。
6. 实例化结论并检查资源预算；通过后一次提交栈变化和事件。

压缩解码必须检查：mandatory hypothesis 顺序、显式标签表、有效数字编码、悬空编码前缀、非法字符、整数溢出/越界；`Z` 保存非空栈顶；只重用当前证明中已有保存项。保存表不能从外部注入未经证明的表达式。

`?` 是未完成状态。证明栈为空、残留多项、最终表达式与目标不等都不能完成。执行一步成功不等于证明结束。

## 7. 公共 API 草案（任务之间的固定接口）

| 接口 | 输入 → 输出 | 所属 |
|---|---|---|
| `parse_bundle(bundle, limits)` | `SourceBundle, Limits → Result[Database, Diagnostic]` | core |
| `verify_database(db, limits)` | `Database, Limits → DatabaseReport`；结果更新数据库内独立验证状态 | core |
| `list_theorems(db)` | `Database → Array[TheoremInfo]`，含 status 与声明位置 | core |
| `start_proof(db, target_label, limits)` | `Database, String, Limits → Result[ProofSession, Diagnostic]` | core |
| `apply_label(session, label)` | `ProofSession, String → Result[StepEvent, RejectedStep]` | core |
| `inspect_session(session)` | `ProofSession → SessionView`；不可变副本 | core |
| `rewind(session, successful_step_count)` | `ProofSession, Int → Result[SessionView, Diagnostic]` | core |
| `finish(session)` | `ProofSession → Result[Completion, FinishError]` | core |
| `export_normal_proof(session, new_label)` | 完成会话 → `Result[ExportedBundle, Diagnostic]` | core |
| `render_report_json(report)` / `render_session_json(view)` | 类型 → schema 1 JSON 字符串 | wire |
| `dispatch_json(request_json)` | schema 1 请求 → schema 1 响应；桥接仅解析动作与调用上述函数 | js_bridge |

`parse_bundle` 形成合法 AST 不保证 proof status；`verify_database` 必须产生明确状态。`start_proof` 只允许在前缀已完整验证、上下文可恢复的目标上启动。十月只重做已有定理，不做任意新目标编辑器。

`start_proof` 固定目标的原始声明位置和活动上下文。不能因为整库验证后状态是 Verified 就使用目标自身/未来定理。已知目标原证明可用于“查看/回放”模式；**AI 构造模式不把原答案序列作为模型输入或允许动作**。

单步失败必须原子化：栈、保存表、步数、日志和上下文均保持不变。成功事件包含 label、匹配的必要假设、显式代换、弹入/推出数量与结果；不要输出全部大库内部表。

首版 `rewind(k)` 通过同一个执行器回放成功前缀实现即可。不得建立单独的近似“撤销语义”。`finish` 失败保留可编辑会话；complete 后动作需要显式 rewind/restart，不暗改已完成证明。

## 8. 导出与独立复核

- 十月只导出**由ApplyLabel构造的手动/外部动作会话的普通标签证明**，压缩导出非必做。已有压缩证明的replay可查看，不直接导出为普通证明；保存项只有Expr时并不拥有展开它的完整推导。尝试导出replay返回`UnsupportedExport`，不能编造证明步骤。后续若扩展，须保存推导provenance并限制展开体积。
- 对已有定理重证明，导出目标之前的合法声明前缀、原活动上下文以及新候选定理；保留或正确关闭当前作用域。
- 不把候选附加到包含原目标与未来定理的完整数据库末尾。需要包含前缀时展开 include 成一个自足文件，保留必要来源说明。
- 临时标签如 `moonmm-session-1`，满足标签规则且全局无冲突；不覆盖原标签。
- 所导前缀要求全部证明已验证；不把 `$p` 转成 `$a`，不删 `$d` 或 essential hypotheses。
- 导出后由官方 C checker 或 Rust checker实际执行证明验证。只读取数据库或比较格式不算通过。
- 导出工具将结果写到调用者指定的新文件，不覆盖输入数据库。候选导出与检查状态分开记录。

## 9. CLI 与 wire 协议

产品命令约定（由 Node host 适配，数学结果由 MoonBit core/wire 产生）：

| 命令 | 用途 |
|---|---|
| `node bin/moonmetamath.mjs verify FILE --format json|text` | 检查文件及已声明的 include；默认只读 |
| `node bin/moonmetamath.mjs list FILE --format json` | 列出定理与未检查状态；不是 verify 成功 |
| `node bin/moonmetamath.mjs replay FILE --theorem LABEL --format json` | 逐步回放已有证明；清楚标为 replay |
| `node bin/moonmetamath.mjs session FILE --theorem LABEL --actions ACTIONS.json --export OUT.mm` | 执行外部动作；仅完成才导出，OUT 不可覆盖输入 |
| `node bin/moonmetamath.mjs --help` / `--version` | 公共入口 |

`ACTIONS.json`：schema_version=1、目标标签、按顺序的 apply_label/rewind/finish；不接受任意栈表达式、代码或 shell。wire 还包括 start/inspect/cancel 等 UI 动作。所有未知字段/动作采取明确输入错误，避免客户端以为忽略动作已执行。

退出码：0=验证/会话完整通过或纯查询命令成功；1=输入中的证明被拒绝；2=参数/编码/文档结构错误；3=IO/环境/缺少 include；4=Incomplete/Unsupported；5=资源超限/取消。查询命令的0不等于证明已检查，JSON含 operation。

stdout 为选定格式的唯一结果；stderr 为宿主错误/进度。JSON不得夹杂日志，不泄露环境变量或密钥。node wrapper不得自行生成“数学通过”。

### 9.1 JSON桥接的最小确定契约

请求统一有 `schema_version: 1`、`request_id`（调用者字符串）、`operation`；其余字段按操作固定。响应回显这三项，另含 `status: ok|error`、`outcome`（证明操作用规格枚举，纯查询为null）、`data`、`diagnostics`数组。这里ok只表示请求成功执行，Invalid证明也可以是ok+outcome=invalid；结构/宿主失败是error，不能混成证明反例。

| operation | 额外输入 | data至少包含 |
|---|---|---|
| `load` | `entry`、`sources`（source_id/text数组）、`limits`可选 | `database_id`、解析声明数；`$p`仍NotChecked |
| `verify` | `database_id` | outcome/complete及各状态计数；逐定理状态留在db |
| `list` | `database_id` | `theorems`：label/decl_id/status/goal摘要 |
| `start` | `database_id`、`target_label` | `session_id`、目标/活动假设、成功步数0 |
| `apply_label` | `session_id`、`label` | StepEvent及更新后的SessionView |
| `inspect` | `session_id` | SessionView，不授予修改内部状态的能力 |
| `rewind` | `session_id`、`successful_step_count` | 重放后的SessionView |
| `finish` | `session_id` | Complete或未完成原因、可继续编辑状态 |
| `export` | `session_id`、`new_label` | 自足普通证明文本和source归属，拒绝非构造/未完成会话 |
| `replay` | `database_id`、`target_label` | 明确mode=replay的只读步骤/摘要，不把答案当构造结果 |

桥接在单个Worker/CLI执行上下文内持有不透明database/session handle；句柄不跨进程或worker重启。不存在/过期句柄明确错误，不能自动绑定另一个数据库。初版不要求跨会话序列化内部状态。

`cancel`是宿主动作，由主线程终止worker并包装取消结果，不发送到正忙的同步dispatch来假装已经中断。是否能继续操作依第10节的重建规则。ACTIONS文件允许的动作与字段在T8严格固定；不接受任意表达式栈或脚本执行。

`complete`只描述本次请求的检查覆盖范围，是否成立看outcome；只有全请求范围完成且所有应验证证明为Verified才可outcome=valid。任一Invalid/Incomplete/NotChecked/中断都不能用complete=true掩盖。报告至少使用 `verified_count`、`invalid_count`、`incomplete_count`、`not_checked_count`，不能从声明总数反推已验证量。

## 10. 确定性、资源与网页

初始 Limits 是可配置的执行护栏，不是性能结论：单文件64MiB、总源128MiB、include深度32、token总数10,000,000、执行操作10,000,000、栈项100,000、单表达式token1,000,000。T0/真实库实测后如需调整，记录原因，不更改数学结果语义。编码整数字段/计数使用检查算术，不能溢出回绕。

超限/取消返回未完成，不能输出 Valid。十月明确采用**宿主终止工作线程**的最小取消方案：长同步验证放Web Worker（CLI用worker_threads或子进程），取消由主线程terminate并生成Cancelled/exit5；普通postMessage不能中断正在执行的同步核心。UI只保留最后一次已确认的只读视图，不承诺恢复被终止的内部状态；继续操作须重建worker并从已验证输入及成功动作前缀重新开始。没有进度回调时展示实际阶段/已确认步骤和不定进度，不伪造百分比。优雅的分批cursor/advance为后续可选，不在十月隐式承诺。默认不展示几十MB完整源码或每一步全栈副本。

网页必须完成：选择内置真实小库/上传文件集合 → 选择定理 → 查看目标与有效假设 → 回放或手动apply标签 → 显示代换/栈/拒绝原因 → 回退/重试 → finish → 下载 `.mm`。视觉简洁，不做账号/云端存储。

## 11. 可选 LLM 与后续路线

AI 入口不是十月核心语义的依赖。若 T0–T9 按时通过，可做一个受限小库中的建议动作入口：模型只能输出动作/标签，core执行；最终结论和独立导出验证才是成功。无凭据时显示“未配置”；预置回放必须标明 replay，不能冒充实际模型调用。

后续优先顺序：完整set.mm兼容与内存/速度 → 真正下游接入 → 明确goal+label+substitution的逆向适配 → 使用者驱动的搜索/检索。后续不自动承诺模型训练。全球已有工具用于参考，不申报首创Web/自动证明，不声称形式化验证了本实现自身。

## 12. 权限与长期记录

本轮仅文档。Claude启动后按用户亲自发出的提示执行；建议本地实现、测试、独立Git与阶段提交，外部写入仍须另行批准。不得批量删除、改动旧项目、启动后台调度或联系他人。

根目录 `PROJECT.md`、`CLAUDE.md` 和唯一 `PROGRESS.md` 已依用户本次指令建立。执行者先读再增量更新，不覆盖现有规划。进度每任务记录：输入版本、完成内容、命令、输出位置、验证、限制、下一单元与责任者。不得将未完成验收项打勾；会话结束时写可恢复入口而非一句“待继续”。
