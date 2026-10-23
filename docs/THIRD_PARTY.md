# 第三方来源与许可

MoonMetamath 自有代码采用 [MIT](../LICENSE)。以下为参考、改编脚本与外部测试材料的独立声明。固定版本、逐文件来源、字节数与 SHA-256 保存在 [tests/fixtures/manifest.json](../tests/fixtures/manifest.json)；工具链官方归档来源与哈希另见 [scripts/toolchain.lock.json](../scripts/toolchain.lock.json)。

## 数学检查实现参考：mmverify.py

主要移植参考为 [david-a-wheeler/mmverify.py](https://github.com/david-a-wheeler/mmverify.py/tree/63a2aa3815cd5bf67892dbfc7f2048cbb177524c)，固定 commit `63a2aa3815cd5bf67892dbfc7f2048cbb177524c`，MIT。原项目的 Raph Levien、David A. Wheeler 及其他贡献者版权保留；改编源文件中的说明与本节共同提供归属。

本产品中的词法/声明、普通与压缩证明、同时代换及不交变量验证在 MoonBit 中实现。运行时不启动 Python 检查器，也没有把 Python 结果用作产品的数学判定。上游原始参考取得后保存在忽略的 `.references/mmverify/`。

上游 MIT 许可文本：

```text
MIT License

Copyright (c) Raph Levien, David A. Wheeler, and the mmverify.py contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 工具链安装脚本：MoonPortCheck

`scripts/toolchain.mjs` 改编自 AlexenderSokolov/MoonPortCheck 的工具链安装脚本，沿用 **Apache-2.0**，文件头保留 SPDX 与来源说明。完整许可随项目保存在 [LICENSES/Apache-2.0.txt](../LICENSES/Apache-2.0.txt)。该例外仅适用于相关脚本及其改编内容；不能用根 MIT 覆盖它。

编译器与标准库是官方 MoonBit 归档，按锁定来源取得，不把它们重标为本项目 MIT。开发者应保留工具链发行包自带许可。

分发的 `dist/moonmetamath-core.mjs` 包含编译后的 MoonBit 标准库代码，标准库 `moonbitlang/core` 的 Apache-2.0 条款继续适用，完整许可在 `LICENSES/Apache-2.0.txt`。MoonBit 标准库来源和固定版本见工具链锁文件；编译器二进制本身不随 Node 发布包分发。

## 外部数据库与测试

| 来源 | 固定 commit | 用途与许可 |
| --- | --- | --- |
| [metamath/set.mm](https://github.com/metamath/set.mm/tree/b4c3130f3b8081e1e4a33b47321141359e3380ae) | `b4c3130f3b8081e1e4a33b47321141359e3380ae` | demo0、MIU、HOL 的文件自身声明 CC0；保留源文件声明与仓库 LICENSE |
| [LegionMammal978/mm-verifier-tests](https://github.com/LegionMammal978/mm-verifier-tests/tree/9b4165b8c9ac7a27c18dcf836c42979ca4b7a67f) | `9b4165b8c9ac7a27c18dcf836c42979ca4b7a67f` | 58 个语义用例、2 个 unknown 用例与独立 mmreference；CC0-1.0，保留 COPYING |
| [david-a-wheeler/metamath-test](https://github.com/david-a-wheeler/metamath-test/tree/5758bf781bab662d4b31c7f72ac4dedea74fcb0f) | `5758bf781bab662d4b31c7f72ac4dedea74fcb0f` | 选取小型测试与支持文件；仓库 MIT，Copyright (c) 2016 David A. Wheeler；逐文件可能另声明 CC0，保留原文 |

`peano.mm` 与历史 `peano-fixed.mm` 的文件头仍含 GPL 说明，与相应仓库级 CC0/MIT 声明冲突。本项目不把它们认定为 CC0：它们仅由固定获取脚本作为外部测试材料取得，已被 gitignore，**不提交、不随包分发、不由网页服务器提供**。manifest 保留文件级许可、仓库级许可与冲突说明；验收中“peano 0 个证明”不意味着其许可已获澄清。

## 独立官方 C 检查器

独立对照使用 [metamath/metamath-exe](https://github.com/metamath/metamath-exe/tree/9898f5d1bb27045d764dd01672862a1c2a3b4f5e)，固定 commit `9898f5d1bb27045d764dd01672862a1c2a3b4f5e`，**GPL-2.0-or-later**。源码与本地编译产物位于忽略的 `.references/metamath-exe/`，仅作为开发测试中的独立进程运行；没有链接进 MoonBit、CLI 或 Web 产品，也不随本项目包分发。

官方 C 的批量结果存在 7 项记录在案的上游分歧，见 [COMPATIBILITY.md](COMPATIBILITY.md)。浏览器实际导出的普通证明由该检查器接受。不得把“参考工具存在”或 READ 成功作为证明验证证据。

## 规范与项目定位

Metamath 语言规范与背景参考见原始 [REFERENCES.md](../REFERENCES.md)。Metamath、MoonBit 及上游项目名称属于各自作者/组织。本项目没有声称首创 Web 证明器、首创 AI 数学验证或得到上游背书；格式与语义兼容范围以实际测试为准。
