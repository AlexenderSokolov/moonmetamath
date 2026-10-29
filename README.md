# MoonMetamath

MoonBit 原生的 Metamath 验证与逐步证明执行库，供 agent 和程序通过 JSON API 调用。Node CLI 处理文件和动作批次，Web 工作台用于查看、调试和手动操作。三种入口共用同一个证明核心。

[在线工作台](https://alexendersokolov.github.io/moonmetamath/web/) · [发行包](https://github.com/AlexenderSokolov/moonmetamath/releases)

支持普通和压缩证明、作用域、不交变量检查、规则查询、步骤预览、撤回、新目标、保存恢复与普通证明导出。

## 运行

需要 Node.js 24。发行包包含编译后的核心，解压后可运行：

```sh
node bin/moonmetamath.mjs --help
node bin/moonmetamath.mjs verify tests/fixtures/upstream/set-mm/demo0.mm
```

源码构建使用固定工具链：

```sh
node scripts/toolchain.mjs install
node scripts/build.mjs
```

工具链为 compiler `v0.10.14+7d59c7ec9`、moon `0.1.20260920`。已有隔离环境可用 `MOONMETAMATH_TOOLCHAIN_HOME` 指定。构建支持 Windows x64 和 Linux x64。

## Shell 接入

```sh
node bin/moonmetamath.mjs theorems database.mm --offset 0 --limit 20
node bin/moonmetamath.mjs rules database.mm --theorem target --query ax --limit 20
node bin/moonmetamath.mjs stdio
```

stdio 按 JSONL 顺序接收完整 API 请求，同一进程保留数据库与会话。错误步骤后可 inspect 并继续；session 批次失败会返回动作索引、成功前缀与会话视图。协议、EOF、超时与退出码见 [CLI](docs/CLI.md)。

## JSON API

JavaScript 宿主为独立调用方创建 dispatcher：

```js
import { create_dispatcher } from './dist/moonmetamath-core.mjs';
const dispatch = create_dispatcher();
let serial = 0;
function call(operation, fields = {}) {
  const response = JSON.parse(dispatch(JSON.stringify({
    ...fields, schema_version: 1, request_id: String(++serial), operation,
  })));
  if (response.status !== 'ok') throw new Error(JSON.stringify(response.diagnostics));
  return response;
}
const loaded = call('load', {
  entry: 'mini.mm',
  sources: [{ source_id: 'mini.mm', text: '$c |- a $. ax $a |- a $. th $p |- a $= ax $.' }],
});
const database_id = loaded.data.database_id;
const report = call('verify', { database_id });
if (report.outcome !== 'valid') throw new Error(JSON.stringify(report));
console.log(call('theorems', { database_id, offset: 0, limit: 20 }).data);
call('unload_database', { database_id });
```

`status` 表示请求执行状态，`outcome` 表示证明结果。定理摘要使用 `theorems`，规则查询使用 `rules`。旧 `list` 保持返回原证明的行为。

构造顺序为 `load → verify → start → apply_label → finish → export → close_session`。MoonBit 根包提供 `Engine`、`new_engine`、`dispatch_engine`；旧 `dispatch_json` 保持兼容。字段、结果和错误约定见 [API](docs/API.md)。可执行的 [agent-client.mjs](examples/agent-client.mjs) 演示构造、错误恢复、incomplete 与预算处理，以及 finally 释放资源。

## CLI

命令默认输出 JSON：

```sh
node bin/moonmetamath.mjs verify database.mm --max-operations 100000000
node bin/moonmetamath.mjs session database.mm --theorem th --actions actions.json --export candidate.mm --new-label candidate
```

动作文件示例：

```json
{"schema_version":1,"actions":[{"operation":"apply_label","label":"ax"}]}
```

CLI 在受限 Worker 中运行，默认截止时间 120 秒，可用 `--timeout-ms` 调整。`--max-operations` 控制核心操作额度。导出不覆盖已有文件，`--new-label` 指定数据库内的新标签。参数和退出码见 [CLI](docs/CLI.md)。

## Web 工作台

源码目录运行 `node scripts/serve.mjs --port 4173`，打开 [本地工作台](http://127.0.0.1:4173/web/)。发行包可通过静态 HTTP 服务打开 `web/`。

加载数据库后可查询定理和规则、构造证明、查看原证明回放、保存工作文件或导出 `.mm`。定理面板每页显示 100 项，搜索覆盖整个数据库的标签和结论。取消会终止 Worker；继续时重新加载或恢复保存文件。

完整 set.mm 的既有验证与工作台记录见 [大库说明](docs/LARGE_WORKBENCH.md)，该规模输入需显式选择一亿操作预算。支持范围、默认额度和参考检查器差异见 [兼容性](docs/COMPATIBILITY.md)。

## 开发

```sh
node scripts/check.mjs
node scripts/browser-check.mjs
node scripts/package.mjs
```

浏览器测试使用锁定的 Playwright 开发依赖，首次运行需 `npm ci` 和 `npx playwright install chromium`。参考检查器准备方法见 [开发说明](PROJECT.md)。

[更新记录](CHANGELOG.md) · [第三方许可](docs/THIRD_PARTY.md) · [性能记录](docs/PERFORMANCE.md)

实现采用 MIT；工具链安装脚本和第三方材料按各自许可分发。
