# MoonMetamath 实现与复用卡片

更新2026-10-23。原规划已由Codex实现，G0–G4本地验收通过；公开发布状态见PROGRESS.md，不从此卡片推断外部审核。

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
