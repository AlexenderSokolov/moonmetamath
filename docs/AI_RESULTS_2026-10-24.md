# 首次真实AI证明补全实验 · 2026-10-24

固定10道自编小型Metamath命题演算练习；每题只有一个不完整目标，没有参考证明。结果是功能闭环证据，不是标准评测或新数学发现。部分推理原则作为题目的公理给出，经典结论也可能已被模型训练数据覆盖。

## 实际结果

| 路线 | 独立验证成功 | 预算耗尽 | 超时 | 无效动作 |
|---|---:|---:|---:|---:|
| 有限BFS | 8/10 | 2 | 0 | 2134 |
| 真实模型 | 10/10 | 0 | 0 | 0 |

模型实际调用10次，每题1次；预先上限为每题2次、每次64动作、120秒，每题240秒。BFS限制5000次原生动作、深度12、最多6栈项与64表达式token。两者计算预算不同，不能据此声称算法优越性。

模型请求配置为gpt-6.1-sol / low，通过已登录的官方Codex CLI0.164.0调用。CLI不暴露原始backend model字段，记录为not_exposed。CLI报告输入token203344、输出1110，总输入/输出完整；总模型调用计时398026毫秒。订阅传输不暴露逐次美元费用，因此成本unknown。CLI启动和模型目录刷新开销包含在该计时中，不能将其当纯模型推理速度。

| 题目 | 类别 | BFS | 模型 | 模型动作数 | 模型调用ms |
|---|---|---|---|---:|---:|
| 01-direct | direct axiom | verified | verified | 1 | 39296 |
| 02-substitution | substitution | verified | verified | 2 | 36188 |
| 03-compound | compound substitution | verified | verified | 4 | 28099 |
| 04-hypothesis | active essential hypothesis | verified | verified | 1 | 34524 |
| 05-modus-ponens | essential hypothesis matching | verified | verified | 5 | 31023 |
| 06-chain | two inference chain | verified | verified | 3 | 36038 |
| 07-nested | nested implication substitution | verified | verified | 5 | 40978 |
| 08-swap | substitution and essential hypothesis | verified | verified | 4 | 58458 |
| 09-identity | Hilbert identity | budget_exhausted | verified | 40 | 47409 |
| 10-composition | implication composition | budget_exhausted | verified | 6 | 46013 |

## 无原证明输入边界

策略输入只包含目标、活动假设、当前栈、原生规则的结论/必要假设/不交变量和安全执行反馈码。原源码、工作文件、legacy list/proof、replay、目标自身与未来标签不进入模型。基线发现的动作也不发给模型。每次调用在只含schema和简短指令的临时目录运行，禁用工具、shell、apps、plugins、浏览器及额外上下文工具，剥离环境中的API凭据与自定义路由，不修改全局配置。发现工具执行事件即拒绝。

所有候选均由MoonBit完成与导出后，再通过固定版本官方C的实际VERIFY PROOF检查。成功计数只来自独立valid。原始失败、用量缺失、告警会保留，缺失用量不会算完整零用量；本次10题均成功且用量完整。

## 复现和公开产物

- 方法、运行命令、预算与接口：[AI_EXPERIMENT.md](AI_EXPERIMENT.md)。
- 固定任务：[tasks.json](../examples/ai/tasks.json)。
- 本地原始记录：artifacts/ai-2026-10-23（开始于23日、完成于Asia/Shanghai24日）。
- 运行器与任务代码版本：8227909；最终发行版沿用同一AI代码与任务输入。
- 公开审查包由scripts/package-experiment.mjs生成，含预先声明、逐题安全观察、实际模型动作/用量、候选.mm、独立C原始stdout和源字节哈希；排除本机路径告警与凭据。随0.2.0 Release附带。

这10道题较小，未评估完整set.mm、跨模型泛化、训练或新定理发现；没有外部人类使用反馈。一次小实验也不能给出稳定成功率估计。
