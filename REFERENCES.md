# 参考资源、固定版本与调研证据

核实日期：2026-10-23。仓库版本优先通过 GitHub commit API / `git ls-remote` 核实；本轮没有克隆、编译或运行这些参考实现。下列“支持”指文档与源码证据，不是本机复现结果。

## 1. 必须阅读：规范与实现

| ID | 来源与固定版本 | 用途 | 许可与边界 |
|---|---|---|---|
| R1 | [Metamath 官网](https://us.metamath.org/)、[书源码](https://github.com/metamath/metamath-book/tree/a54c715930739fd11589595c310823ec5eb57eee) | 语言与证明规则、普通/压缩证明、必要假设、不交变量；书第 4 章的形式规范为准，实际版本目录核对节号 | 书仓库 CC0；记录所读章节/文件，不只阅读教程 |
| R2 | [mmverify.py](https://github.com/david-a-wheeler/mmverify.py/tree/63a2aa3815cd5bf67892dbfc7f2048cbb177524c)，[核心](https://github.com/david-a-wheeler/mmverify.py/blob/63a2aa3815cd5bf67892dbfc7f2048cbb177524c/mmverify.py) | 主要移植参考：tokens、作用域帧、代换、栈、压缩解码；当前核心约 709 行 | MIT。保留版权、许可、参考范围和有意偏离。其同作用域 `$f` 在 `$e` 后的限制不能当作规范 |
| R3 | [metamath-exe](https://github.com/metamath/metamath-exe/tree/9898f5d1bb27045d764dd01672862a1c2a3b4f5e) | 官方 C 独立检查、参考错误与适用语义测试 | GPL-2.0-or-later（固定版本 README.TXT）；独立工具调用，逐文件记录测试许可；不把 C 代码直接并入 MIT 项目 |
| R4 | [metamath-knife](https://github.com/metamath/metamath-knife/tree/76fc9f7f39f46f4c43499a0c2bd1402eb8b1cf9a) | Rust 独立检查、性能与真实库对照 | MIT OR Apache-2.0；普通/压缩之外还支持更多表示，不能因此推导本项目兼容全部表示 |

固定 SHA 为本轮读取到的参考快照。执行者下载前复核来源与许可证，使用这些 SHA；不静默跟随 HEAD。网络获取失败保留失败，不换不明镜像。

规范精确阅读入口：[语言规范](https://github.com/metamath/metamath-book/blob/a54c715930739fd11589595c310823ec5eb57eee/metamath.tex#L8829)、[证明规则](https://github.com/metamath/metamath-book/blob/a54c715930739fd11589595c310823ec5eb57eee/metamath.tex#L9032)、[压缩证明附录](https://github.com/metamath/metamath-book/blob/a54c715930739fd11589595c310823ec5eb57eee/metamath.tex#L13893)、[EBNF](https://github.com/metamath/metamath-book/blob/a54c715930739fd11589595c310823ec5eb57eee/metamath.tex#L15453)。PDF方便阅读，版本依据仍为固定源码。

## 2. 外部测试与数据库

| ID | 来源与固定版本 | 应如何使用 |
|---|---|---|
| R5 | [metamath-test](https://github.com/david-a-wheeler/metamath-test/tree/5758bf781bab662d4b31c7f72ac4dedea74fcb0f) | 正反例和多检查器驱动；仓库 MIT，很多单测试 CC0，按文件保留来源。读取 `run-testsuite`，不要仅按文件名猜期望 |
| R6 | [mm-verifier-tests](https://github.com/LegionMammal978/mm-verifier-tests/tree/9b4165b8c9ac7a27c18dcf836c42979ca4b7a67f) | 语义边界测试；CC0。`verify-tests` 标记 should verify / should error；`unknown-tests` 标记 should warn。可参考 `mmreference.py` 作另一项对照 |
| R7 | [官方数据库集合](https://github.com/metamath/set.mm/tree/b4c3130f3b8081e1e4a33b47321141359e3380ae) | 固定 `.mm` 外部材料；仓库 CC0，逐文件保留头部和来源。不能将 `$p` 改 `$a` 以“修复”验证 |
| R8 | [官方 C 测试](https://github.com/metamath/metamath-exe/tree/9898f5d1bb27045d764dd01672862a1c2a3b4f5e/tests) | 包含终端 `.in/.expected`；只适配与语言/证明语义有关的案例，不把显示、排版命令全搬进 core |

R7 必测：`demo0.mm`、`miu.mm`、`peano.mm`、`hol.mm`；后续争取 `ql.mm`、`nf.mm`、`big-unifier.mm` 和完整 `set.mm`。10/21 的文件元数据约为 demo0 2.3 KB、miu 5.6 KB、peano 28 KB、hol 97 KB、set 51.7 MB；**不能当作 10/23 固定提交的精确大小或性能数据**，下载时记录真实字节数及版本。

下载方式只在未来实现阶段使用，例如对小型实现仓库取得固定提交；参考仓库放新项目 `.references/`，不放父项目。R7优先按固定commit取得必需的四个小库和LICENSE，不为了十月目标clone整个set.mm历史或自动下载全库。小型测试材料可按许可证进入 `tests/fixtures/upstream/`；大数据库与编译工具放忽略目录。新项目维护 `references.lock.json` 记录 repo、SHA、license、文件、用途与实际取得状态。

**已发现的陷阱：**

1. R2 历史限制：同作用域 `$f` 应在 `$e` 前，而规范允许更一般声明顺序。按规范测试必要假设顺序，不能机械照搬。
2. R8 的 `disjoint1.expected` 中，错误诊断与泛化成功总结可以同时出现。官方工具 `READ` 本身也不等于 proof verification。对照驱动必须实际发出 `VERIFY PROOF *`，识别报错及完成状态，不能 grep 一句 verified。
3. R5 README 对官方测试能力的历史描述不是当前官方仓库的实时事实；以固定样例的具体预期为准。
4. `?` 未完成证明、超限、取消、未检查不能映射成通过；同样不等于被证明的数学命题为假。
5. 对照检查器分歧时定位到规范和最小例，不以多数票当数学证明。

## 3. AI4Math 与产品参考：用于任务/接口理解

| ID | 来源 | 可以支持什么 | 不能据此声称什么 |
|---|---|---|---|
| R9 | [GPT-f 原始研究](https://arxiv.org/abs/2009.03393)、[作者说明](https://openai.com/index/generative-language-modeling-for-automated-theorem-proving/) | Metamath 是真实 AI 定理证明环境，存在被主库采用的生成证明先例 | 我们的 MoonBit 库已被使用、证明能力优于别的语言 |
| R10 | [Evariste Metamath 环境](https://github.com/facebookresearch/Evariste/blob/main/formal/evariste/backward/env/metamath/env.py)、[README](https://github.com/facebookresearch/Evariste) | 理解 goal + label + substitutions → 子目标/错误的逆向接口 | 不能把十月前向栈 API 宣称为等价逆向 tactic 环境；该仓库大量代码 CC-BY-NC，不纳入本 MIT 移植代码 |
| R11 | [Holophrasm](https://github.com/dwhalen/holophrasm/blob/master/README) | 搜索结果导出 `.mm`，用独立检查器验证；其自身也提醒过不交变量缺陷 | 单纯实现 verifier 就拥有前提选择、统一或自动证明器 |
| R12 | [Metamath-lamp](https://github.com/expln/metamath-lamp)、[使用指南](https://github.com/metamath/lamp-guide) | 已有浏览器交互证明工具和教学工作流；供产品比较 | 我们首创网页证明或已有用户将自动迁移 |
| R13 | [官方 Wasm 运行页](https://metamath-exe.metamath.org/main/run/)、[官方 README](https://github.com/metamath/metamath-exe/blob/9898f5d1bb27045d764dd01672862a1c2a3b4f5e/README.TXT) | 官方已有上传本地文件与 Wasm 验证 | 免安装/本地计算是独有创新；无需实测即可更快、更省内存 |

本轮只阅读公开材料，**没有联系用户或取得试用承诺**。外部人群是需求假设；首个真实接入仍是待完成任务。

## 4. MoonBit 内排重

- 2026-10-23：`https://mooncakes.io/api/v0/modules` 返回 **3231** 条元数据，name/description/keywords 对 `metamath|mmverify|metamath.?zero` 匹配为 0。
- 同日：GitHub `metamath language:MoonBit`、`mmverify moonbit` 仓库搜索未见直接实现；`gh search code metamath --language MoonBit --limit 20 --json repository,path` 返回空数组。
- 已比较：[HOL Light](https://github.com/bobzhang/hol-light.mbt)、[Stella](https://github.com/Luna-Flow/stella)、[moon prove 示例](https://github.com/moonbitlang-community/moonbit-proof)、[LRAT](https://github.com/clbbbb/lrat-check)。它们与 `.mm` 普通/压缩证明并非同一格式和能力。
- 新鲜度限制：元数据不完整、未索引、私有或进行中的项目可能漏检。执行开始与公开申报前刷新；无实质变化时不反复刷检索。
- 旧 `/api-new/v0/modules` 本轮返回 404。**请求成功、响应确为合理数量数组后才可作排重**；异常/空体不能算“0 个包”。

历史选题撤回：`CAIMEOX/symbit` 已有实根隔离、计数与 Sturm 接口，因此不能再申报“MoonBit 里尚无实根分析”；全球同类不构成 Metamath 方案否决条件。本方案只以 MoonBit 直接重合为首要排查对象。

## 5. 赛事来源及申报边界

- [2026 黑客松官网](https://moonbitlang.github.io/Hackathon2026/)：本轮刷新仍为 10/31 报名与验收；十月最多三次，150 + 350 支持；月度与长期评选区分。
- [官网源码](https://github.com/moonbitlang/Hackathon2026/blob/main/src/App.tsx)：此前查到明确写 10/31；没有把预览提示当正式批准邮件。
- [飞书章程](https://bxup9uklfcb.feishu.cn/wiki/Dx4Bwd6D1i3GfHkajQCcF7SznEd)：此前读取到三场景、10 有效提交、人工一页申报、CI、Mooncakes；仍有 10/24/九月旧日期，冲突待官方执行通知确认。

官网/章程/官方邮件属于不同证据；用户此前被拒的邮件证明旧项目初审未过，不证明 Metamath 新项目已通过。10 月 31 日排期与奖励均是条件目标。

## 6. 本机工具链参考

只读参考：`D:\Study_Works\MoonBit\moonportcheck\scripts\toolchain.lock.json` 与同目录 `toolchain.ps1`、`toolchain.mjs`。这些文件属于已有 Apache-2.0 项目，若复制片段应保留归属并剥离旧项目专属命名。不要照搬旧项目的业务、验收计数或安装成功结论。

已核实 Windows 隔离版本：compiler `v0.10.14+7d59c7ec9`，moon `0.1.20260920`，core `0.10.14+7d59c7ec9`；Node 24。

固定官方归档（新项目独立安装时再使用）：

| 内容 | URL | SHA-256 |
|---|---|---|
| Windows x86_64 工具 | `https://cli.moonbitlang.com/binaries/0.10.14%2B7d59c7ec9/moonbit-windows-x86_64.zip` | `faae225a8287d0ce69e44b5b3f754af988e97f4446056d8f32ceb3ddb998fce7` |
| Windows core | `https://cli.moonbitlang.com/cores/core-0.10.14%2B7d59c7ec9.zip` | `63e5b99991ac8fd49556b1e17bdcbdc662d797000250dd11ef090f38a2175e84` |
| Linux x86_64 工具 | `https://cli.moonbitlang.com/binaries/0.10.14%2B7d59c7ec9/moonbit-linux-x86_64.tar.gz` | `9226694de9ff978db1ecf820b7710c4224e84ec7a76b19a222d96f0cd4e31b6a` |
| Linux core | `https://cli.moonbitlang.com/cores/core-0.10.14%2B7d59c7ec9.tar.gz` | `6f18b8fdea18f85e628a75e4a1bd3977c5a5c9c6a836fd8824192b0e6bd91b14` |

以上哈希来自已读旧项目锁文件；本轮只核对现存 Windows 可执行版本，未重新下载验证归档。未来安装必须实测哈希；若无法取得，报告具体依赖，不回退未固定 latest。
