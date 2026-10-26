# Changelog

## 0.4.0 · 2026-10-26

- Add locked complete hol/nf/set database benchmarks with bounded subprocesses, separate dispatch/IO/serialization timings and honest OOM/timeout records.
- Avoid the eager source-character array and repeated unchanged scope snapshots; parse with private statement-sized token buffers after a complete lexical preflight.
- Preserve the public scanner array API, schema 1, operation limits, source diagnostics and unified proof executor.
- Scan host include tokens incrementally and release the legacy RegExp input cache, preserving reader semantics and CLI limits.
- Publish matched-budget measurements, including 48,097 set proofs under explicit 100m operation budget and the remaining large create_goal memory limit. No incremental verification or model experiment added.


## 0.3.0 · 2026-10-26

- Add opaque native Engine and JavaScript create_dispatcher factory while preserving the legacy dispatcher and schema 1.
- Add close_session and unload_database with ownership, active-session checks and stale-handle rejection.
- Preserve established verification evidence for immutable databases across bounded rechecks; reports still describe the current attempt.
- Normalize resource outcomes without changing diagnostic codes.
- Commit target/new-goal/upload transitions only after candidate success, release replaced resources, and prevent stale work from returning after cancellation.
- Freeze four 0.2.0 notebook samples; add actual Chromium lifecycle/restore/cancel/export regressions and build-bound browser evidence.
- Add an independent public-API MoonBit downstream module, checked on JS/wasm-gc and by the official external verifier.


## 0.2.0 · 2026-10-24

- schema 1 增加 `rules`：按目标上下文返回活动假设、可见公理和此前已验证的定理，支持标签/结论搜索、类型码筛选和分页；规则结果不含原证明。
- 增加 `preview`：用同一 MoonBit 执行器在私有副本检查一步，成功或失败均不改变当前栈、动作和额度；合法执行不代表推进目标。
- 增加 `create_goal`：只修改标签与目标，继承已有 `$p` 的声明前缀、活动假设和 `$d`，排除原目标和后续声明；重新解析、验证后返回独立的未完成数据库。
- 浏览器接入规则查找/详情/预览、上下文新目标与三份 CC0 渐进练习。
- 增加 schema 1 工作文件：保存源文本与 SHA-256、目标和成功动作前缀；在隔离内核中重新验证/重放，完成标记须再次通过 finish。限制为 128 MiB、10,000 步；浏览器本机上次保存限 2 MiB，失败导入保留当前工作。
- 当前已确认：55 项核心测试在 JS/wasm-gc 通过，79 项固定外部材料符合预期，11 项保存恢复测试通过，核心与保存恢复独立审查通过；组合脚本完成查规则、新目标、部分恢复、finish/export，导出由官方 C 接受。
- 实际浏览器完成规则预览、新目标、保存/刷新恢复、四类失败导入保留、2MiB回退和10000步恢复取消；宿主39项通过。
- 首次固定10题真实模型补全：模型10/10、有限搜索8/10，全部成功由独立C检查；见docs/AI_RESULTS_2026-10-24.md。
- 本版本公开CI、Mooncakes0.2.0与独立15操作消费者已通过；公网站点的新目标/预览/刷新恢复/下载证明已独立C复核，发行候选/下载记录见PROGRESS。

## 0.1.1 · 2026-10-23

已公开发布；Windows/Linux CI、Mooncakes manifest 和独立注册表消费者两后端均已实际验收。

- 修复入口所在目录不存在、导出父目录不存在等文件系统错误被误报为参数错误的问题；统一为HOST_IO / exit3，保持排他写入和不覆盖现有文件。
- 补充真实失败路径回归，并同步兼容性文档中的历史发布状态。数学检查语义保持0.1.0。

## 0.1.0 · 2026-10-23

首个公开版本。Mooncakes0.1.0构建成功且未撤回，全新注册表消费者在两后端通过；Windows/Linux远端检查与GitHub Pages真实浏览器使用通过。源码、演示及发行包入口见README。

- MoonBit 原生 ASCII Metamath 扫描、声明、作用域与 include 解析；普通/压缩证明共用执行器，检查必要假设次序、同时代换与不交变量条件。
- 按声明次序验证数据库，区分 verified、invalid、incomplete、not_checked，不信任无效或未检查依赖。
- schema 1 JSON dispatcher 与原生结构化 API；支持加载、验证、查询、空栈构造、标签应用、检查、回退、完成、导出、原证明回放及上下文 reset。
- Node 24 CLI；源文件只读，include 限定源根目录，导出不覆盖已有文件；无 npm 运行依赖。
- 浏览器证明实验室：真实库、文件集合上传、目标/活动假设、栈与代换、错误拒绝、回退、完成、普通证明下载；教学 Replay 独立模式，Worker 终止取消。
- 固定工具链与来源清单；47 项核心测试在 JS/wasm-gc 通过，79 项外部材料全部符合预期，独立 mmreference 同组 79 项符合预期。
- demo0/MIU/HOL 分别通过 1/1/151 个证明；peano 为 0 个证明的声明库。实际浏览器完成 demo0 34 步构造，下载文件通过独立官方 C 复核。

0.1.0 的发布边界：完整 set.mm 的容量与性能未交付；原证明 Replay 不导出普通证明；该版本没有实际 LLM 调用、外部用户采用或新数学成果。官方 C 整组外部材料有 7 项已保留分歧，许可有冲突的 peano 文件不分发。详情见 [兼容性](docs/COMPATIBILITY.md) 与 [第三方许可](docs/THIRD_PARTY.md)。
