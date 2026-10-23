# MoonBit Metamath Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 执行方式已由用户选定为 **Claude Code**。若其环境没有上述技能，按本文任务与审阅门槛等价执行即可，不安装技能、不另建控制面、不重复询问执行方式。技能不提供额外提交、发布或外发权限。

**Goal:** 在独立项目中实现 MoonBit 原生 `.mm` 验证与逐步执行库，交付 CLI、网页实验器、真实数据库验证和可审查的十月发布材料。

**Architecture:** 纯 MoonBit 核心负责全部数学语义，普通/压缩/交互路径共用 proof-step。Node/浏览器只适配 IO 与交互；独立 verifier 只用于测试，不参与产品运行。

**Tech Stack:** 固定 MoonBit v0.10.14 完整版本、core 同版本、Node.js 24、原生 HTML/JS、Python 仅作参考检查；core 的 JS 与 wasm-gc 为必测目标。

**Spec:** [DESIGN_AND_SCOPE.md](DESIGN_AND_SCOPE.md)。参考固定版本见 [REFERENCES.md](REFERENCES.md)，验收协议见 [ACCEPTANCE.md](ACCEPTANCE.md)。

## Global Constraints

- 当前交付是规划，不写实现；下列任务由用户亲自把启动提示交给 Claude Code 后执行。
- 新项目仅在 `D:\Study_Works\MoonBit\moonmetamath`；父目录是 MoonFlowGraph，禁止修改其实现、Git 分支或纳入旧未跟踪内容。
- 运行时语义只能 MoonBit；不把 Python/C/Rust verifier 包装后称为 MoonBit 实现。
- 主要参考 R2 为 MIT；官方 C checker 为 GPL-2.0-or-later，只作外部工具调用。保留逐文件来源与许可。
- 本地 Git 初始化与阶段提交只有用户亲自发出含该授权的交接提示后执行；远程创建/push/PR、发布、部署、报名、联系他人均另需明确批准。
- 普通/压缩/交互使用同一执行器；未检查/未完成/超限/取消不得返回 Valid。
- 必测 JS/wasm-gc；不全局升级 MoonBit，不回退 latest。具体宿主路径由项目工具链入口解析。
- schema_version=1；CLI 退出码 0/1/2/3/4/5 与规格一致。
- 明确支持范围；不能为十月期限删去 `$d`、作用域、假设顺序、自身/未来引用或最终目标检查。
- 无批量删除；所有日志/失败证据保留；不启动后台循环或监控。

## Review Focus

1. **未验证前提与声明顺序**：加载全库后重做旧定理，仍拒绝自身/未来 `$p`；活动 `$f/$e` 合法可用。测试归 T2/T3/T6。
2. **压缩保存与可变状态**：非法数字/未来保存项/空栈 Z 不得接受，失败不得污染下一步。测试归 T4/T6。
3. **同时代换、空代换与 `$d`**：不能把同名变量交叉、漏掉环境 disjoint，或统一拒绝合法空式。测试归 T3/T5。
4. **include/词法边界**：注释里的 include 不展开，重复/自包含按第一次规则；缺文件和跨源未闭合结构明确失败。测试归 T1/T2/T8。
5. **外部可用性**：导出无自身/未来泄漏，clean consumer 真正安装调用，浏览器能取消并继续。测试归 T7/T9/T10/T12。

## 执行纪律与任务依赖

主实现者拥有核心接口与合并权。允许将不共享源码的测试清单、文档、网页样式任务交给 subagent；单个核心文件不多写者。T5、T7 和最终 G4 安排独立审阅；发现有依据的问题修复并只重跑受影响验收，不无限复审。

任务状态以新项目 `PROGRESS.md` 为准：每项记录责任者、开始/完成、版本、命令、产物、限制、下一单元。按 T0→T1→T2→T3→T4→T5(G0)→T6→T7→T8/T9→T10→T11→T12 推进。模型入口是可选，不得阻塞数学核心。

每个任务按“写明确失败用例→观察失败→实现最小行为→验证通过→记录→有授权时本地提交”执行。文档机械修改不写镜像测试。建议提交题目只是阶段名，禁止按数量造提交；初审十条有效提交应自然来自这些成果。

### T0：建立隔离项目、工具链与来源锁

**Files:** 已备 `PROJECT.md`、`CLAUDE.md`、`PROGRESS.md`、`README.md`，只增量完善；实施获准后创建 `LICENSE`、`.gitignore`、`moon.mod`、包级 `moon.pkg`、`references.lock.json`、`scripts/toolchain.lock.json`、`scripts/toolchain.mjs`、`scripts/build.mjs`、`scripts/check.mjs`、`run_check.ps1/.sh`。check先提供真实工具链/基本构建与task选择入口，后续任务逐项扩充，禁止未实现任务返回假PASS。

**Interfaces:** 后续所有脚本通过工具链入口解析实际 moon/moonc，不依赖全局旧版本。公开模块建议 `AlexenderSokolov/moonmetamath`，尚未发布；G0 前核实命名，无冲突再固定。

- [ ] 读取CLAUDE/PROJECT/PROGRESS和本资料包；目标目录已准备规划文档，确认实际内容并保留，不因目录已存在重复创建或清空。记录父仓库已有 dirty/untracked 状态。
- [ ] 用户明确授权实施后，在已准备目录内开始实现，增量完善 `PROJECT.md`；只有获得本地 Git 授权时，初始化该目录内独立仓库，默认分支 `codex/metamath-v0.1`。验证 `git rev-parse --show-toplevel` 正好是新项目。
- [ ] 建立最小 MoonBit facade、core/wire/js_bridge 包。按锁定编译器的官方配置核实 JS 导出方式，生成可从 Node 调用的稳定 `dist/moonmetamath-core.mjs`；不要假定 `_build` 某个路径恒定。
- [ ] 先用编译器/Node最小桥接检查证明“MoonBit函数确实被调用”，随后把该检查转成真实产品集成检查，不保留无关演示，不执行未获同意的文件删除。
- [ ] 检查已有 v0.10.14 隔离工具链；只读使用或独立缓存，不修改旧项目。`scripts/toolchain.mjs verify` 输出完整身份。校验失败停止构建，不用 PATH 里的 v0.10.3 继续。
- [ ] 取得 R1–R8 固定来源及必要小文件，核对SHA/许可并记录。大库不入产品包。更新公开排重，接口异常绝不算空结果。
- [ ] 运行 `node scripts/toolchain.mjs verify`、最小 `node scripts/build.mjs`；在 `PROGRESS.md` 记录真实输出与没有完成的事项。

**完成条件:** 独立路径、工具版本、源锁、最小 JS 导出被实证；不能只以目录和配置存在打勾。

### T1：ASCII 扫描器、源位置和注释

**Files:** `src/core/types.mbt`、`source.mbt`、`lexer.mbt`、同包 `lexer_wbtest.mbt`、`tests/fixtures/local/lexer/`。

**Interfaces:** `scan_source(SourceFile, Limits) → Result[TokenStream, Diagnostic]`；Token含原文/Span/源ID；构造Expr不公开可变数组。

- [ ] 测试 `lex_ascii_whitespace`：space/tab/CR/LF/form-feed 分隔同一 token序列，Span正确，CRLF只算一次换行。
- [ ] 测试 `lex_comment_is_not_include`、`lex_unclosed_comment`、`lex_nested_comment_rejected`；注释里的 `$[`不触发resolver。
- [ ] 测试非法ASCII/BOM/非ASCII、`$`相关非法token、标签非法字符、超长输入分别产生稳定code及位置，不静默替换。
- [ ] 实现扫描器与最小诊断类型；先测失败，再跑 `node scripts/check.mjs --task T1`，JS/wasm-gc同样用例同样结果。
- [ ] 更新支持范围和进度；有授权时提交实际代码与测试。

### T2：声明、作用域、文件包含与断言上下文

**Files:** `src/core/parser.mbt`、`environment.mbt`、`parser_wbtest.mbt`、`environment_wbtest.mbt`、`tests/fixtures/local/declarations/`、`include/`。

**Interfaces:** 实现 `parse_bundle`、`list_theorems`；形成 Assertion/DeclId/活动上下文与有序 mandatory hypotheses；所有 `$p` 起始 NotChecked。

- [ ] 测试 `$c/$v/$f/$e/$d/$a/$p` 合法最小例和未声明符号、重复标签、标签/数学符号重名、非法类型码、未闭合块。
- [ ] 测试 `hypothesis_order_interleaved_f_e`：按固定规范构造 `$e` 后仍有 `$f` 的合法例，与独立checker核对；不要照抄R2历史限制。
- [ ] 测试关闭作用域的假设不可引用、同变量类型约束、结论和所有活动`$e`决定mandatory变量；只把有必要变量的`$f`加入mandatory列表。
- [ ] 测试 include顶层合法/声明内部非法/块内非法、缺文件、注释内不展开、a.mm与./a.mm别名只展开一次、自包含/回引顶层忽略、跨文件未闭合注释/声明/块的行为按R1定位并核对。
- [ ] 实现resolver契约和逻辑源身份；Node磁盘IO留T8，先用内存SourceBundle测试。默认相对包含源目录的策略写明，不假称规范唯一选择。
- [ ] 测试 `parse_does_not_verify_p`：即使解析无误，`$p`都不能标Verified。
- [ ] 运行 `node scripts/check.mjs --task T2`；记录规范/参考差异，不修改规范期望来追随单个工具。

### T3：同时代换、普通证明与顺序验证

**Files:** `substitution.mbt`、`proof_step.mbt`、`verifier.mbt`、相关 `*_wbtest.mbt`、`tests/fixtures/local/proof/`。

**Interfaces:** 实现共用内部 `execute_op(context, state, op, limits)` 与 `verify_database`。后续session与compressed只能调用此执行器。

- [ ] 测试 `subst_simultaneous_not_recursive`、合法空代换、类型码不符、缺少mandatory项、essential hypothesis替换后不匹配。
- [ ] 测试 `$d` 正例、两代换集合相交、集合不相交但缺环境disjoint、代换只含常量、含当前活动变量；每例根据规范而非prettyprint判断。
- [ ] 测试公理和当前活动假设合法可用；自身/未来/非活动标签、前置NotChecked/Incomplete/Invalid `$p`均不能作为可用定理。
- [ ] 测试栈下溢、空终态、剩两项、最终结论不符；只有单项且逐token等于目标才Verified。
- [ ] 按DeclId顺序验证；不能因parse完整库就开放未来标签。`?`进入Incomplete；依赖受阻的后续项明确NotChecked，不给全库complete=true。
- [ ] 单步先计算候选再提交；资源不足和任何拒绝都保持前一状态。执行 `node scripts/check.mjs --task T3`。

### T4：压缩证明解码与状态复用

**Files:** `compressed.mbt`、`compressed_wbtest.mbt`、`tests/fixtures/local/compressed/`；只在必要处扩展proof_step的Op。

**Interfaces:** `decode_compressed`产生ApplyLabel/SaveTop/ReuseSaved流，直接接T3执行器。保存项只能来自本证明已合法计算的结果。

- [ ] 同一定理的普通与压缩证明结果一致；implicit mandatory表顺序与T2完全相同。
- [ ] 测试显式标签表、多个保存项重复使用、空栈Z、引用未来/越界保存项、标签索引越界、无效字符、编码整数溢出和悬空前缀。
- [ ] 测试压缩路径中的作用域/类型码/`$d`拒绝与普通路径一致。
- [ ] `?`输出Incomplete，不能被忽略。限额同时约束解码与保存，不能先巨量解压再检查预算。
- [ ] 执行 `node scripts/check.mjs --task T4`，保留普通/压缩对照结果。

### T5：外部语义样例与 G0（开始后48小时内）

**Files:** `tests/fixtures/manifest.json`、`scripts/fixtures.mjs`、`scripts/oracle.mjs`、`scripts/acceptance.mjs`（先实现G0，后续增量加入各gate）、`docs/COMPATIBILITY.md`、`tests/oracle/`。

**Interfaces:** fixture清单每项记录source_repo/commit/path/license/expectation/feature；oracle输出每个检查器的实际状态与raw日志路径。

- [ ] 从R5/R6/R8选择普通/压缩、scope、hypothesis order、empty substitution、`$d`、unknown proof、include等代表样例。逐项核对should verify/error/warn，不能一键把全部报错视为期望。
- [ ] 编写oracle驱动自检：一个已知通过、一个已知失败、一个Incomplete；官方C需真正VERIFY PROOF，不以READ或末尾泛化句判断。
- [ ] 优先调用已有C/Rust工具；没有时先用独立`mmreference.py`继续对照，不未经批准安装大型系统工具链。但**最终导出验收仍须至少一个C/Rust独立工具**；若缺失，明确pending而非通过。
- [ ] 在固定demo0/miu上运行全库检查，记录core JS/wasm-gc、R2参考和独立checker结果。不同结果定位到最小输入；不投票决定。
- [ ] 独立review T1–T4，处理有依据的错误接受/错误拒绝；只重跑受影响用例和必要全套。
- [ ] 执行 `node scripts/acceptance.mjs --gate G0 --out artifacts/g0-<run-id>`，如实输出PASS/FAIL/PENDING。

**G0未过:** 优先修复；若仍接受无效证明、关键语义不清或只能靠Python运行，停止十月完整产品承诺，报告当前事实和剩余工作。不得改用例/跳过`$d`/删压缩证明伪造进度。

### T6：可操作的逐步证明会话

**Files:** `session.mbt`、`session_wbtest.mbt`、`tests/fixtures/local/session/`。

**Interfaces:** 实现 start_proof/apply_label/inspect_session/rewind/finish；类型与规格一致。公开SessionView只读，不暴露可随意注入的栈。

- [ ] 用已验证demo0目标构造完整步骤：每一步返回标签、代换、栈变化；finish正确完成。
- [ ] 测试失败原子性：错误步骤前后栈、步骤序号、上下文和保存表均一致，随后合法动作能成功。
- [ ] 测试`rewind(0)`、回到中间成功步骤、越界回退、完成后重开；回退通过同执行器重放前缀实现。
- [ ] 测试`reprove_uses_original_position`：整库已经Verified也不能引用目标自身/未来定理；前置未完成时不能启动可导出会话。
- [ ] finish空栈/多项/错目标返回可解释错误，不锁死Open会话；Complete只在终态合法时产生。
- [ ] 执行 `node scripts/check.mjs --task T6`；更新API文档的真实签名。

### T7：正常 `.mm` 导出、真实数据库与独立重放

**Files:** `export.mbt`、`export_wbtest.mbt`、`scripts/oracle.mjs`、`examples/replay/`、`docs/ACCEPTANCE.md`。

**Interfaces:** `export_normal_proof`输出自足ExportedBundle（普通证明文本、唯一标签、来源列表），仅接受Complete会话。

- [ ] 测试Incomplete不能导出；重名/非法新标签拒绝；输入数据库不被写入。首版导出仅支持ApplyLabel构造会话；压缩replay的导出明确UnsupportedExport，不在缺少推导provenance时编造展开。
- [ ] 对已有目标导出目标之前的合法前缀和原活动上下文；include展开为一个自足文件，必要时保留正确作用域关闭。
- [ ] 测试导出中没有原目标/未来标签泄漏；不将任何`$p`降为`$a`，不删`$d/$e`。
- [ ] 官方C或Rust检查器实际接受候选完整证明；再故意改一步应拒绝，证实驱动检查到的是本次输出。
- [ ] 验证固定demo0、miu、peano、hol；每个分别记录结果、checked范围、运行时间与host内存口径。hol作为十月真实库目标，不仅教学toy。
- [ ] set.mm/ql/nf等为增强项；当前限额不足或性能不明时保持pending，不改变must语义来追规模。
- [ ] 独立review导出与身份/顺序边界，执行 `node scripts/acceptance.mjs --gate G2 --out artifacts/g2-<run-id>`。

### T8：Node CLI、JSON协议与宿主IO

**Files:** `src/wire/json.mbt`、`render.mbt`、`src/js_bridge/bridge.mbt`、`bin/moonmetamath.mjs`、`tests/cli/cli.test.mjs`。

**Interfaces:** verify/list/replay/session/help/version 与schema 1、退出码按规格；Node只处理文件/参数，不能产生第二套数学判断。

- [ ] 测试verify通过exit0、无效exit1、编码/参数exit2、缺include/IOexit3、Incomplete/Unsupported exit4、超限/取消exit5。
- [ ] list/replay输出明确operation和验证范围；查询exit0不声称证明通过。stdout为单一JSON或text，进度到stderr。
- [ ] 验证路径含空格、中文宿主目录、ASCII `.mm` 内容、上传/本地源名映射；使用参数数组启动外部工具，不拼shell命令。
- [ ] session通过ACTIONS执行T6；未知动作/字段、伪造栈输入拒绝；只有Complete才写OUT，拒绝覆盖源文件。
- [ ] 测试CLI包在没有MoonBit编译器的Node24环境运行，数学核心确来自生成产物。
- [ ] 执行 `node --test tests/cli/*.test.mjs`（跨平台展开由scripts/check.mjs负责，不依赖shell glob）。

### T9：网页完整流程、Worker与取消

**Files:** `web/index.html`、`app.mjs`、`worker.mjs`、`style.css`、`scripts/serve.mjs`、`tests/web/manual-checklist.md`。

**Interfaces:** worker调用同dispatch_json，UI只展示数据。沿用schema 1与会话ID，不添加第二套证明解释器。

- [ ] 先列浏览器实际操作断言：打开demo0→选定理→显示目标假设→正确一步→故意错一步→错误可定位且状态没变→回退修复→完成→下载候选。
- [ ] 加载内置demo0/miu和上传文件集合；缺include提示正确源名。较大hol只显示摘要/所选定理，不创建全库巨量DOM。
- [ ] Worker执行长同步任务，显示真实阶段和已确认步骤；主线程terminate实现取消，标Cancelled，不给绿色通过。不依赖postMessage打断同步执行，不承诺复活已终止会话；重新开始要重建worker并重放输入/成功动作前缀。
- [ ] UI明确区分replay（已有答案）与construct（外部动作），以及一步合法/证明完成/全库完成。
- [ ] 在真实浏览器执行清单并保存必要截图与结果；只测HTTP200或静态HTML存在不算Web通过。优先已有浏览器工具；缺浏览器能力则明确G3 pending，不安装大型框架来假装完成。
- [ ] 界面不做账号/云端/图谱/聊天泛平台；视觉完善不得延误语义与直接使用。

### T10：独立消费者、CI、跨后端与复现脚本

**Files:** `scripts/{check,acceptance,consumer}.mjs`、`run_*.ps1/.sh`、`.github/workflows/ci.yml`、`tests/consumer/`、`docs/API.md`、`docs/COMPATIBILITY.md`。

**Interfaces:** run_check为基本检查，run_acceptance编排G0–G4；本地workspace consumer与registry consumer必须分开。

- [ ] 建立全新consumer目录与独立moon.mod，以workspace方式调用parse/verify/session，不引用项目内部私有函数。
- [ ] Windows/Linux入口调用同Node脚本；目录固定解析，不要求在父仓库运行，不更改全局PATH持久配置。
- [ ] fmt/info/check/build/test，JS与wasm-gc核心同输入同输出，Node CLI测试和session导出都纳入CI；native非必测不声称通过。
- [ ] CI安装固定toolchain，不跟随latest；fixture引用固定版本。外部工具不可用要显式失败/待验，不打印通过。
- [ ] 记录源码身份（有Git时HEAD及dirty列表）、工具版本、命令、fixture版本、日志、exit与未检查项；不为所有源文件额外造哈希审计框架。
- [ ] 验证`run_check`、`run_demo`、`run_acceptance`的失败能传播到顶层非零；外层不能吞掉Python/Node/进程错误。

### T11：三个场景、真实试用与可选AI试步

**Files:** `examples/{learn,replay,check}/`、`docs/SCENARIOS.md`、`docs/USER_TRIAL.md`、可选`examples/agent/`。

**Interfaces:** 每场景有明确输入、动作、结果、限制、复现入口；外部使用与作者自测分栏记录。

- [ ] 学习场景：demo0/miu逐步证明、故意修改、解释错误、修复和导出。不能只截终端最终一句成功。
- [ ] 开发者场景：独立消费者使用结构化接口，加载hol或小库，读取通过/错误结果。
- [ ] agent场景：ACTIONS由外部程序逐步提交，失败可恢复，导出由独立checker接受；默认确定性动作演示不假称LLM自动发现。
- [ ] 在用户明确授权联系时邀请真实使用者带任务操作；尚未取得授权只准备试用说明，不外发。记录真实卡点、结果和省事之处，不编写虚假反馈。
- [ ] 仅在T0–T10通过且有明确可用凭据授权时做一次实际LLM建议动作。密钥不进网页静态包/Git/日志；产品core不依赖模型。无授权/无凭据时标为未执行，不能用预设回放充数。
- [ ] 用户现有跨理论研究与Metamath接口的关系如实说明，不声称已兼容Lean/TeX或得到新数学结果。

### T12：发布准备、申报资料与长期接续

**Files:** `CHANGELOG.md`、`docs/RELEASE_READINESS.md`、`docs/APPLICATION_FACTS.md`、`notes/PROJECT_REUSE.md`、`PROJECT.md`、`PROGRESS.md`。

**Interfaces:** 准备阶段可本地完成；远程仓库/公开提交、PR、发布、部署、报名和外部消息均是明确权限门，不能由skill或本计划默认代办。

- [ ] README准确给出安装、三用途、兼容范围、参考/许可、已验证与pending；包清单不带.references/.toolchains/大库/密钥/用户报名信息。
- [ ] 确定版本与公共名字（建议0.1.0）；运行dry-run检查待发布内容，把候选包交给无编译器Node消费者实用测试。
- [ ] 准备至少10个自然实质本地提交、三场景、差异/外部需求证据、CI和Mooncakes状态表；不为计数补历史。
- [ ] 申报事实清单控制到用户能人工写一页：目标、MoonBit缺口、三场景、范围、技术路线、来源、可验证结果。申报正文由用户亲自定稿。
- [ ] 本地所有必要检查通过后，提交**具体可审查**的Git diff/候选包/发布命令/申报事实，统一列清待批准的外部动作。未批准时继续完成独立可做项，不停在模糊“请确认方案”。
- [ ] 获得对应授权后才创建远程/push/跑远端CI/正式moon publish/部署/提交报名；每项单独核对结果，不能把一项成功当全部完成。
- [ ] 发布后查询实际manifest（API入口以当时官方站源码为准），验证exact版本/has_package/build_status/yanked，再全新目录`moon add`安装并实际调用。dry-run或HTTP202不算发布。
- [ ] 最终更新唯一PROGRESS、PROJECT入口和本地复用说明：十月实际交付、失败/限制、后续下一单元与责任角色。后台任务未获授权不得创建。

## 后续阶段（不占十月必做范围）

1. 真实set.mm全库兼容、内存与吞吐改善；测量后再说性能优势。
2. 下游实际嵌入与外部试用；真实采用比支持更多未用API优先。
3. 独立设计goal+label+substitution→subgoals的逆向接口，不把forward栈API改名冒充；不复制Evariste非商业许可代码到MIT项目。
4. 可按需求提供检索/搜索适配与规范测试上游贡献。联系/PR/外发另遵当次授权。

## 计划自检与变更原则

- 每条规格由T0–T12和ACCEPTANCE的门槛覆盖；词法/include→T1/T2；普通语义→T3；压缩→T4；独立对照→T5；会话→T6；导出→T7；宿主/UI→T8/T9；消费/发布→T10/T12。
- API名字以规格表为准；实现中的必要调整必须同步规格、调用方和测试，不留两个近似接口。
- 项目入口与主语言不变。遇到时间压力，只削减可选AI、视觉细节、大库性能；数学健全性、真实错误与未完成状态不能放宽。
- 任何关键验收未做/工具缺失/权限待批均标PENDING，不把它们并入PASS。
