# 固定外部验证材料

`manifest.json` 是机器可读来源、原始文件 SHA-256、字节数和预期状态清单。原始 `.mm` 保持上游字节内容；没有改写 `$p`、证明或期望。

```text
node scripts/fixtures.mjs fetch --profile october
node scripts/fixtures.mjs fetch --profile october --offline
node scripts/oracle.mjs self-test --out artifacts/reference-self-test
node scripts/oracle.mjs fixtures --manifest tests/fixtures/manifest.json --out artifacts/reference-fixtures
node scripts/oracle.mjs verify --file path/to/candidate.mm --engine metamath-exe --out artifacts/reference-candidate
node scripts/oracle.mjs self-test --engine mmreference --out artifacts/reference-python-self-test
```

`fetch` 从固定 GitHub commit 的原始文件取得四个官方小库、完整 `mm-verifier-tests` 测试与辅助文件、选定 `metamath-test` 用例和两个 Python 参考实现，并在 `.references/metamath-exe/` 构建固定官方 C 源码。Linux 使用 `gcc`；Windows 使用现有 MSVC x86 编译器：官方 C 的指针存储依赖 `long` 宽度，Win64 MinGW 虽可编译，启动即失败。脚本通过 `where cl.exe` 定位现有 VC 环境，并用 x86 构建未修改的上游源码。不会全局安装工具，也不取得完整 `set.mm` 或 Git 历史。取得失败和编译失败会返回非零退出码。后续复用已锁定材料会校验本地 SHA-256；R6 与 C 文件另核对 Git blob 身份。

R6 的预期直接来自每文件 `should verify/error/warn` 标记，分别映射为 `valid/invalid/incomplete`。R5 的预期来自固定 `run-testsuite` 中的 `pass/fail`，延期的增强数据库逐项保留在 `exclusions`；不能据此声称 R5 所有数据库已覆盖。

`oracle` 先识别错误和未完成证明，再判断实际 `VERIFY PROOF *` 的完成输出。官方 C 可能在错误后仍输出概括成功句，故概括句本身不能判有效。每次执行均保存命令、固定版本、输入和工具哈希、退出码、原始 `stdout.txt`/`stderr.txt` 与解释结果。`self-test` 真实执行有效、无效和未知证明，三种状态都匹配才成功。C 与规范测试分歧会作为结果失败保存，不能用参考实现多数票代替规范。

`mmreference` 是第二参考引擎，使用 Python 执行；依据其逐文件 `verify/error/warn` 协议判断，不能仅依赖退出码。`mmverify.py` 同时保留在 `.references/mmverify/` 供源码对读，但未将其历史限制作为规范。

`--offline` 从 `.references/acquired.json` 读取已取得文件清单，逐个核对 SHA-256 后重新构建外部 C 工具，不作网络请求；任何材料缺失都失败。这个缓存记录位于忽略目录，不能替代分发清单中的固定上游来源。

许可按文件保留。官方仓库根 LICENSE 为 CC0；demo0、miu、hol 自身也有 CC0 声明；**peano.mm 及历史 peano-fixed.mm 的文件头仍声明 GPL**，不能由仓库级许可推断它们是 CC0。这两份材料由固定 URL 在运行时取得，排除提交和发布包；清单保留原声明和冲突。其他上游材料的原许可文件与文件头均保留。独立 C 参考实现为 GPL-2.0-or-later，仅作为外部进程使用，源码与二进制留在忽略的 `.references/`。
