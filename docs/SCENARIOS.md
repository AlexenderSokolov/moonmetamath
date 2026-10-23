# 操作场景与 0.2 渐进练习

从仓库根目录运行。先按 [README](../README.md) 构建；CLI/Web 均使用 `dist/moonmetamath-core.mjs`，不需要模型或 token。

以下新增规则面板、新目标和工作文件说明对应已公开的0.2.0。新版界面已在本地与公网站点实际完成新目标、规则预览、刷新恢复及下载独立复核。旧版实际浏览器结果和新版核心/组合脚本结果在下文分别标明。

## 1. 学习：在浏览器重做一个等式定理

```sh
node scripts/serve.mjs --port 4173
```

打开 [本地实验室](http://127.0.0.1:4173/web/)。默认加载并验证 demo0，选中 `th1`，目标为 `|- t = t`。

1. 在“手动构造”输入 `unknown-label`，查看拒绝原因；成功步数与空栈不变，关闭提示。
2. 应用 `tt`，再“撤回一步”，确认回到空栈。
3. 可先在“原证明回放”检查并观察原答案；这只是教学回放。返回手动构造时，原有构造状态独立保留。
4. 逐项手动输入下面的 demo0 原证明标签，共 34 步；这是一份已知答案，不是模型发现：

```text
tt tze tpl tt weq tt tt weq tt a2 tt tze tpl tt weq tt tze tpl tt weq tt tt weq wim tt a2 tt tze tpl tt tt a1 mp mp
```

每个标签通过后会展示栈变化、必要假设及同时代换。最终栈只剩目标表达式，点击“检查完成”，填写无冲突的新标签，再下载 `.mm`。

0.1.x 实际验收已经在浏览器完成上述 34 步构造、错误拒绝、撤回、完成与下载；实际文件 `artifacts/browser/browser-th1.mm` 已被独立官方 C 接受，记录见 `artifacts/browser/downloaded-proof-c/result.json`。

## 2. 集成：把外部标签动作交给核心

用编辑器保存 `mini.mm`：

```text
$c |- a $.
ax $a |- a $.
th $p |- a $= ax $.
```

保存 `actions.json`：

```json
{"schema_version":1,"actions":[{"operation":"apply_label","label":"ax"}]}
```

运行：

```sh
node bin/moonmetamath.mjs session mini.mm --theorem th --actions actions.json --export candidate.mm
```

CLI 先验证库，创建空栈会话，执行动作，再执行 finish 并导出。出口标签为 `moonmm-session-1`；`candidate.mm` 必须尚不存在。成功输出 outcome valid 与实际 export_path。如果把动作改成未知标签，会返回诊断；没有成功导出。

需要自定义新标签或持续交互时，直接使用 [schema 1 API](API.md)：`load → verify → start → apply_label → finish → export`。宿主只提交标签动作，不能注入任意栈表达式。根包入口同时可供原生 MoonBit 消费者使用。

已有独立检查器环境时，可以复核刚生成的文件：

```sh
node scripts/oracle.mjs verify --file candidate.mm --engine metamath-exe --out artifacts/candidate-c-check
```

检查的是 `VERIFY PROOF *` 的实际完成输出。此命令只供开发验收，不是产品核心的运行依赖。新一次验收使用新的 out 目录保留原记录。

## 3. 检查：区分真实库的证明与未完成项

```sh
node bin/moonmetamath.mjs verify tests/fixtures/upstream/set-mm/demo0.mm --format json
node bin/moonmetamath.mjs verify tests/fixtures/upstream/set-mm/miu.mm --format json
node bin/moonmetamath.mjs verify tests/fixtures/upstream/set-mm/hol.mm --format json
```

本地验收分别得到 1、1、151 个 verified 证明。peano.mm 的本地外部验收只有合法声明、0 个证明；文件头许可存在冲突，该文件通过固定来源取得，不随本项目分发，详见 [THIRD_PARTY](THIRD_PARTY.md)。

读取 `outcome`、`complete` 与四项计数。单独 list 只查询，不代表验证通过。证明中含 `?` 应产生 incomplete；无效或未完成依赖不会被当成可用前提。

完整的固定材料和开发检查：

```sh
node scripts/fixtures.mjs fetch --profile october
node scripts/check.mjs
node scripts/oracle.mjs fixtures --engine mmreference --out artifacts/reference-python-new
```

重新获取独立参考需相应 Python/C 开发环境。79 项原始预期在 MoonMetamath 与 mmreference 中全部符合；官方 C 有 7 项已记录分歧，不能把 C 批量退出失败当成所有数学证明失败，也不能把它改写成全过。细节见 [COMPATIBILITY](COMPATIBILITY.md)。

## 4. 0.2：从短练习学习查规则、预览和保存恢复

启动本地网页后，在示例选择器中依次加载三份练习。它们为自编 CC0 材料，目标故意写成 `$= ? $.`；加载时报告 incomplete 是预期情况，活动上下文仍可用于手动构造。

| 练习 | 目标与操作 | 要观察的检查 |
| --- | --- | --- |
| [01-first-steps.mm](../examples/exercises/01-first-steps.mm) | 目标 `first-steps`：依次应用 `wph`、`identity`，然后检查完成 | 查询 `identity`，查看其必要假设 `wph`；输入类型码 `|-` 只筛选对应结论 |
| [02-essential-hypothesis.mm](../examples/exercises/02-essential-hypothesis.mm) | 目标 `essential-goal`：依次应用 `wph`、`premise`、`lift` | 过早预览 `lift` 会因缺少必要栈项被拒绝；失败不改变当前构造 |
| [03-disjoint.mm](../examples/exercises/03-disjoint.mm) | 目标 `disjoint-goal`：正确顺序为 `vx`、`vy`、`pair-rule` | 先试 `vx`、`vx` 并预览 `pair-rule`，观察 `$d x y` 诊断；撤回第二步，再用 `vy` |

规则详情按声明次序列出必要假设、结论和不交变量条件；活动假设可直接入栈。预览成功显示预计结果，但不会提交动作；只有“应用所选规则”才改变会话。规则可用或这一步合法，都不保证它有助于最终目标。

在第三份练习中，还可以完整走一遍新目标及恢复：

1. 选择 `disjoint-goal`，展开新目标表单，填写新标签 `swapped-goal` 和表达式 `|- pair y x`。创建后从空栈开始。它继承 `vx`、`vy` 和 `$d x y`，原目标及后续声明均不成为可用前提，也不会加入新公理。
2. 应用 `vy`，点击“下载工作 .json”。保留下载文件；若该文件不超过 2 MiB，保存按钮也会更新本机上次保存。
3. 刷新页面后点击“恢复本机上次保存”，或导入刚下载的 JSON。恢复成功后确认栈为 `setvar y`、成功步数为 1，再应用 `vx`。
4. 查找并预览 `pair-rule`；当前工作仍保持两步。显式应用后，栈只剩 `|- pair y x`；检查完成并用新的无冲突标签下载普通 `.mm`。
5. 有独立检查器环境时，按场景 2 的命令复核下载文件。数据库源中的 `?` 与会话完成状态是两件事：finish 依据重放得到的最终栈，导出则写入实际构造的普通证明。

工作文件 schema 1 保存源文本/SHA-256、目标、撤回后保留的成功 `apply_label` 前缀和完成标记。文件上限为 128 MiB、10,000 步，不保存内部句柄或栈。恢复在新 Worker 里核对哈希、重新验证源、重放动作；保存为已完成的工作还要重新通过 finish。失败不会替换当前构造。可用一份手动改坏源文本而未更新哈希的文件验证拒绝行为；保留原始保存文件供继续使用。

本机保存由“保存”按钮触发，没有持续自动保存或上传；浏览器禁用存储时仍可下载/导入。超过 2 MiB 时只下载，不覆盖本机上次保存。取消会终止活动和候选恢复 Worker，最后确认视图只读，继续需要重新加载或导入此前保存文件。

当前已实测的独立组合脚本覆盖查规则、原子预览、新目标、部分保存恢复、完成、导出和官方 C 复核：

```sh
node scripts/workbench-demo.mjs --oracle
```

它使用真实核心及同一保存恢复助手，可检查 `artifacts/workbench-*/result.json` 与候选 `.mm`；需要已有独立 C 开发环境。新版界面已另行完成实际浏览器规则/新目标/保存恢复验收，记录artifacts/browser-v02/receipt.json；窄视口与存储拒绝分支仍按清单注明未现场执行。完整新增 JSON 调用示例见 [API](API.md)。
