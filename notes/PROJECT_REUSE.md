# MoonMetamath 实现与复用卡片

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
