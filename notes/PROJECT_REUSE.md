# MoonMetamath 实现与复用卡片

## 2026-10-29：agent 接口与维护结构整理

用户在代码质量审查后要求“就按照你上一轮的分析，改进完善，做好项目重构吧”。本轮在 codex/agent-interface-refactor 修改。随后用户明确批准完整大库复验及 0.6.0 公开发布；当前状态见 PROGRESS。

新增 theorems 提供不含 proof 的分页摘要，旧 list 保持兼容；web/theorems.mjs 供网页与 Notebook 恢复共用。bin/actions.mjs 负责完整动作文件校验，CLI 允许显式新标签和操作预算。parser 为活动不交变量对维护集合，随作用域同步回收；解析派生对与证明执行分别使用 max_operations 配置。所有保留源预检 ASCII 与大小。

README、API、CLI、PROJECT 各负其责；旧 SCENARIOS 保留导航入口。发行包使用 scripts/package-docs.mjs 的明确清单，并验证全部文档相对链接。已有测试样例继续作为回归输入，网页撤下练习引导。

本轮整套检查：核心 JS/wasm-gc 各 77 项、宿主 74 项、外部样例 79 项通过；浏览器 14 项通过，实际下载由官方 C 接受。独立审查补充回放切换后的步号重置后，对应 2 项浏览器回归及格式整理后的 15 项 CLI 测试通过。最终发行包 44 条相对文档链接、5 条无编译器命令通过，记录见 artifacts/refactor-20261029。原始失败保留。后续已按新增授权完成完整 set.mm API/CLI 验证及实际浏览器重库复验。定理 DOM 分页修复全量列表造成的阻塞，恢复后导出从首次 249.717 秒降为 1.610 秒；证据见 artifacts/publication-v06。

## 历史阶段记录


更新2026-10-23。原规划已由Codex实现，G0–G5技术验收通过；Mooncakes0.1.0、双平台CI、独立registry消费者及公网实验室实际使用通过。正式资产与精确提交见Release，赛事外部审核仍待真实回执。

## 最小阅读路径

先PROJECT.md、PROGRESS.md，再docs/API.md和COMPATIBILITY.md。核心入口src/core/dispatch.mbt与根api.mbt；消费者脚本scripts/consumer.mjs展示真实公共调用。

## 可复用模块与接口

- src/core：MoonBit纯数学语义，源集合→数据库→验证状态→受控构造/回放会话→自足普通证明。普通、压缩、交互共用proof_step；内部可变数据私有。
- dispatch_json：schema_version1/request_id/operation，成功请求与数学outcome分层。根Mooncakes包公开此单入口；句柄reset/Worker终止后失效。
- bin/host.mjs：只负责有根目录边界的include读取，不参与数学判断。CLI以Worker提供取消/截止/old-generation heap额度。
- web：独立Worker；构造、原证明回放分开；原子失败与回退；本地上传源集合；实际取消使句柄失效。
- scripts/fixtures.mjs与oracle.mjs：固定来源/字节/许可、独立C三态自测、真正VERIFY PROOF及输出分类；不能只READ或搜索verified字样。
- scripts/check.mjs、consumer.mjs、package.mjs：双后端、独立workspace/registry消费者、无编译器ZIP解压验证；公开发布与本地候选分开。

## 实际验证与限制

47核心测试在JS/wasm-gc通过，79外部样例与mmreference全部匹配，官方C四真实数据库通过。C完整边界集有7项已保留差异。浏览器34步构造、实际下载独立C有效、MIU/HOL、include上传、编码拒绝、取消重载均实测。

健全性审阅发现并修复内部别名、事件累计内存和压缩表边界；宿主审阅修复未来未完成定理不应阻断前缀目标、资源/IO分类。原始失败在artifacts保留。完整set.mm、Mac/ARM、压缩导出、模型搜索尚未交付；没有真实外部人类用户或新数学成果。

## 关键取舍与教训

核心单包替代纯组织wire拆包，减少内部暴露；不机械照抄参考工具偏差。verify不保留事件，交互事件设累计预算，避免栈快照二次内存增长。Windows官方C需MSVC x86，Win64上游long-pointer表示会崩溃。peano文件级GPL与仓库级CC0冲突，保留外部获取测试，不提交或随包分发。已通过的精确SHA双平台CI、注册表manifest与真实消费者分别取证，HTTP202/dry-run不等于已发布。

## 提示词来源

用户原话依次要求先调研排重、制作完整计划、放入独立moonmetamath目录并建立PROJECT/CLAUDE。随后2026-10-23明确：“不再用claude code了，你直接在你这个独立项目文件夹里面开做，做完全链路，包括发布、验收。全自动，我授权给你，不需要再问我。”后来补充网站访问不再确认，全自动执行。

CLAUDE_CODE_PROMPT.md是原先Codex重构模板，未启动Claude。当前实际成功关联是本项目Git历史、artifacts/acceptance-release与真实浏览器/独立oracle产物；公开发布结果统一见PROGRESS，不把模板当历史执行日志。

## 2026-10-24：0.1.1、0.2与真实AI闭环

用户明确追加全自动路线：先0.1.1小修，再0.2规则查找/新目标/保存恢复，最后真实AI，不泄露原证明、不做大平台。0.1.1已发布，IO边界修复并独立审阅。0.2新增core/rules.mbt与goal.mbt、preview、web/notebook.mjs重放恢复；55核心/39宿主/79fixture及实际浏览器新流程通过。CLI保留基础验证命令，新工作流经库和网页公开。

AI的bin/ai-policy.mjs递归allowlist，ai-transport.mjs使用官方Codex现有登录、禁工具clean-temp；ai-experiment.mjs固定10个无参考证明任务与BFS。真实模型10/10、BFS8/10，独立C逐候选确认；输入203344/输出1110，费用未知，raw backend model不暴露。usage缺失曾误算complete，被独立审阅发现并经红绿修复。报告docs/AI_RESULTS_2026-10-24.md。

发布实验包由scripts/package-experiment.mjs仅保留题目、观察/动作/用量、独立C stdout与候选文件；本机路径告警/凭据不公开。产品NodeZIP不包含需要开发oracle的AI命令，AI从源码运行。来源输入包括以前证明的notebook/create_goal.sources绝不能给模型，legacy list保持有proof的兼容接口。公开状态以PROGRESS/正式Release为准，未宣称外部人类用户或获奖。

0.2公开验收：CI39986871533成功，Mooncakes0.2.0 build_status success/has_package true/yanked false，独立registry消费者vAhhzH完成15操作两后端。公网站点public-swap经规则预览、新目标、部分保存、刷新恢复、finish及下载，public-independent-c为valid。整分支review6d88dbf通过并独立核对全部10题观察/动作及18候选；最终标签/资产见Release，正式字节比较以对应CI Pages制品为准。

正式0.2.0 Release已完成：标签97190c3 / CI39987977412，运行包178402字节和实验包23521字节已从GitHub下载、SHA匹配并解压验收。公网11文件与对应CI Linux制品逐字一致。初次TLS网络失败保留，串行本机TLS恢复，无模型重跑。完整进度/artifactreceipt见PROGRESS。临时服务已停，未增加持久任务。


## 2026-10-26：0.3长期运行基础与独立下游

完成第一阶段并正式发布0.3.0，源码e99a812，CI40271500241，公开验收与Release归档清单见PROGRESS和artifacts/publication-v03.json。

可复用入口：api.mbt公开Engine/new_engine/dispatch_engine及JS create_dispatcher；src/core/dispatch.mbt管理实例内资源和不复用句柄，close_session后再unload_database，活动引用拒绝卸载。verify_database针对不可变数据库保留已成功验证证据，报告仍按当前尝试计数；不把保存状态当证据。

web/app.mjs的候选会话/数据库/Worker先成功后提交、失败清候选、成功清旧资源及epoch/任务序号处理，可用于长期编辑器。独立review发现真实Worker错误被epoch隐藏，已通过实际Worker抛错的红绿回归修复。

兼容资产：tests/fixtures/notebooks/v0.2.0来自对应Git标签原写入器，manifest记录来源；tests/host/compatibility.test.mjs不依赖当前writer生成预期文件。examples/downstream为可复制独立MoonBit模块；scripts/downstream.mjs分别在新workspace和纯registry目录跑两个后端，导出交官方C复核，不宣称外部采用。

发布证据：scripts/browser-check.mjs执行真实Playwright并对实际受测本地/公网资源做前后绑定、原报告摘要及下载C复核；scripts/browser-receipt.mjs拒绝错构建、缺项、skip/flaky记录。CI发布直接采用受测Linux站点制品。当前publication与历史版本归档区分，Release清单长期保留工具链、源码、资源及验收摘要。

验证：61核心/后端、47宿主、79外部与独立参考、4官方小库、本地及公网各12浏览器、独立下游workspace/registry双后端、实际发行ZIP下载与HOL151通过。源码/宿主/整分支review完成且发现关闭。原红测保留；无大库性能、训练、外部采用、Firefox/WebKit或Mac/ARM结论。

提示词来源：2026-10-26本次对话用户原文：“那就按你推荐的路线推进，先把第一阶段的长期使用基础做完，并准备一个独立下游接入示例。保持统一内核和旧接口兼容，完成测试、独立审查、发布与验收，全自动推进，不用反复问我，也别扩成大平台。”对应规格/计划、发布提交和以上验收构成成功关联；没有创建新模型实验或持久后台任务。


## 2026-10-28：0.4 真实规模测量与发布

固定 hol／nf／set 三档完整库，46 条样本与失败记录保存在 benchmarks/results/v0.4.0.json；测量脚本在独立进程中分开记录输入、序列化、dispatcher、响应解析，OOM 未完成时间及峰值保持未知。旧 parent wall 混入后处理的问题已通过延迟负控修复，旧数据不改写。

去掉字符数组、复用私有上下文、按声明消费 token，保持完整词法预检与公开数组接口。实际默认 CLI 又暴露宿主正则输入缓存保留，顺序 include 扫描并释放缓存后，默认预算可正常报告44552／48097超限。完整验证需要显式100m预算；大库新目标在已测512／2048MiB下仍未完成。数据范围与复现见 docs/PERFORMANCE.md。

发布v0.4.0／4e8bd8a，CI40288835815、69核心双后端、70宿主、79样例、注册表及公网12浏览器通过；Release ZIP下载与HOL151通过。Pages短期制品过期后，以同一CI保留的verified-site复核部署字节，保留初次失败。材料沿用原artifacts／.references／.superpowers位置，未移动或删除。

提示词来源：2026-10-26用户批准第二阶段真实数据库基线和测量后优化，要求统一内核、旧接口兼容、全自动发布验收；2026-10-28追加全自动收尾和MD申报书。实际交付关联为上述发布及验收，申报书位于docs/项目申报书.md，尚未对主办方提交。


## 2026-10-28：0.5 完整大库工作台

用户要求继续做完此前失败流程，并明确不因预算停止。定位固定stdlib长字符串转义逐字符拼接链后，以私有wire_json.mbt分块委托原转义、保护代理对解决内存放大；不改全局标准库和数学执行器。web显式操作预算统一经过请求入口和候选恢复，schema1仍仅保存来源与动作。

复现入口scripts/large-workbench.mjs及MOONMM_LARGE_WORKBENCH=1的浏览器重库用例。默认CI13项轻量回归；重库显式启用，不产生默认skip。完整set最后上下文创建原表达式，然后用wph完成wff ph，再保存、新Worker恢复、导出，API、本地及公网浏览器全部通过，导出官方C有效。公网约5分钟；大文件导出仍需等待，不能混作毫秒级交互。

发布v0.5.0／2b46d5f，CI40714461684，72核心／后端、71宿主、79样例、普通浏览器13项以及额外重库单项通过。Release含真实保存与导出示例，下载字节再次核对。源文件、诊断和失败保留于原artifacts路径；入口artifacts/v05-large-workbench/README.md。提示词来源为用户本轮“那你要做完啊，得做完，不管什么预算”，关联上述真实验收；先前将未完成项作收束的选择已撤回。
