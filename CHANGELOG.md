# Changelog

## 0.1.0 · 2026-10-23

首个可运行版本。以下为本地实现与验收结果；公开发布、CI、Mooncakes 注册表安装与发布地址由发布流程补充，不由版本号推定完成。

- MoonBit 原生 ASCII Metamath 扫描、声明、作用域与 include 解析；普通/压缩证明共用执行器，检查必要假设次序、同时代换与不交变量条件。
- 按声明次序验证数据库，区分 verified、invalid、incomplete、not_checked，不信任无效或未检查依赖。
- schema 1 JSON dispatcher 与原生结构化 API；支持加载、验证、查询、空栈构造、标签应用、检查、回退、完成、导出、原证明回放及上下文 reset。
- Node 24 CLI；源文件只读，include 限定源根目录，导出不覆盖已有文件；无 npm 运行依赖。
- 浏览器证明实验室：真实库、文件集合上传、目标/活动假设、栈与代换、错误拒绝、回退、完成、普通证明下载；教学 Replay 独立模式，Worker 终止取消。
- 固定工具链与来源清单；47 项核心测试在 JS/wasm-gc 通过，79 项外部材料全部符合预期，独立 mmreference 同组 79 项符合预期。
- demo0/MIU/HOL 分别通过 1/1/151 个证明；peano 为 0 个证明的声明库。实际浏览器完成 demo0 34 步构造，下载文件通过独立官方 C 复核。

当前边界：完整 set.mm 的容量与性能未交付；原证明 Replay 不导出普通证明；没有实际 LLM 调用、外部用户采用或新数学成果。官方 C 整组外部材料有 7 项已保留分歧，许可有冲突的 peano 文件不分发。详情见 [兼容性](docs/COMPATIBILITY.md) 与 [第三方许可](docs/THIRD_PARTY.md)。
