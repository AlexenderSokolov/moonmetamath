# 验收、运行与发布全流程

状态：**本地G0–G4、公开G5已实际通过**。下列入口均已实现；本地完整结果见artifacts/acceptance-release/result.json，实时发布结果见PROGRESS.md。本文保留验收设计及门槛，不能从预期文字推断结果。

## 1. 门槛与结果口径

| 门槛 | 必要结果 | 责任任务 |
|---|---|---|
| G0 语义垂直链 | 固定环境；demo0/miu；普通/压缩共用语义；关键无效证明拒绝；独立结果可解释 | T0–T5，开始后48小时内 |
| G1 核心完整性 | 固定适用语义用例；JS/wasm-gc一致；parse/verify信任隔离；状态不混淆 | T1–T6 |
| G2 真实材料与导出 | demo0、miu、peano、hol固定版本完整检查；构造候选的合法前缀导出被独立C/Rust检查器接受 | T7 |
| G3 直接使用 | CLI真实运行；网页逐步操作、改错、回退、finish、下载、取消/重启；三场景 | T8–T9/T11 |
| G4 本地交付候选 | 无编译器CLI包、全新workspace consumer、文档/来源/许可、检查脚本及CI配置 | T10–T12 |
| G5 公开交付 | 对应授权下的公开源码/精确提交CI、实际Mooncakes发布、manifest与全新registry consumer | T12，不能从G4推断 |
| G6 赛事结果 | 真实报名回执、初审邮件、验收结果及奖励状态各自记录 | 用户/赛事实际结果 |

每个子项为PASS / FAIL / PENDING / NOT_APPLICABLE。N/A必须说明不适用理由，不能把未做必测项改N/A。任何must为FAIL或PENDING，所属gate不能PASS。增强项目失败不影响已定义的must，但要公开限制。

`--phase local`只检查G0–G4；即使exit0也只能声称本地候选就绪。`--phase publication`用于只读核对G5与全新安装，不自动执行publish/push。G6从真实回执记录，不由测试脚本生成。

## 2. 工具链与脚本行为

新项目根目录必须提供以下统一入口：

| 入口 | 行为 |
|---|---|
| `node scripts/toolchain.mjs verify` | 验证固定compiler/moon/core/Node，不自动联网安装 |
| `node scripts/toolchain.mjs install` | 未来显式执行时下载固定官方归档并校验哈希到新项目缓存；不改变全局版本，不删旧缓存 |
| `node scripts/fixtures.mjs fetch --profile october` | 获取R5/R6及R7四个must数据库，核对固定SHA/逐文件许可，记录来源；可离线复用 |
| `node scripts/build.mjs` | 用项目解析的工具链构建core JS/wasm-gc与稳定JS桥接产物 |
| `node scripts/check.mjs --task Tn` | 对应任务针对性检查；内部解析实际测试文件，避免shell glob差异 |
| `run_check.ps1` / `run_check.sh` | fmt、info同步、check、build、核心测试、CLI集成和跨后端一致性 |
| `run_demo.ps1` / `run_demo.sh` | 实际调用产品入口，断言三个场景的结果，不是输出预录文本 |
| `run_acceptance.ps1` / `run_acceptance.sh` | 包装相同Node验收编排，参数与退出码一致 |

编排脚本调用锁定的moon路径，不使用未核实全局版本；命令参数用数组，不把JSON/文件名插入shell字符串。失败逐层传播，不吞exit。日志保存在新`artifacts/<run-id>/`，不覆盖旧失败、不做清理。原始stdout/stderr与解释分开存。

MoonBit底层检查至少包括：`moon fmt --check`、`moon info`、`moon check --target js --deny-warn`、`moon build --target js --deny-warn`、`moon test --target js --deny-warn`；wasm-gc同样check/build/test。`moon info`后检查受跟踪mbti是否同步，具体命令能力按锁定工具帮助核实，不能猜不存在选项。

## 3. 正常复现路径（未来程序写好后）

Windows PowerShell，工作目录固定为新项目：

```powershell
Set-Location -LiteralPath 'D:\Study_Works\MoonBit\moonmetamath'
node scripts/toolchain.mjs verify
node scripts/fixtures.mjs fetch --profile october
pwsh -NoProfile -File run_check.ps1
pwsh -NoProfile -File run_demo.ps1
pwsh -NoProfile -File run_acceptance.ps1 -Phase local
```

Linux/WSL/CI，从新项目根运行（不自动启动用户未授权的WSL或远程主机）：

```bash
node scripts/toolchain.mjs verify
node scripts/fixtures.mjs fetch --profile october
bash run_check.sh
bash run_demo.sh
bash run_acceptance.sh --phase local
```

task/gate入口示例：

```text
node scripts/check.mjs --task T3
node scripts/acceptance.mjs --gate G0 --out artifacts/g0-run1
node scripts/acceptance.mjs --gate G2 --out artifacts/g2-run1
node scripts/serve.mjs --port 4173
```

`serve`只绑定127.0.0.1，实际端口冲突时明确报错/允许显式改端口，不改用户其他服务。浏览器验证完成即关闭该临时服务，不创建后台自启。

## 4. 语义验收矩阵

| ID | 输入/动作 | 必须结果 |
|---|---|---|
| S01 | ASCII合法空白、CRLF和注释 | token与定位一致，注释内include不展开 |
| S02 | 非ASCII/BOM、非法标签、未闭合注释/声明/块 | 明确编码/语法错误，无空成功报告 |
| S03 | 重复标签、标签/符号重名、未声明变量、无效类型码 | 拒绝；关联源位置 |
| S04 | 合法`$e`后仍出现`$f`并形成mandatory列表 | 按规范顺序接受；不能盲随R2限制 |
| S05 | include重复/别名/自引用/顶层回引 | 正确规范化身份，只首次展开，不无限递归 |
| S06 | include缺文件、内层/声明中include、跨源不完整 | 对应宿主/语法错误，不冒充数学反例 |
| S07 | parse完整数据库但未verify | 所有`$p`仍NotChecked，不能被会话当定理 |
| S08 | 已验证前置`$p`、显式`$a`、活动假设 | 可合法使用，公理与已证定理区分 |
| S09 | 目标自身/未来定理、已关闭假设、未验证/未完成前提 | 拒绝或明确阻断；不Verified |
| S10 | 同时代换、合法空代换、essential匹配 | 正例接受；逐步回显实际代换 |
| S11 | 不匹配类型码/essential、`$d`集合相交或缺环境关系 | 拒绝；状态原子不变 |
| S12 | 普通/压缩的同一证明 | 结论、状态及错误含义一致 |
| S13 | 空栈Z、未来保存项、越界/非法/悬空数字编码 | 拒绝，不分配无限内存 |
| S14 | `?`、资源额度、取消 | Incomplete/ResourceLimit/Cancelled，绝非Valid |
| S15 | finish空栈/多项/错目标 | 不完成，仍可修复；正确单项才Complete |
| S16 | 错步后合法步、rewind后重做 | 结果与干净会话相同，错误未污染状态 |
| S17 | 已有压缩proof replay请求normal导出 | UnsupportedExport（本期不做provenance展开）；构造会话正常导出 |
| S18 | 导出已有目标的新证明 | 无自身/未来引用，完整合法前缀，同结论，独立checker通过 |
| S19 | 公开返回的数组/view被调用方修改 | 不影响内部数据库或会话（不透明或副本） |
| S20 | include路径/IO失败与proof failure | exit3与exit1及wire phase区分 |

每个ID在`docs/COMPATIBILITY.md`关联具体测试名和来源，不以“有100个测试”替代覆盖。R5/R6的全部适用语义测试应纳入，无法适配的条目逐项解释；不能挑易例后声称全部通过。

## 5. 独立对照的实际操作

`scripts/oracle.mjs`接收fixture与候选，使用固定独立工具。建议命令契约：

```text
node scripts/oracle.mjs self-test --out artifacts/oracle-self-test
node scripts/oracle.mjs fixtures --manifest tests/fixtures/manifest.json --out artifacts/oracle-fixtures
node scripts/oracle.mjs verify --file artifacts/candidate.mm --engine metamath-exe --out artifacts/oracle-candidate
```

这些是待实现的统一入口，不声称官方程序原生命令长这样。adapter依据各工具固定README实现参数/stdin，保留工具版本、实际命令、raw输出与识别到的状态。

- 至少自检 known-valid/known-invalid/incomplete，验证不是无条件接受器。
- C工具必须实际执行`VERIFY PROOF *`；不以READ完成或末尾一句泛化总结判PASS。对照保存原始错误。
- Rust/Python工具也核实退出码和输出语义。缺少二进制记录NOT_AVAILABLE；不能把spawn成功当证明通过。
- 与R2相同仅证明参考一致性；G2导出至少一个C/Rust独立checker真实接受。
- 不一致保存最小输入、规范依据和两个结果。健全性争议未解决前该项FAIL，不以多数票选答案。

## 6. 三个场景与用户试用

### A：学习/修改一个证明

材料：固定R7 demo0或miu，目标与原证明来源清楚。

操作：加载→查看目标/有效假设→运行合法标签→查看实际代换→插入错标签→错误定位且栈不变→回退修复→finish→导出→独立验证。

通过证据：真实界面操作记录、候选文件、独立checker结果。截图只辅助，不单独证明功能。

### B：MoonBit开发者嵌入

材料：全新consumer自己的moon.mod/包；不从原项目内部import私有实现。

操作：按README添加依赖→加载真实小库→验证→检查未完成/错误输入→启动会话并消费结构化结果。

通过证据：新目录实际命令与返回。workspace依赖与registry依赖单列，前者不证明后者。

### C：外部程序/AI试步

材料：冻结目标、允许的前置标签与上下文、schema1动作。

操作：外部程序每次提交一个标签→读取状态/错误→修正→完成→导出→独立checker接受。禁用自身/未来标签；模型不能把原答案或任意已证明表达式直接注入。

确定性actions只能称程序试步/replay。若本期另做真实LLM调用，记录真实模型/输入/输出/成功失败；没有调用不能写“AI自主证明成功”。不需要为本版训练模型或造分数榜。

### 外部采用验证（计划，非既有事实）

在取得联系授权后，优先一名独立MoonBit开发者、一名愿意操作证明的学习者。请其完成具体任务而非问“会不会用”；记录卡点、是否完成、是否愿意再用及与已有工具的差异。没有试用就标未验证，不编造评价。外部试用不替代语义测试；没有采用证据时长期评选竞争力仍弱。

## 7. 打包、CI、registry与赛事分层

**G4 本地：**

1. 确认版本、公开接口、源锁和许可，输入材料合法；包不带工具链、大库、密钥、个人信息或父仓库内容。
2. 同一候选运行所有must；归档在无编译器Node24环境解包、运行help/version/verify/session。
3. 全新workspace consumer调用；确认CI配置包含实际check/build/test/CLI，不冒称远端已运行。
4. 整理可审查diff、候选、来源、三场景和实际限制；准备外部动作清单。

**G5（获得对应授权后）：**

1. 用户批准公开仓库/推送等具体动作后执行，核对目标仓库与提交，保留现有历史。
2. 等待精确候选提交的实际CI结果；未运行或失败不等于通过。
3. `moon publish --dry-run`检查包内容，仅是预检；正式`moon publish`已获本轮用户明确授权，不重复申请。
4. 查询当时有效的官方manifest端点，核对expected version、has_package、build_status、yanked等字段；缺字段标未知，HTTP202不当成功。
5. 在全新目录从registry `moon add <已确认模块>@<版本>`，实际执行core/session调用。不能workspace偷渡替代registry。
6. 发布可用不等于完成报名；本项目GitHub Pages部署已获授权，额外服务依实际范围另行判断。

**G6：** 用户亲自定稿人工一页申报；真实提交后记录回执。初审通过、验收通过、进入评选、获奖和付款分开，不由技术报告推断。十个有效commits来自真实阶段，不补造。

## 8. 验收产物最小清单

`artifacts/<run-id>/`应包含：

- `SUMMARY.md`：本次phase/gates、PASS/FAIL/PENDING、实际限制和下一步。
- `environment.json`：完整工具版本、平台、源码HEAD/dirty或明确无Git，非秘密环境信息。
- `checks.json`：命令、exit、检查范围、duration与日志路径；没有执行不写pass。
- `fixtures.json`：repo/固定SHA/材料相对路径/许可/期望与实际。
- `logs/`、`exports/`、`consumer/`：原始输出、实际导出候选、消费者结果。
- `web-check.md`与必要截图：实际操作断言；没有真实浏览器就pending。
- `release-status.md`：本地候选、远端CI、registry、报名各自状态；不记录密钥/个人报名资料。

计数、receipt或哈希不是最终数学结果。最有价值的交付是合法输入和坏证明都得到正确处理、使用者能完成操作、外部checker接受同一候选，以及公开包能在新项目中使用。
