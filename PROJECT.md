# MoonMetamath 项目说明

更新：2026-10-23。版本0.1.0；本地产品验收G0–G4通过，公开发布G5正在执行。实时结果见[PROGRESS.md](PROGRESS.md)。

## 目标与授权

MoonBit原生Metamath `.mm`验证与逐步证明执行库，附Node CLI和浏览器实验室。面向需要可嵌入检查器的MoonBit开发者、学习形式证明的使用者，以及把外部证明动作接到确定性检查器的AI4Math工程。本项目尚无真实外部用户验证，也没有模型调用或新数学成果。

用户2026-10-23明确将原“只做文档、交Claude Code”改为“Codex在独立目录全自动实现、发布、验收，不重复确认”。最新授权包括本项目必要依赖、本地Git、公开仓库、CI、Mooncakes及静态站发布。禁止删除、破坏其他项目、伪造用户反馈或赛事回执。独立Git顶层就是本目录，父目录MoonFlowGraph不是本仓库。

## 阅读顺序

- [README.md](README.md)：产品与实际使用方法。
- [PROGRESS.md](PROGRESS.md)：当前事实、证据及剩余工作。
- [docs/API.md](docs/API.md)：实际公开接口、资源与错误语义。
- [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md)、[docs/THIRD_PARTY.md](docs/THIRD_PARTY.md)：兼容与许可边界。
- [DESIGN_AND_SCOPE.md](DESIGN_AND_SCOPE.md)、[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)、[ACCEPTANCE.md](ACCEPTANCE.md)：原规格、任务和验收设计；实际布局以本文件/API为准。
- [REFERENCES.md](REFERENCES.md)：固定来源、规范和生态排重证据。
- [notes/PROJECT_REUSE.md](notes/PROJECT_REUSE.md)：模块复用和提示词来源。

## 实际结构与数据流

| 路径 | 职责 |
|---|---|
| src/core/types.mbt、lexer.mbt、parser.mbt | ASCII词法、声明、作用域与include展开 |
| src/core/proof.mbt等 | 普通/压缩证明的统一执行、代换与不交变量约束 |
| src/core/session.mbt、export.mbt | 原声明上下文的构造、原子失败、回退、完成与自足导出 |
| src/core/dispatch.mbt、根api.mbt | schema 1严格JSON协议、opaque句柄与根公共入口 |
| src/js_bridge | 同一核心的薄桥接，不复制数学语义 |
| bin/host.mjs、moonmetamath.mjs | 受限源文件解析、Node Worker CLI和退出码 |
| web | 独立Worker、构造/回放两模式、真实上传/取消/下载 |
| scripts | 固定工具链、编译、fixtures、独立oracle、检查、消费者、演示、打包、验收 |
| tests/fixtures/manifest.json | 固定上游版本、字节哈希、预期状态与逐文件许可 |
| artifacts（忽略） | 实际运行输出、失败记录、下载、审阅和发布证据 |

原计划的core/wire纯组织拆分合并到单一core包，避免公开内部可变结构；根包仅导出dispatch_json。数学判断全部在MoonBit进行，参考Python和C仅参与开发验收。

## 不可放宽的正确性

加载不等于验证。未验证、目标自身和未来定理不可作为可信前提；合法活动假设与公理可用。普通、压缩与交互共用执行器，处理声明顺序、同时代换、合法空代换、类型码、作用域与不交变量约束。

错误步骤不改变会话。最终栈恰好一项且等于目标才完成。未完成、超限与取消不能返回Valid。首版只导出完成的普通ApplyLabel构造会话；原压缩证明回放只读。网页取消实际terminate Worker，重新加载才能恢复新句柄。

原生数据内部字段私有化；验证不保存事件，交互/回放的累计事件令牌预算受限。CLI Worker设置512MiB old-generation heap和默认120秒截止，不承诺该值等于进程总内存上限。

## 运行与验收

Node24，固定compiler v0.10.14+7d59c7ec9、moon0.1.20260920。构建脚本支持Windows x64/Linux x64；不修改全局工具链。源码首次执行：

```sh
node scripts/toolchain.mjs install
node scripts/fixtures.mjs fetch --profile october
node scripts/build.mjs
node scripts/check.mjs
node scripts/consumer.mjs
node scripts/demo.mjs --oracle
node scripts/serve.mjs --port 4173
```

run_check、run_demo、run_acceptance同时提供.ps1/.sh。完整本地验收需真实浏览器receipt，不能仅创建空文件：

```sh
node scripts/acceptance.mjs --phase local
node scripts/acceptance.mjs --phase publication --receipt artifacts/publication.json
```

本地验收记录artifacts/acceptance-release/result.json。47项MoonBit测试在JS/wasm-gc通过，79外部样例与mmreference匹配；官方C四个真实数据库及浏览器下载候选通过，完整边界集有7项已解释差异。peano是120声明、0证明，不宣传为算术证明结果。完整set.mm和Mac/ARM未验证。

## 长期方向与赛事边界

优先维护格式兼容、真实下游接入、可复现性能基线，再考虑模型适配器与增量验证。先拿实际采用证据，不做通用Agent平台。图论平台与GraphTea重叠、实根方向已有Symbit，因此未采用；10/23生态排重未发现直接MoonBit Metamath实现，不能证明私有或未索引项目不存在。

G5只由真实远端CI、注册表发布及干净消费者通过确认；G6报名、初审、验收、奖金须分别有主办方回执。官网10/31与旧章程日期不一致仍需保留。技术发布不保证获奖，AI起草材料不冒称人工撰写。
