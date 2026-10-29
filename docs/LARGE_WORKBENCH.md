# 完整 set.mm 工作台

## 0.6 复验

2026-10-29，固定同一完整 set.mm 的 48,097 个证明通过 API 与 CLI 验证，本地与公网实际浏览器均完成目标创建、构造、保存、隔离恢复及导出，下载证明分别由官方 C 接受。定理列表每页最多 100 个 DOM 项，搜索仍覆盖全库。

首次复验的导出阶段因大规模界面显示出现 249.717 秒耗时；定向同条件旧/新核心导出均约 1.5 秒。分页后完整浏览器导出阶段为 1.610 秒，其中等待下载 1.050 秒、文件保存 0.360 秒、截图 0.071 秒。其他阶段与详细条件保留在 artifacts/publication-v06/local-browser-paged。公网相同流程恢复为 22.409 秒、导出为 1.497 秒，导出文件与本地字节一致。以上为本机诊断测量。

## 0.5 历史验收

2026-10-28，固定原完整 set.mm（51,737,997 字节，SHA256 `8c81fab8f2fdbfc62340fa281010957d57d15e0d102149e6d4afe569e5ad2f5e`），验证48,097个证明后，在最后定理young2d的上下文继续工作。

0.4失败的主要原因已定位到长字符串JSON转义：包含换行的字符串在固定标准库中逐字符拼接，产生大量临时字符串。0.5的私有响应writer把字符串按最多4096个UTF-16单元分块，仍由原标准库转义，保护代理对边界；数学执行器、完整sources返回和旧schema不变。

## 已完成的流程

1. 完整上传和验证原库，选择young2d，查询规则并预览wph。
2. 用原young2d表达式创建新目标，完整返回并解析源文本。
3. 在同一完整前缀上下文创建wff ph目标，应用wph、撤回、再应用并finish。
4. 下载约37MB的schema1工作文件，在新Worker中重新验证、重放并确认完成。
5. 恢复后下载约37MB的.mm证明，官方C执行VERIFY PROOF *接受全部证明。

工程构造目标是wff ph；原young2d表达式的创建成功不代表已经为它发现新证明。

## 本地实测

API脚本在Node24、2048MiB old-space、明确100m操作预算下完成；进程峰值RSS为2,263,048KiB，old-space额度不等于总RSS上限。

Chromium156实际浏览器全流程约3.1分钟。加载和验证20.694秒，查询预览1.837秒，原表达式创建26.086秒，构造撤回完成26.726秒，保存1.107秒，独立Worker恢复21.439秒，恢复后导出82.284秒。这些是本次端到端观察，不作为跨机器延迟保证。

## 使用和复现

浏览器选择“一亿次（完整大库）”后上传原set.mm；导入大库工作文件前同样选择该额度。默认一千万操作限制保持不变。大文件通过下载保存，不依赖浏览器本地存储容量。

```sh
node scripts/fetch-performance-data.mjs
node --max-old-space-size=2048 scripts/large-workbench.mjs --out artifacts/large-workbench-new-run
```

实际浏览器重库用例通过环境变量MOONMM_LARGE_WORKBENCH=1显式启用，执行tests/web/large-workbench.spec.mjs中的full-set用例；MOONMETAMATH_BROWSER_OUT指定新输出目录。默认CI只运行轻量预算贯通与普通回归，不自动下载大库。

证据入口：artifacts/v05-large-workbench/api-final/result.json、browser/browser-phases.json、browser/results.json、browser/independent/result.json。公开发布及公网复验最终状态见PROGRESS.md。


## 正式站点与发行验收

v0.5.0发布源码2b46d5f，CI40714461684的双平台和Pages成功。正式站点普通13项浏览器回归及完整大库单项通过，公网全流程约5分钟：加载37.641秒、查询预览3.277秒、原表达式创建46.349秒、构造完成47.464秒、保存1.558秒、新Worker恢复39.490秒、导出118.515秒。下载证明由官方C验证有效，工作文件与证明均与本地通过验收的示例字节一致。

Release附large-workbench-example.zip；已实际下载、比对压缩包及内部文件。解压后在在线实验室选择一亿操作预算，再导入large-work.json，可重放恢复完成状态。普通程序包另已完成下载、哈希、无编译器运行验收。详细汇总artifacts/publication-v05.json。
