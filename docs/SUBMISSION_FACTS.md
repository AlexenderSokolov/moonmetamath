# MoonMetamath 报名与长期评选事实材料

这是AI辅助整理的事实清单，不是已提交申请，也不冒称主办方要求的人工撰写申报书。最终人工简介可以据此自行撰写；公开技术材料已经具备可点击的产品、源码、包与验收证据。

## 项目名称和一句话功能

MoonMetamath：MoonBit原生Metamath证明验证与逐步执行库。用户可以直接检查.mm文件、在网页从空栈重做定理、观察每一步代换和栈变化，并导出由独立检查器复核的证明文件。

## 三个可实际演示的场景

1. 学习形式证明：打开网页加载demo0，从活动假设与断言开始构造th1，错误标签会报错且不改变状态，可以撤回和重新开始；原证明回放有单独界面。
2. 程序化证明动作检查：外部程序通过公共JSON接口或CLI动作文件逐步提交apply_label，完成后导出.mm，再用官方C检查器独立验证。现已附真实模型补全固定10题实验：策略只看目标/规则/栈，无原证明输入，模型10/10、有限搜索8/10，全部成功经独立C复核；这是小题功能验证，不是标准评测优势。
3. 真实库批量验证：CLI/网页检查MIU和HOL固定库，HOL151个证明通过；库作者可从Mooncakes安装公共MoonBit入口。

## 差异与价值边界

10/23公开MoonBit生态排重未发现直接Metamath实现，详见REFERENCES；无法据此担保未索引或私有项目不存在。其他语言的Metamath工具是移植参照和独立兼容验证来源，不宣称全球首创。价值在MoonBit原生可复用核心、共享检查语义与可直接使用的CLI/网页。

真实潜在用户是MoonBit库开发者、形式证明学习者和AI4Math接口开发者；当前尚无外部人类试用反馈。不能把AI自主证明、完整Lean移植、新数学定理或已有人采用写进简介。

## 可核验材料

- 源码：https://github.com/AlexenderSokolov/moonmetamath
- 演示：https://alexendersokolov.github.io/moonmetamath/web/
- 发布：https://github.com/AlexenderSokolov/moonmetamath/releases
- 包：https://mooncakes.io/docs/AlexenderSokolov/moonmetamath
- CI：https://github.com/AlexenderSokolov/moonmetamath/actions
- 55核心测试两后端、39宿主集成、79固定外部样例、独立C四库与导出候选，详细数字以PROGRESS及正式Release为准。

## 长期维护里程碑

第一阶段完善格式兼容并收集真实下游接入问题；第二阶段建立完整set.mm容量/速度/内存基线，依据瓶颈决定增量验证；第三阶段的薄模型适配器与首次真实补全闭环已完成；后续以真实使用反馈和更有代表性的任务扩展为依据，不将小题成功冒称新数学发现。无需先扩建通用Agent平台。

## 尚未发生的赛事事件

MoonMetamath报名、初审、正式验收与获奖均须真实回执才能记录。官网十月底日期与旧章程文字冲突保留，不承诺资格。旧MoonPortCheck驳回不能当本项目回执。技术发布成功不等于奖励已到手。
