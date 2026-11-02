# 工具与实施细节

## 环境

构建器使用 Python 3.10+。依赖固定在 requirements.txt：`python -m pip install -r requirements.txt`。已有合适的 graphifyy 环境时直接使用其解释器；不要重复改动系统环境。浏览器验收另外需要 Playwright 和 Chromium：`python -m pip install playwright`，`python -m playwright install chromium`，也可将已安装 Chromium 路径传给检查脚本 `--browser`。

示例命令中的 scripts 路径相对本 skill 根目录；实际调用需展开到安装目录。输出位置由当前用户指定，不能写死原作者的用户名、微信目录、磁盘和课件路径。

## 原文提取

intake.py 支持文件夹、单文件或 ZIP，接受 PPT/PPTX、DOC/DOCX、PDF、Markdown 和 TXT。按内容哈希去重；文件 ID 是本次输入的本地标识，不承诺跨两次不同输入保持一致。默认拒绝复用已有清单的输出目录，增量项目需先制定 ID 迁移方案以保护已有进度。

extract-office.ps1 需要 Windows 与桌面 Microsoft Office。它只处理已清单化的 Office 文件，且只读打开、禁用宏。没有 Office 时，用当前环境已安装且适用的文档提取工具，仍保留对应 source_id、文件名、页码/段落信息。不要强迫 Linux 用户安装 COM。

原项目的难点是部分课件正文在 EMF 矢量对象中，普通 TextFrame 提取会漏字。对空白或明显短缺页：先查看原图；可将旧 PPT 转为 PPTX 副本，再读取 OOXML 里的 a:t 与关联 EMF 的 EMR_EXTTEXTOUTW/EMR_EXTTEXTOUTA 文字。图片页需要 OCR/视觉核对。不要把转换文件覆盖原 PPT，或把 OCR 结果标成无误的原文。图示、嵌入公式及依图题保留原附件供查验。

PDF 要逐页保留定位，扫描 PDF 需要 OCR；DOCX 用段落或题号定位。Markdown/TXT 可复制到 corpus 并保留行号。自动提取只是开始，knowledge.json 的教学整理和完整覆盖必须由 agent 对照实际资料完成。

## 构建与更新

build.py 校验卡片、来源、证据片段、关系端点与安全的项目内相对路径，然后用 Graphify 导出并嵌入图谱。图谱依赖 vis-network 9.1.6 随包内嵌，构建时不从 CDN 拉脚本；缺失或 Graphify 导出格式不兼容时报错，不生成假成功页面。

assets/study.html、source_reader.js 与 native_* 文件来自原作者的生物学习知识库，自测和复习操作沿用真实实现。构建器替换标题、章节、课程名和进度命名空间，不包含原作者课件内容。图谱 communities 以当前教材章节分组；需要语义社区时可先在整理阶段根据资料设计并扩展，不将章节分组说成自动发现的新结论。

构建到新目录，审阅后再替换旧交付。进度按 library_id 区分，并保留知识卡 id 的稳定性；重建时改 id 会影响已保存记录。导入旧记录只合并当前库存在的 id。

验收脚本用临时浏览器上下文，不操作作者的真实学习记录。它生成 qa/summary.json 和桌面/手机截图；脚本通过之后仍需查看截图，避免只凭 DOM 断言认可布局。

## AI 问答扩展边界

原项目用 Python 标准库本机 HTTP 服务，先做标题/正文词片段检索，附相关知识卡、原文节选与有限轮历史给模型。166 个图谱节点规模下尚不必引入向量数据库；只有实际检索表现不够再评估。

本仓库基础生成器不自带 AI 按钮或服务器，避免离线页面出现不可用入口。用户要求时才增加，并实际测试：绑定 127.0.0.1、校验 Host/Origin、限制请求长度和历史、密钥不落盘、无网/无密钥有清楚反馈。必须先告知提问、历史与选中资料片段会发给所选供应商。

界面只展示真实请求的结果，不能预填答案冒充联通。只有检索来源时写‘本次检索参考’，不要写‘每句话都有出处’。AI 回答与原文、整理解释要分清。公开发布 skill 不意味着允许上传使用者的资料或调用收费 API。

## 来源

本流程根据作者 etasp 的本地生物必修1知识库提炼，包括去重保留同名单元卷不同版本、逐页溯源、离线图谱、自测和手动复习，并扩展到课程备考与聊天主题知识库。原项目的资料数量、课程和个人身份不作为使用者默认配置。聊天输入与边界见 [chat.md](chat.md)。第三方许可见 THIRD_PARTY_NOTICES.md。
