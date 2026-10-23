# 三个完整操作场景

从仓库根目录运行。先按 [README](../README.md) 构建；CLI/Web 均使用 `dist/moonmetamath-core.mjs`，不需要模型或 token。

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

实际验收已经在浏览器完成上述 34 步构造、错误拒绝、撤回、完成与下载；实际文件 `artifacts/browser/browser-th1.mm` 已被独立官方 C 接受，记录见 `artifacts/browser/downloaded-proof-c/result.json`。

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
