# MoonMetamath 当前进度

更新2026-10-23。唯一进度入口；历史规划不覆盖本页当前事实。

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
