# MoonMetamath

MoonBit 原生的 Metamath `.mm` 验证与逐步证明库，附 Node CLI 和浏览器证明实验室。解析、代换、不交变量检查、普通/压缩证明、交互会话与导出都由同一个 MoonBit 核心执行；运行产品无需 Python、C 检查器或模型凭据。

**0.1.1 已公开交付：** [在线证明实验室](https://alexendersokolov.github.io/moonmetamath/web/) · [Mooncakes](https://mooncakes.io/docs/AlexenderSokolov/moonmetamath) · [发行包](https://github.com/AlexenderSokolov/moonmetamath/releases/tag/v0.1.1) · [Windows/Linux CI](https://github.com/AlexenderSokolov/moonmetamath/actions)。模块名为 `AlexenderSokolov/moonmetamath`。注册表构建成功，独立消费者已从注册表安装并在JS、wasm-gc实际运行；网页使用MoonBit生成的JavaScript。

当前源码为 **0.2.0 候选版**：加入规则查找、单步预览、继承上下文的新目标及保存恢复。下文说明候选版能力；0.2 的本地与新版浏览器验收已完成，公开发布和注册表安装正在验收，不能用 0.1.1 的公开结果代替。

## 可以做什么

- 加载真实 Metamath 数据库，验证证明并区分 valid、invalid、incomplete 与未检查项。
- 在目标原有作用域内从空栈重做已有定理，观察代换和栈变化；错误步骤不会改变会话状态。
- 按标签、结论或类型码查找当前可用规则，查看必要假设与不交变量要求，并在当前栈上预览一步。
- 在已有定理的上下文中创建未完成目标，继承活动假设和 `$d` 约束；只编辑新标签与目标，不插入新公理。
- 下载工作文件，或恢复本机上次保存；恢复在新内核中重新检查源文件并重放成功动作。
- 回放原证明，或把自己完成的普通标签证明导出为自足 `.mm` 文件。
- 在独立 MoonBit 程序或 JavaScript 宿主中调用版本化 JSON dispatcher。

网页的原证明回放明确标为 Replay。规则预览只判断当前栈能否执行该步，不判断它是否推进目标。独立的小型AI补全实验已真实运行：固定10道自编题，模型10/10、有限搜索8/10，成功候选均由官方C独立检查。它是功能闭环证据，不能将教学回放当作模型发现，也不声称标准评测优势、外部用户采用或新数学成果。详见[实际AI结果](docs/AI_RESULTS_2026-10-24.md)。形式证明通过只说明它符合所声明的公理及假设。

## 从源码开始

需要 Node.js **24.x**。开发与构建使用锁定 MoonBit 工具链：compiler `v0.10.14+7d59c7ec9`、moon `0.1.20260920` 及匹配标准库。脚本支持 Windows x64、Linux x64，不修改全局工具链；没有 npm 依赖。

在本项目目录运行：

```sh
node scripts/toolchain.mjs install
node scripts/toolchain.mjs verify
node scripts/build.mjs
node bin/moonmetamath.mjs --help
```

安装器按 [toolchain.lock.json](scripts/toolchain.lock.json) 校验官方归档哈希。已有对应隔离工具链时，可通过 `MOONMETAMATH_TOOLCHAIN_HOME` 指定目录并直接执行 verify。发布压缩包若包含 `dist/moonmetamath-core.mjs`，CLI/Web 运行只需 Node 24，无需再次编译。

公开稳定版的注册表安装与公共入口调用已在独立消费者中完成验收：

```sh
moon add AlexenderSokolov/moonmetamath@0.1.1
```

0.2.0 候选源码的模块版本为 `0.2.0`。待正式发布和注册表验收后，使用 `moon add AlexenderSokolov/moonmetamath@0.2.0`；此处尚不表示该版本已能从注册表安装。现在可从当前源码构建并用 `node scripts/consumer.mjs` 检查本地消费者。

## CLI：检查一个真实库

仓库中的 demo0 是固定来源的真实示例。命令默认输出 JSON：

```sh
node bin/moonmetamath.mjs verify tests/fixtures/upstream/set-mm/demo0.mm --format json
node bin/moonmetamath.mjs list tests/fixtures/upstream/set-mm/demo0.mm --format json
node bin/moonmetamath.mjs replay tests/fixtures/upstream/set-mm/demo0.mm --theorem th1
```

`list` 是查询，单独运行时不会验证证明。批量结果须同时看 `outcome`、`complete` 和各状态计数，不能只看请求的 `status: "ok"`。CLI 默认在受限 Worker 中执行，120 秒截止；可用 `--timeout-ms N` 调整（1..300000），超时或 Ctrl+C 返回未完成。

外部动作文件可以通过 `session` 重做证明并导出：

```sh
node bin/moonmetamath.mjs session mini.mm --theorem th --actions actions.json --export candidate.mm
```

可直接复制的 `mini.mm`、动作文件及操作场景见 [SCENARIOS.md](docs/SCENARIOS.md)。CLI 不覆盖已有导出文件。include 默认限制在入口所在目录内，可用 `--root DIR` 显式指定允许的源根目录。

## Web：逐步走完证明

```sh
node scripts/serve.mjs --port 4173
```

打开 [本地证明实验室](http://127.0.0.1:4173/web/)。首次自动加载并验证 demo0；也可选 MIU、HOL，或上传一组包含入口与 include 的文件。

选择定理后，手动构造从空栈开始。规则面板可搜索标签/结论，按类型码筛选，查看必要假设和 `$d`，再预览或应用。也可点击活动假设或输入标签；可以撤回、重启，最后“检查完成”并下载新标签的普通 `.mm`。原证明回放放在单独标签页，不会自动填入构造会话。

“在这个上下文中创建新目标”继承所选定理之前的合法声明、全部活动假设及 `$d`；原目标及后续声明不会作为可用前提。新目标初始含 `?`，因此数据库报告 incomplete 是预期状态，构造完成仍须单独通过 finish。三份渐进练习覆盖两步证明、essential hypothesis 和不交变量诊断，见 [操作场景](docs/SCENARIOS.md)。

“下载工作 .json”保存源文件、源哈希、目标与撤回后保留的成功动作。导入时用独立 Worker 重新验证并重放，成功后才替换当前工作；失败会保留当前构造。点击保存时，至多 2 MiB 的文件也会保存到本机浏览器，供刷新后主动恢复；没有自动上传。工作文件上限为 128 MiB、10,000 步。取消会实际终止活动和恢复 Worker；保留视图只读，继续需要重新加载数据库或恢复保存文件。

## 嵌入 MoonBit 或 JavaScript

MoonBit 消费者的 `moon.pkg`：

```moonbit
import {
  "AlexenderSokolov/moonmetamath",
}
options(is_main: true)
```

`main.mbt` 中调用根包的稳定入口：

```moonbit
fn main {
  println(@moonmetamath.dispatch_json(
    "{\"schema_version\":1,\"request_id\":\"load-1\",\"operation\":\"load\",\"entry\":\"mini.mm\",\"sources\":[{\"source_id\":\"mini.mm\",\"text\":\"$c |- a $. ax $a |- a $. th $p |- a $= ax $.\"}]}",
  ))
}
```

`load` 返回数据库句柄，随后用同一实例调用 `verify`、`start` 等操作。完整原生 API、响应与会话约束见 [API.md](docs/API.md)。独立 workspace 消费者验收入口为 `node scripts/consumer.mjs`，注册表验收入口为 `node scripts/consumer.mjs --registry --version 0.1.1`；后者须在发布后运行。

JavaScript 宿主直接导入构建产物：

```js
import { dispatch_json } from './dist/moonmetamath-core.mjs';
const response = JSON.parse(dispatch_json(JSON.stringify({
  schema_version: 1, request_id: 'reset-1', operation: 'reset'
})));
console.log(response);
```

## 已完成的验证与边界

2026-10-23 的本地验收：

| 范围 | 实际结果 |
| --- | --- |
| 0.2 MoonBit 核心测试 | 55 项，在 JS 与 wasm-gc 后端通过 |
| 固定外部测试材料 | 79/79 符合预期：22 valid、55 invalid、2 incomplete |
| 独立 mmreference | 同一 79 项全部符合上游预期 |
| 官方小库 | demo0 1 个证明、MIU 1 个证明、HOL 151 个证明通过；peano 只有声明，0 个证明 |
| 0.2 保存恢复 | 11 项针对性宿主测试通过；核心及保存恢复独立审查通过 |
| 0.2 组合工作流 | 脚本实际完成规则查找、原子预览、新目标、部分恢复、完成和导出；候选文件由官方 C 接受 |
| 0.1.x 实际浏览器 | 本地及公网站点完成 demo0 34 步构造；公网下载文件由独立官方 C 接受；MIU/HOL、include 上传、BOM 拒绝、取消重载均实测。0.2规则预览、新目标、刷新/文件恢复、失败导入保留、2MiB回退和取消恢复实际通过 |
| 0.1.1 公开交付 | Windows/Linux CI、Mooncakes 0.1.1 manifest 成功、独立注册表消费者两后端实际运行；0.2 公开交付待完成 |

官方 C 对整套外部材料有 **7 项已记录分歧**，并非 79/79 全过；细节见 [兼容性](docs/COMPATIBILITY.md)。上述验证不等于完整 set.mm、所有 Metamath 扩展或所有平台兼容，也没有对实现本身作形式化认证。

运行开发检查：

```sh
node scripts/check.mjs
```

重新取得固定测试材料及独立检查器源码：

```sh
node scripts/fixtures.mjs fetch --profile october
```

该步骤需要网络和 C 编译器：Windows 使用已有 MSVC x86 环境，Linux 使用 gcc；Python 仅供独立参考测试。已有完整缓存时可追加 `--offline`。产品运行不依赖这些参考检查器。验收日志保存在本地 `artifacts/`；浏览器检查项见 [manual-checklist.md](tests/web/manual-checklist.md)。

当前支持标准 ASCII Metamath 输入、普通与压缩证明、文件集合 include，以及继承已有声明上下文的新目标。完整 set.mm 的容量/性能、自由新增公理或声明的编辑器、逆向 tactic、通用模型搜索、压缩导出和压缩 Replay 转普通证明尚未作为本版能力交付。默认额度及详细限制见 [COMPATIBILITY.md](docs/COMPATIBILITY.md)。

## 文档与来源

- [API](docs/API.md) · [操作场景与练习](docs/SCENARIOS.md) · [兼容性与限制](docs/COMPATIBILITY.md) · [更新记录](CHANGELOG.md)
- [第三方来源及许可](docs/THIRD_PARTY.md) · [固定测试清单](tests/fixtures/manifest.json)
- 项目实现采用 [MIT](LICENSE)；工具链安装脚本保留 Apache-2.0，第三方测试材料遵守各自许可。
- 原规划资料保留供追溯：[设计规格](DESIGN_AND_SCOPE.md)、[实施计划](IMPLEMENTATION_PLAN.md)、[参考资料](REFERENCES.md)、[验收设计](ACCEPTANCE.md)、[启动提示词](CLAUDE_CODE_PROMPT.md)。其中规划日期、排期与“待实施”叙述是历史背景；当前状态以 [PROGRESS.md](PROGRESS.md) 为准。
