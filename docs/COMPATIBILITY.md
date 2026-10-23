# 兼容性与已测范围

构建制品说明：固定0.10.14工具链在Windows/Linux生成的JavaScript仅有数值指数拼写差异（例如`1e+012`与`1e+12`），原始哈希不能跨构建平台直接比较。公网验收下载同一精确源码CI的实际Linux Pages制品并逐字节核对；Node发行ZIP单独按SHA256SUMS验证，不把两种产物混作同一个文件。`acceptance --phase publication --ref v0.1.0`可选择已发布标签，默认仍检验HEAD；该复核需要对应CI的Pages制品仍可下载，长期记录同时附在Release资源哈希文件中。

公开稳定版为 `AlexenderSokolov/moonmetamath` 0.1.1；其数学语义与 0.1.0 一致，修复源目录和导出目的路径的 IO 分类。当前源码为 0.2.0 候选版，增加上下文规则查询、原子预览、新目标和保存恢复，尚未完成 0.2 公开发布验收。CLI 使用 Node 24，网页使用 Web Worker 内 MoonBit 生成的 JavaScript。核心 JS 与 wasm-gc 两后端均已运行测试，网页没有把 WebAssembly 作为实际演示路径。

## 输入与证明

- 标准 ASCII profile：可打印 ASCII，以及 space、tab、CR、LF、form-feed。BOM、非 ASCII、其他控制字符明确拒绝。
- 支持常量、变量、活动 `$f/$e`、`${/$}` 作用域、`$d`、公理、定理、普通标签证明与压缩证明。
- 必要假设遵守原声明次序；同时代换允许合法空表达式；检查类型、essential hypothesis、不交变量条件、自引用与未来引用。
- include 为源集合内的确定性解析；相对包含文件目录解析路径，同一规范化文件只包含第一次。源文件各自须具有完整语法边界。
- `?` 明确记为 incomplete。解析成功或 list 成功不把未检查 `$p` 变成可信依赖。
- 可重做现有定理，也可在已有 `$p` 的上下文中创建新目标，完整继承活动假设及 `$d`。新目标只编辑已有符号组成的表达式与新标签；不支持自由新增声明或公理。
- 规则检索只返回当前目标可用的活动假设、可见公理和此前已验证定理，支持标签/结论子串与精确类型码筛选；不包含原目标或未来标签。预览只证明一步合法，不能据此判断目标可证或获得进展。
- 暂不提供逆向 tactic、自动证明搜索或通用模型搜索；独立小型AI实验已真实执行固定10题，模型10/10、有限搜索8/10，见[实际结果](AI_RESULTS_2026-10-24.md)；不构成通用搜索或新数学成果声明。
- 普通构造会话完成后可导出自足普通 `.mm`。压缩导出、原证明 replay 转普通证明未交付。

## 真实验收

2026-10-23 本地结果：

| 输入/检查 | 已确认结果 |
| --- | --- |
| 0.2 MoonBit 核心测试 | 55 项，在 JS 和 wasm-gc 通过 |
| 0.2 保存恢复 | 11 项针对性测试通过；核心/保存恢复独立审查通过 |
| 0.2 组合脚本 | 实际查规则、预览、新目标、部分恢复、finish/export 通过，导出文件获官方 C 接受 |
| 固定外部测试 profile | 79/79 符合原始预期：22 valid、55 invalid、2 incomplete |
| mmreference 独立检查 | 79/79 符合相同上游预期 |
| demo0.mm | 1 个证明 verified |
| miu.mm | 1 个证明 verified |
| hol.mm | 151 个证明 verified |
| peano.mm | 合法声明库；0 个 `$p`，没有证明验证量 |
| 0.1.x 实际浏览器 demo0 | 34 步手动构造，未知标签原子拒绝、撤回、finish 和下载通过 |
| 0.1.x 浏览器实际下载文件 | `browser-th1.mm` 被独立官方 C 的 `VERIFY PROOF *` 接受 |

旧版浏览器下载复核的本地记录位于 `artifacts/browser/downloaded-proof-c/result.json`，保存文件和检查器哈希、实际命令及原始输出。0.2 组合脚本可用 `node scripts/workbench-demo.mjs --oracle` 重现；它验证宿主/核心组合；0.2新界面也已完成真实浏览器验收，记录artifacts/browser-v02/receipt.json。完整开发检查由 `node scripts/check.mjs` 复现。生成 artifacts 不属于包的运行依赖。

这套外部材料包括 mm-verifier-tests 的 58 个语义用例和 2 个 unknown 用例、4 个官方小库，以及 metamath-test 中选取的 15 项；延期的 6 项大型/增强库在 manifest.exclusions 中逐项列出。当前不声称完整 set.mm 的容量、性能及全部历史扩展兼容，也不声称验证了本实现自身。

## 官方 C 的已知分歧

固定官方 C 对 79 项为 **72 项符合预期、7 项分歧**。保留原始预期，没有把异常改写成通过：

| 用例 | C 的实际行为与上游预期 |
| --- | --- |
| test015、test045 | self include 触发上游 BUG1765，参考工具错误 |
| test022、test041、test043 | C 允许变量在后续作用域使用不同 typecode 的 `$f`；测试预期 invalid |
| test050、test054 | C 拒绝对 hypothesis/local step 的 `Z` 保存；测试预期 valid |

MoonMetamath 与固定 mmreference 在这套材料上符合上游预期。上述分歧须依据规范和最小输入理解，不能以 C 的多数结果代替语义判定。独立 C 接受实际浏览器导出文件，是单独确认的结果。

## 默认资源额度

| schema 字段 | 默认值 |
| --- | --- |
| `max_file_bytes` | 67,108,864（64 MiB） |
| `max_total_bytes` | 134,217,728（128 MiB） |
| `max_include_depth` | 32 |
| `max_tokens` | 10,000,000 |
| `max_operations` | 10,000,000 |
| `max_stack_items` | 100,000 |
| `max_expression_tokens` | 1,000,000 |

这些是执行护栏，不是已测吞吐或容量承诺。字段取非负整数；溢出与超限不标 valid。Node 源解析宿主另限制最多 1000 个文件，只读允许 root 内文件；CLI Worker 默认 120000 ms 截止及 512 MiB old-generation heap 限制，`--timeout-ms` 可设为 1..300000，超时或 SIGINT 会终止 Worker 并返回退出码 5。Web 只读用户选择的文件集合；普通多文件选择使用文件名，复杂嵌套目录需保持相应逻辑路径。

规则分页默认每页 20 条，上限 100 条，offset 非负，limit 可为 0。工作文件另限 128 MiB、10,000 个成功动作；点击保存时，本机浏览器只保留至多 2 MiB 的上次保存，超出时仍可下载文件但不覆盖本机保存。

网页显示实际阶段与已确认步骤，没有虚构百分比。取消终止活动及恢复 Worker，原内部句柄不能继续使用；可重新加载或在新 Worker 中恢复此前保存的工作。恢复检查源哈希、重新解析验证并重放动作，失败不替换当前工作。哈希和 completed 标记不是证明判定，不接受持久化栈或句柄。`reset` 释放同一 dispatcher 实例所有上下文。

## 环境与发布状态

工具链安装脚本支持 Windows x64、Linux x64，固定 compiler v0.10.14+7d59c7ec9、moon 0.1.20260920 与匹配 core。当前实际本地验收环境为 Windows；其他环境是否完成验收以发布/CI记录为准。额外 wasm 标准库 bundle 供工具接口生成，不表示新增产品后端支持。

产品无 npm、Python 或 C 运行依赖。重新取得参考测试材料和编译官方 C 时需要网络及编译器；Windows 使用 MSVC x86，Linux 脚本使用 gcc。Windows 上游 C 的 long/指针表示不适合本次 Win64 构建，已保留失败记录并改用未修改源码的 x86 构建。

0.1.1 的公开发布、双平台 CI、注册表消费者两后端与公网站点已实际验收；0.2 的本地核心与组合工作流通过，新界面浏览器验收已完成，公开CI/注册表/发行包正在验收。进一步状态统一见 [PROGRESS.md](../PROGRESS.md)。没有外部用户采用或新数学成果证据，AI 实验也须按真实执行结果另行报告，不能借版本升级自动改写。
