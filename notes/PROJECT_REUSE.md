# MoonMetamath 规划与交接复用卡片

状态：2026-10-23，仅文档准备完成；无实现代码、Git、测试运行、用户采用、发布或赛事结果。

## 最小阅读路径

先读[PROJECT.md](../PROJECT.md)、[CLAUDE.md](../CLAUDE.md)与[PROGRESS.md](../PROGRESS.md)，再读[权威规格](../DESIGN_AND_SCOPE.md)、[实施任务](../IMPLEMENTATION_PLAN.md)、[验收](../ACCEPTANCE.md)。[完整启动提示](../CLAUDE_CODE_PROMPT.md)只在用户亲自发送后成为实施指令。

## 实际结构与复用内容

六份完整计划位于项目根；固定来源、规范、许可、七个commit和工具链参考见[REFERENCES.md](../REFERENCES.md)。没有源码模块可复用，只有已经完成的规格与交接决策。

值得复用的设计：公开目录/API排重与失败响应分离；parse/verify/可用前提分层；重做目标锚定原声明位置；普通/压缩/交互共用执行器；失败原子化；include按规范仅首次展开；普通导出限ApplyLabel构造会话；同步Worker的取消与重建边界。

已核实的旧环境只作快照，不当新项目构建证据。官方截止日期冲突保留，未以规划推断奖励。

## 迁移与验证

原六个文件从父目录`docs/superpowers/plans/2026-10-23-metamath-moonbit`逐文件移入；移动时内容校验一致，随后更新位置和阶段。旧位置仅留短指引，不再维护正文。根PROJECT/CLAUDE/PROGRESS由用户本次明确要求创建，T0–T12仍待实施。

本阶段检查仅覆盖文档链接、编号、权限和无实现文件；不代表Metamath语义、工具链、网页或发布已通过。

## 提示词来源

- 用户先要求：“你写好一个详细计划文档，拿参考资源、规划、验收步骤等等全流程详细的先规划好，我准备交给claude code去做。”
- 当前迁移要求：“把这些计划文档和交接提示放进 moonmetamath 独立目录，建好 PROJECT.md 和 CLAUDE.md，方便我直接让 Claude Code 接手，先别写实现代码。”
- CLAUDE_CODE_PROMPT是Codex根据上述讨论重构的未来模板，未启动Claude，无成功运行关联。不要把其中授权文字当作单纯读文件就获得的权限。
