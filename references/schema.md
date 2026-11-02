# knowledge.json 数据格式

完整可运行的最小实例见 ../assets/demo/knowledge.json，配套原文位于 ../assets/demo/corpus/s01.md。

顶层字段：

| 字段 | 内容 |
| --- | --- |
| title | 网页及课程标题 |
| library_id | 仅小写字母、数字和连字符；作为学习记录命名空间，更新同一课程时保持不变 |
| chapters | 章节名数组，下标0为全书概览，其余按实际章号排列 |
| lessons | 小节编号到标题的字典 |
| sources | 来源数组 |
| nodes | 知识卡数组 |
| edges | 学习关系数组 |

来源字段：id、name、original_path（仅相对路径或文件名，不带个人绝对路径）、text_file（相对工作目录，通常 corpus/s01.md）、chapters（覆盖章号）、kind（ppt/doc/pdf/md 等）。original_file 可选，为工作目录下原附件路径，例如 sources/s01.ppt；没有原附件时不展示下载入口，不伪造文件。

知识卡字段：id（小写字母数字下划线）、label、chapter（大于0且在 chapters 范围内）、lesson、summary、points（至少一项非空文字）、pitfall、question、answer、source_id、source_location、evidence。必要的例外和不确定性写进 summary/pitfall；evidence 是实际原文中的连续短片段，生成器会核对其存在，不支持拼接多个分散句子伪造原句。

关系字段：source、target（卡片 id）、relation、confidence（EXTRACTED/INFERRED/AMBIGUOUS）、rationale。不要连自己或悬空 id；无向同端点关系只保留一条显示线，多重解释写进 rationale。EXTRACTED 需有 source_id、source_location、evidence，且证据片段能在对应原文找到；INFERRED/AMBIGUOUS 说明推理理由，不能声称是原资料的显式引用。

不确定的知识点可先留在覆盖报告中，不强行创建看起来完整的卡片。所给页码、段落或题号须能由人回查；构建器验证证据文本存在，不代替人审核页码与生物学正确性。
