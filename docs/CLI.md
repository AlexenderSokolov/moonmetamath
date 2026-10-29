# CLI

运行 `node bin/moonmetamath.mjs --help` 查看当前命令。发行包只需 Node.js 24。

| 命令 | 输入与用途 |
| --- | --- |
| `verify FILE` | 验证数据库，读取 outcome 和完整性计数 |
| `list FILE` | 查询定理及原证明，保持旧输出格式 |
| `replay FILE --theorem LABEL` | 检查并回放指定定理 |
| `session FILE --theorem LABEL --actions FILE` | 执行动作后检查完成，可追加导出 |

公共选项为 `--format json|text`、`--root DIR`、`--timeout-ms N`。执行证明的命令支持 `--max-operations N`。session 的 `--export PATH` 指定新文件，`--new-label LABEL` 指定新定理名，省略时沿用 `moonmm-session-1`。处理以前导出的数据库时，应指定未使用的标签。

动作文件接受数组或 `{ "schema_version": 1, "actions": [...] }`。动作仅包含 apply_label 与字符串 label、rewind 与非负整数 successful_step_count，或无额外字段的 finish。文件整体校验后执行，最后由宿主调用 finish。

默认操作预算为 10,000,000，默认超时为 120,000 ms；超时可设为 1..300000。操作预算与时间上限分别生效。include 默认限定在入口目录，可用 --root 指定源目录。

| 退出码 | 意义 |
| --- | --- |
| 0 | 验证或构造完成，或查询成功 |
| 1 | 证明被拒绝 |
| 2 | 参数、编码、请求或声明结构错误 |
| 3 | 文件 IO、缺少源或构建产物 |
| 4 | 未完成、不支持或最终栈未达目标 |
| 5 | 资源限制或取消 |

逐步交互、分页摘要和新目标通过 [JSON API](API.md) 调用。
