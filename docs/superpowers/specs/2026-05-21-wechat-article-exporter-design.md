# WeChat Article Exporter Design

日期：2026-05-21

## 背景

项目目标是提供一个 Chrome 插件，用于在当前打开的微信公众号文章页一键导出文章。第一版聚焦单篇文章导出，优先保障 HTML 归档的图片完整性和文章主体排版保真。Markdown 和 PDF 保留为可选导出格式，但不作为第一版最高保真验收目标。

## 范围

第一版包含：

- 在 `mp.weixin.qq.com` 单篇文章页打开 popup。
- 用户选择 HTML、Markdown 或 PDF 导出格式。
- 默认以 HTML 高保真归档为核心能力。
- 导出 ZIP，包含 `article.html` 和 `images/`。
- 将正文图片下载到本地并改写 HTML 图片路径。
- 本地执行抓取、转换和打包，不上传用户数据。
- 显示导出进度、成功状态和错误提示。

第一版不包含：

- 批量导出历史文章。
- 设置页。
- 自定义模板。
- 保留微信页面外框、广告、推荐阅读、评论区或脚本交互。
- 保证 Markdown/PDF 与原文完全一致。

## 推荐方案

采用“页面 DOM 克隆 + 图片本地化 + ZIP 下载”的 Chrome Manifest V3 插件方案。

插件只保存公众号文章主体，而不是完整微信页面快照。这样可以在保留文章正文排版、图片和内联样式的同时，避免把微信运行时代码、广告、推荐内容和远端脚本混入离线归档。

## 插件结构

```text
wechat-article-exporter/
├─ manifest.json
├─ popup.html
├─ popup.js
├─ content.js
├─ background.js
├─ lib/
│  ├─ jszip.min.js
│  ├─ turndown.min.js
│  └─ html2pdf.bundle.min.js
└─ assets/
   └─ icon.png
```

## 组件职责

### Popup

`popup.html` 和 `popup.js` 负责用户界面：

- 检测当前 tab 是否是 `mp.weixin.qq.com` 页面。
- 提供 HTML、Markdown、PDF 格式选择。
- 提供导出按钮。
- 显示导出中、成功、失败和图片处理进度。
- 防止导出过程中重复点击。

UI 第一版保持极简，只包含格式选择、导出按钮、进度提示和错误提示。

### Content Script

`content.js` 负责文章识别与快照生成：

- 读取标题，优先使用 `h1.rich_media_title`，兼容 `h2.rich_media_title`。
- 读取正文，优先使用 `#js_content`。
- 读取作者、发布时间和当前页面 URL。
- 克隆正文 DOM。
- 保留正文节点的结构、内联样式、class、图片尺寸和布局标签。
- 扫描图片字段，包括 `src`、`data-src`、`data-original` 和 `srcset`。
- 生成待下载图片清单和初始 HTML 文档。

### Background

`background.js` 负责需要扩展权限支持的能力：

- 请求图片资源，降低页面上下文 CORS 限制影响。
- 将图片 Blob 写入 ZIP 的 `images/` 目录。
- 根据导出格式生成对应主文件。
- 使用 `chrome.downloads.download` 下载最终 ZIP。

## 导出流程

1. 用户在微信公众号文章页点击插件图标。
2. Popup 检查页面可导出状态。
3. 用户选择格式并点击导出。
4. Popup 向 content script 发送导出请求。
5. Content script 提取标题、正文、元信息和图片清单。
6. Background 下载图片，并为每张图片生成本地文件名。
7. Content script 或 background 将 HTML 中的图片地址改为 `images/img-001.jpg` 形式。
8. 根据用户选择生成 `article.html`、`article.md` 或 `article.pdf`。
9. JSZip 打包主文件、图片目录和必要的导出报告。
10. Chrome 下载 ZIP 到本地。

## HTML 保真策略

高保真定义为：文章主体内容、图片、主要排版、内联样式和常见富文本布局尽量保持一致。第一版不承诺保留微信页面外框、评论、广告、推荐阅读或依赖远端脚本的交互。

实现策略：

- 克隆 `#js_content`，避免重写正文结构。
- 保留节点上的 `style`、`class`、`width`、`height`、`data-*` 等有用属性。
- 图片统一本地化到 `images/`，HTML 使用相对路径。
- 输出 HTML 内包含基础 CSS，保障离线阅读宽度、字体、段落间距和图片自适应。
- 不保存或执行微信远端 JavaScript。
- 对无法下载的图片保留原始 URL，并记录到导出报告。

## ZIP 结构

HTML 导出：

```text
文章标题.zip
├─ article.html
├─ export-report.json
└─ images/
   ├─ img-001.jpg
   ├─ img-002.png
   └─ ...
```

Markdown 导出可以额外包含：

```text
article.md
```

PDF 导出可以额外包含：

```text
article.pdf
```

`export-report.json` 记录导出时间、原文 URL、图片总数、成功数量、失败数量和失败原因。若没有失败，也可以保留该文件用于归档追溯。

## 异常处理

- 非 `mp.weixin.qq.com` 页面：Popup 显示不可导出状态。
- 不是文章页：找不到 `#js_content` 时停止导出，并提示当前页面结构不支持。
- 标题缺失：使用 `wechat-article` 加时间戳作为文件名。
- 图片下载失败：不终止整个导出，保留远程 URL 并写入 `export-report.json`。
- 图片格式未知：优先根据 `Content-Type` 判断，其次使用 URL 后缀，最后使用 `.jpg` 兜底。
- 文件名非法字符：移除 Windows、macOS 和 Linux 不适合的字符，并截断过长标题。
- 大文章或多图片：显示处理进度，导出期间禁用按钮。

## 验收标准

- 在当前打开的 `mp.weixin.qq.com` 单篇文章页可以触发导出。
- Popup 可选择 HTML、Markdown 或 PDF 格式。
- 选择 HTML 后可以下载 ZIP。
- ZIP 包含 `article.html`、`images/` 和 `export-report.json`。
- `article.html` 离线打开后正文完整、图片可见、主要排版接近原文。
- HTML 中已成功下载的图片使用 `images/` 相对路径。
- 图片下载失败时导出不会崩溃，失败信息记录在 `export-report.json`。
- 插件不上传用户数据，不修改原网页正文。
- 文件名来自文章标题，并自动处理非法字符。

## 测试计划

- 使用至少 3 篇不同排版的公众号文章手动验证 HTML 导出效果。
- 验证含多图文章的图片本地化路径。
- 验证图片下载失败时 ZIP 仍能生成，报告内容正确。
- 验证非公众号页面和非文章页的错误提示。
- 验证标题含特殊字符时 ZIP 文件名合法。
- 验证导出过程中按钮禁用和进度状态展示。

## 后续扩展

- 批量导出历史文章。
- 自包含 HTML，将图片转为 base64。
- 自定义 Markdown front matter。
- 自定义 PDF 样式。
- 支持更多文章来源。
