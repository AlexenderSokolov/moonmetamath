# MoonMetamath 当前进度

## 2026-10-29：0.6.0 发布与线上验收完成

发布源码 ddb7c358c555119f901ff6a230fab8566c0148eb；CI 40793006292 的 Windows、Linux 和 Pages 全部成功。Mooncakes 0.6.0 manifest 为 success/has_package，独立注册表消费者在 JS、wasm-gc 各执行 16 个操作（含 theorems），下游实例隔离、会话复用及导出官方 C 复核通过。

核心每后端 77 项、宿主 74 项、外部样例 79 项通过。本地与公网分别通过 17 项普通浏览器回归和 1 项完整 set.mm 工作台。完整库 48,097 个证明通过 API 与 CLI 验证，浏览器完成原目标表达式创建、wff ph 构造/撤回/完成、保存、独立 Worker 恢复和导出；本地、公网的大库下载均由官方 C 接受，工作文件和证明字节一致。

定理列表每页最多 100 个 DOM 项；恢复目标页实际 97 项。首次大库复验导出阶段 249.717 秒，经相同浏览器的旧/新核心比较定位到界面显示规模，分页后本地为 1.610 秒、公网为 1.497 秒。保留首次结果与对照，不作跨机器延迟保证。

[Release v0.6.0](https://github.com/AlexenderSokolov/moonmetamath/releases/tag/v0.6.0) 程序 ZIP 已实际下载并核对 SHA256，无编译器 HOL 151 证明、独立实例、无 proof 摘要和连续两次新标签导出通过。13 个线上资源逐字节匹配受测 CI Pages 制品。完整入口为 artifacts/publication-v06/publication.json 与 README.md。技术发布与线上验收完成，赛事状态未变。

## 2026-10-28：0.5 完整大库工作台交付完成

此前未完成的完整set.mm新目标流程已完成修复、API与实际浏览器全链路、独立审查、正式发布及公网验收。发布源码2b46d5f7f13a4d01d0648c766dfb332620e2d86d，CI40714461684的Windows／Linux／Pages全部成功，Mooncakes0.5.0注册表消费者通过。

固定完整set共48097原证明；原young2d表达式新目标创建成功，随后wff ph目标完成应用、撤回、finish、约37MB工作文件保存、全新Worker恢复和导出。API与本地浏览器导出、正式站点浏览器导出均经官方C验证有效。原young2d目标创建成功不表述为发现其新证明。

72核心测试／后端、71宿主、79外部样例、普通浏览器本地／公网各13项通过；额外重库浏览器本地／公网各1项全流程通过。公网重库约5分钟，恢复后导出约118.5秒。采用显式一亿操作预算，保留默认值与原schema1。

Release程序ZIP真实下载并核对、无编译器HOL151及实例隔离通过。large-workbench-example.zip亦已真实下载，其工作文件和导出证明与本地及公网验收文件逐字节相同。汇总artifacts/publication-v05.json；公开验收artifacts/v05-large-workbench/publication/result.json；重库公网artifacts/v05-large-workbench/public-large，官方C结果在其independent目录。

项目申报书已更新至0.5，姓名与联系方式仍需本人填写，尚未提交主办方。当前任务已完成，临时测试进程已结束。原失败证据保留，资料未移动、未删除，收尾入口artifacts/v05-large-workbench/README.md。

以下为实现及历史记录：

## 历史：0.5 本地实施记录

用户要求把此前未完成的大库交互继续做完。原停止点撤回；本轮已定位长字符串JSON逐字符拼接的内存膨胀，改为分块委托标准库转义，旧接口、完整sources与数学验证不变。

API全链路和实际Chromium完整set工作台均通过：48097原证明、young2d原表达式创建、wff ph构造／撤回／完成、约37MB文件保存、新Worker恢复、导出及官方C有效。实际记录artifacts/v05-large-workbench/api-final/result.json与browser/independent/result.json。72核心双后端、71宿主、79外部样例、普通13浏览器0skip通过，独立终审PASS。正在正式发布0.5和公网复验；尚不把本地通过标为公开交付完成。


## 2026-10-28：0.4.0 发布与申报材料交付完成

第二阶段已完成测量、必要优化、测试、独立审查、正式发布和公开验收。发布源码为4e8bd8ada0206f7575d26ab1eee148459d11a19c，CI40288835815全部成功；Mooncakes0.4.0构建成功，注册表新旧消费者通过，正式Release已发布。

本地69核心／后端、70宿主、79外部样例与独立对照通过；公网12项Chromium流程及下载证明独立C通过。短期github-pages制品已不可下载，首次验收失败记录保留；已从同一CI的verified-site制品12635850606逐字节核对12项公网资源，恢复记录artifacts/v04-publication-recovered/result.json为PASS。正式ZIP实际下载、哈希与无编译器HOL151验证通过，记录artifacts/release-v04/download-WxA8iP/result.json。汇总artifacts/publication-v04.json。

申报书见docs/项目申报书.md，按现存模板栏目整理；作者和联系方式待本人填写，未向主办方提交。性能数字、预算及完整大库新目标失败边界均保留。复现入口benchmarks/README.md、逐样本benchmarks/results/v0.4.0.json、报告docs/PERFORMANCE.md。

本轮临时材料沿用artifacts和.superpowers，原始大库位于.references/performance；没有移动或删除材料。归档定位入口见artifacts/release-v04/README.md。当前无后续实验或后台监控需要运行。

以下为实施过程记录：

## 历史：2026-10-26 第二阶段实施记录

用户批准真实小/中/大数据库基线、测量后必要优化、兼容/统一内核、测试/独立审查/发布验收全自动。当前分支codex/moonmetamath-v0.4，起点c65b160，0.3正式标签不改。

计划docs/superpowers/plans/2026-10-26-v04-performance.md；恢复ledger .superpowers/sdd/v04-performance/progress.md。hol96899字节/151证明、nf2985101字节/5976证明、set51737997字节/48097证明固定于同一上游b4c3130；blob/SHA与官方C有效结果已核。

原0.3已冻结于artifacts/v04-baseline/core-v0.3.0.mjs。512MiB/default基线hol/nf各3完成，set加载OOM；workbench hol/nf各3完成。诊断2048/default在44552/48097达到原10m操作预算；2048/100m完成48097。分profile报告，默认限制不变。

第一轮最小优化a58a443去字符数组并共享私有上下文，65测试两后端通过；实测nf峰值RSS中位数311928→243076KiB，load262→204ms，但set512仍OOM。独立scanner诊断保留5.1M tokens时峰值721640KiB，现按此证据实现私有分声明token消费；公开scan_source接口与全词法预检优先级保持。尚未发布0.4。

分声明token消费已实现，69核心双后端/64宿主/79样例通过。相同2048MiB/100m配置下，set加载中位数4545→3452ms、峰值RSS1908.80→749.70MiB；验证阶段不声称加速。512MiB/100m三次验证完整48097。默认10m仍明确超限；大库新目标在512/2048MiB均未完成，失败阶段保留，停止进一步架构扩展。最终报告docs/PERFORMANCE.md及46行逐样本数据已保存；完整本地验收与整分支终审均通过；最终69核心双后端/70宿主/79样例通过，12浏览器receipt按实际构建绑定复用。CLI宿主关联修复经独立复审及实际set验证，现在默认预算处正常返回44552/48097超限而非WorkerOOM。当时尚未发布0.4；现已完成，最终状态见本页2026-10-28记录。

harness独立审查发现parent wall包含证据整理已修复并16测试通过；旧raw保留，旧process_wall不进入发布对比，dispatch计时不变。根负责后续同预算测量/完整验收/发布。当前没有模型/训练或持久后台任务。

以下为0.3交付历史：

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
