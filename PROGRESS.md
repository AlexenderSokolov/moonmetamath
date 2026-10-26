# MoonMetamath 当前进度

更新：2026-10-26。0.3.0第一阶段长期使用基础、独立下游、发布与验收全部完成；没有活动后台任务。

## 0.3.0 已交付

用户本轮批准“第一阶段长期使用基础+独立下游示例”，包含测试、独立审查、发布与验收，全自动执行；不扩平台。规格与计划见docs/superpowers/specs/2026-10-26-long-term-foundation.md及对应plans。实现来源为v0.3.0/e99a812944b59802ecb90ce8284750947c13e3ec，原0.1/0.2标签保持不变。

- 核心：独立Engine/new_engine/dispatch_engine、JS create_dispatcher、close_session/unload_database、不可变来源已验证依据保留、资源错误outcome归类。旧schema1/dispatch_json/src/core接口保留。
- 网页：目标/新目标/上传/恢复的候选资源成功后才接管，失败保留当前证明，成功回收旧资源；取消与迟到结果隔离，真实Worker故障保持可见。
- 兼容与下游：四份由0.2.0原版writer生成的工作文件持续恢复；examples/downstream只导入根API，在workspace及registry安装下的JS/wasm-gc运行80次会话复用与实际证明导出，全部独立C有效。示例不构成外部采用证据。
- 验证：61核心测试/后端、47宿主、79外部样例、79独立参考对照、4官方小库、12本地Chromium流程通过。完整本地G0–G4为artifacts/v03-acceptance-local/result.json PASS；源码/宿主/整分支独立review PASS，无未解决发现。
- 发布：Mooncakes0.3.0 build_status=success/has_package=true/yanked=false；正式Release及Pages已发布。CI40271500241的Windows/Linux与Pages均success，Pages部署的是受测Linux制品。旧15操作registry消费者及新独立下游均通过。
- 公网：G5 artifacts/v03-publication-final/result.json PASS；12项公共资源与上述成功CI实际制品逐字节一致；公网12项Chromium流程和下载证明独立C均通过，见artifacts/v03-public-browser/receipt.json。
- 发行包：实际下载、SHA256一致，解压后不依赖MoonBit/Python/C运行CLI，HOL151证明通过，JS实例隔离与下游文件包含检查通过。archive SHA256为30efd2334e6f69ae99c2eec52ccced7f80b992024cf0fb143c912cbb2401a784；证据artifacts/release-v03/download-7sUGrL/result.json。Release附release-manifest.json、local/publication/download-verification及SHA256SUMS，保留源码/工具链/制品/验收摘要。

发布入口：https://github.com/AlexenderSokolov/moonmetamath/releases/tag/v0.3.0 ；在线：https://alexendersokolov.github.io/moonmetamath/web/ 。汇总artifacts/publication-v03.json；复用说明notes/PROJECT_REUSE.md。

本轮失败保留：生命周期/资源分类的核心红测、客户端和UI红测、浏览器receipt负对照、Worker故障提示回归红测。两个审查问题已关闭：Worker错误提示以及历史ref文档矛盾。没有新增模型调用、训练、完整set.mm性能或外部采用结论；Firefox/WebKit、Mac/ARM不在本轮验证范围。临时浏览器服务器随测试结束退出，无持久监控。责任根执行者已完成全部约定目标，后续阶段不自动启动。

## 0.2及更早版本历史

更新2026-10-24。唯一进度入口；历史规划不覆盖本页当前事实。

## 当前新一轮：0.1.1 → 0.2 → 真实AI补全

用户已明确批准全部路线、发布与验收，无需重复确认。实现计划见docs/superpowers/plans/2026-10-23-v02-and-ai.md，恢复ledger为.superpowers/sdd/v02-ai/progress.md。

- 0.1.1：已公开发布，源码3ef0942、CI39978600841成功，Mooncakes0.1.1成功、六步registry消费者KzMScJ两后端成功，GitHub发行ZIP下载再运行HOL151通过；证据artifacts/v011/result.json。
- 0.2：规则查询/原子预览/上下文新目标、保存恢复和三个练习已实现；55核心两后端、39宿主、79样例、15操作独立消费者两后端通过。实际浏览器含四种坏导入保留、2.2MiB回退、10000步取消、刷新恢复、新目标导出官方C有效；artifacts/v02-acceptance-local/result.json为PASS。组件及整分支独立审阅全部PASS；CI39986871533、Mooncakes0.2.0构建、registry消费者vAhhzH的15操作双后端均通过。公网站点再次新建public-swap并保存、刷新恢复、完成下载，artifacts/browser-v02/public-independent-c/result.json为valid。正式发行资产和最终提交以v0.2.0 Release/发布receipt为准。
- AI：真实固定10题实验已完成，实际10次模型调用，模型10/10、有限BFS8/10，所有成功均独立C有效；模型无无效动作/超时，用量203344输入、1110输出，费用unknown。运行器8227909，artifacts/ai-2026-10-23保存开始于23日完成于24日原始记录；公开审查包artifacts/ai-public-final-2026-10-24.zip，报告docs/AI_RESULTS_2026-10-24.md。两个旧环境凭据401未用于实验，采用官方Codex现有ChatGPT登录、禁工具、最小临时目录，无原证明/源码/基线答案输入。
- 三阶段已全部完成：0.1.1和0.2.0正式Release均已发布，程序ZIP与AI实验ZIP已从GitHub下载并核对哈希、解压运行通过。0.2发布源码97190c31f48c031600d9e5d24cc89851d8c768be，对应双平台及Pages CI39987977412成功。artifacts/v02-publication-complete/result.json为G5 PASS，11个公网文件与该CI Linux制品逐字节匹配；artifacts/publication-v02.json汇总。临时本地服务器已停止，任务结束，不启动新研究、监控或平台工作。

最终验收保留一次GitHub制品TLS超时和并行Node获取失败，随后仅重试下载/采用串行本机TLS客户端恢复成功，没有重复模型实验。缺失用量P2已修复并独立复核；完整分支审阅规格/质量/实验完整性全部PASS。窄390px及浏览器拒绝/满存储未现场执行，未冒称通过。最后这次仅补已发生的收尾记录，不改变运行代码或v0.2.0标签。

以下为0.1.0已完成历史记录：

## 当前目标与授权

用户明确授权Codex独立实现、发布和验收，后续再次确认网站访问自动推进，无需重复询问。仓库独立位于D:/Study_Works/MoonBit/moonmetamath，正式分支main，开发历史codex/metamath-v0.1保留；原Claude启动方案已被取代。

## 已完成与证据

| 单元 | 实际状态及证据 |
|---|---|
| T0–T7核心 | 原生扫描/声明/作用域/include、普通/压缩统一执行、会话回退导出已实现；47测试两后端通过 |
| T8 CLI | 真正文件/动作/导出；512MiB Worker、超时/取消；动作文件精确校验，14项宿主测试通过 |
| T9浏览器 | demo0构造34步、独立下载C检查、MIU1/HOL151、错误原子性、回退、include上传、BOM拒绝、取消重载实际通过 |
| T10消费者/CI | 全新workspace及registry消费者在JS/wasm-gc实际通过；Windows/Linux远端全部验证通过 |
| T11场景 | 学习回放、程序化构造与导出、真实库批量验证三场景实际运行；没有模型调用/外部人类用户 |
| T12发行候选 | 无编译器ZIP解压后版本与HOL151验证通过；正式资产绑定v0.1.0 Release |
| G0–G4 | PASS：artifacts/acceptance-final/result.json（检查、六步消费者、oracle、演示、解压包、浏览器证据） |
| G5 | PASS：公开源码、双平台CI、Mooncakes0.1.0、独立registry消费者与公网实验台实际使用均通过 |
| G6 | PENDING：没有MoonMetamath报名、主办方初审/验收/奖励回执 |

真实数据库：demo0 19声明/1证明；MIU27/1；peano120/0；HOL948/151。79fixture分别22有效、55无效、2未完成。MoonBit/mmreference 79匹配；官方C完整集72匹配，7项上游边界差异见COMPATIBILITY，C四真实库全部通过。

## 审阅与修复

独立核心审阅artifacts/review-core.md发现的1项P1和2项P2已修复并回归：保护内部可变别名、限制事件累计内存、压缩标签表合法性等。宿主发布审阅artifacts/review-release.md发现的两项P2及关联quota分类均修复，14项宿主测试通过。无尚未处理的审阅P1/P2。

## 下一必要工作与停止条件

责任：Codex根执行者。公开源码 https://github.com/AlexenderSokolov/moonmetamath ；在线实验台 https://alexendersokolov.github.io/moonmetamath/web/ ；版本资产 https://github.com/AlexenderSokolov/moonmetamath/releases/tag/v0.1.0 。首次完整main CI为39970136361，发布校验加强后39970482822（ed06540dc6e2a43536be186ccd2858b9153c6397）成功；最终文档提交以Release绑定SHA的成功CI为准。

Mooncakes正式publish返回200，manifest version/latest_version0.1.0、build_status success、has_package true、yanked false；证据artifacts/mooncakes-manifest.json。registry消费者artifacts/registry-consumer-p9LIWo/result.json两后端成功；symbols.zip更新出现连接超时警告，但模块安装、编译与实际运行成功，未隐藏此警告。公网站点重新构造34步并下载，artifacts/browser/public-proof-c/result.json为独立C valid，截图public-constructed-th1.png。

G5已完整通过，证据artifacts/acceptance-publication-final/result.json；先前Windows/Linux输出数值指数拼写不同导致的哈希检查失败保留在artifacts/acceptance-publication，不改写失败。验收工具已改为下载同一精确SHA成功CI的Linux Pages制品，与公网站点原始字节比对，不做源码归一化或放宽比较。发布版本仍绑定1029f1d41992ef44ffe675b322b0ca1640c9c63f，v0.1.0标签未移动；后续main验收脚本修正不改变发行产品代码。

正式GitHub Release包含142384字节Node24 ZIP、校验和、验证摘要、公网导出证明及截图。已从GitHub再次下载并核对sha256，解压后不依赖编译器实际运行version和HOL151验证，artifacts/release-download/result.json为PASS。注册表最新六步双后端消费者artifacts/registry-consumer-K1Oyx4/result.json为PASS。发布汇总artifacts/publication.json，公网6项资源哈希见artifacts/acceptance-publication-final/public-assets.json。

赛事结果依主办方真实流程单独记录；docs/SUBMISSION_FACTS.md提供可核实材料，未自动提交报名。临时本地服务器已停止，未创建持久监控。当前授权的技术交付已完成；长期下一项是取得真实下游反馈，再决定完整set.mm性能工作，不自动扩展本轮任务。
