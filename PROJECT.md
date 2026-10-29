# MoonMetamath 开发说明

MoonBit 原生 Metamath 验证与逐步证明执行库。JSON API 面向 agent 和程序，CLI 负责文件与批次操作，Web 工作台供查看、调试和手动操作。产品入口见 [README](README.md)，模块复用记录见 [notes/PROJECT_REUSE.md](notes/PROJECT_REUSE.md)。

## 代码与数据流

| 模块 | 职责 |
| --- | --- |
| src/core/lexer、parser、environment | 源集合、ASCII 输入、include、声明与作用域 |
| proof_step、substitution、compressed、verifier | 普通、压缩、交互共用的证明执行与检查 |
| session、rules、goal、export | 会话、规则、目标与导出 |
| dispatch、根 api.mbt | schema 1 协议、独立 Engine 与公共入口 |
| bin | 文件读取、文件命令、JSONL stdio Worker、动作校验及失败上下文 |
| web | Worker、工作台视图、保存与恢复 |
| scripts | 工具链、构建、检查、独立对照及打包 |
| tests | 宿主和浏览器回归、固定外部样例 |
| artifacts | 忽略的运行记录与临时复现材料 |

本目录为独立 Git 仓库；父目录 MoonFlowGraph 及相邻项目各自维护。

## 核心约定

加载只解析声明；验证后才允许已验证定理成为依赖。目标自身、未来定理与非活动假设不可作为前提。普通、压缩和交互路径共用执行器，检查必要假设顺序、同时代换、类型码和不交变量约束。

失败步骤保持会话状态。预览复制会话与预算，完成要求最终栈恰有一项且逐 token 等于目标。保存文件包含源和动作，恢复时重新解析、验证、重放。构造和回放有独立展示状态。

schema 1 旧操作保持兼容；摘要查询不返回原证明。数据库与会话属于其 Engine，调用者负责关闭会话和卸载数据库。资源参数及错误约定集中在 [API](docs/API.md) 与 [兼容性](docs/COMPATIBILITY.md)。

## 开发环境

Node.js 24；compiler v0.10.14+7d59c7ec9、moon 0.1.20260920，来源见 scripts/toolchain.lock.json。使用项目安装器或 MOONMETAMATH_TOOLCHAIN_HOME 指定的隔离环境。

```sh
node scripts/toolchain.mjs install
node scripts/fixtures.mjs fetch --profile october
node scripts/build.mjs
node scripts/check.mjs
node scripts/consumer.mjs
node scripts/agent-smoke.mjs
node examples/agent-client.mjs
npm ci
npx playwright install chromium
node scripts/browser-check.mjs
node scripts/package.mjs
```

外部样例准备需要网络。独立官方 C 检查器在 Windows 使用 MSVC x86、Linux 使用 gcc；Python 用于参考检查和制品脚本。运行产品不依赖参考检查器。

run_check.sh/.ps1、run_foundation.sh/.ps1 沿用上述脚本。验收覆盖核心 JS 与 wasm-gc、宿主、固定外部样例和相关浏览器流程。发行包另检查实际解压后的 CLI 与本地文档链接。

## 历史与当前工作

版本发布与历史验收见 [PROGRESS](PROGRESS.md)、[CHANGELOG](CHANGELOG.md)。0.4 性能和 0.5 大库工作台记录分别在 [性能报告](docs/PERFORMANCE.md) 和 [大库记录](docs/LARGE_WORKBENCH.md)，保留当时条件及失败。

原设计、实施计划和启动提示词作为历史材料保留；当前开发以本说明、API 和实际代码为准。2026-10-29 重构范围来自用户对代码质量审查的批准，记录位于 artifacts/refactor-20261029。本地修改与正式发布分别记录。
