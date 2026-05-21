# WeChat Article Exporter

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4.svg)](extension/manifest.json)

[English](README.md) | 简体中文

WeChat Article Exporter 是一个 Chrome 扩展，用于将当前打开的微信公众号文章导出为本地 ZIP 归档。它适合个人归档、离线阅读、内容复盘等场景，重点是让文章正文和图片在离线状态下仍然可用。

当前版本聚焦单篇文章导出。HTML 是高保真优先格式，Markdown 和 PDF 是辅助导出格式。

## 功能特性

- 从浏览器工具栏导出当前 `mp.weixin.qq.com` 文章。
- 生成包含 `article.html`、`images/` 和 `export-report.json` 的 ZIP 文件。
- 尽量保留正文结构、内联样式和本地图片，便于离线 HTML 阅读。
- 支持 Markdown 和 PDF 辅助格式。
- 导出的 HTML 会移除脚本、事件处理器、`javascript:` URL 和高风险嵌入元素。
- 所有处理都在浏览器扩展本地完成，不上传文章内容或图片。
- 如果文章页早于扩展重载打开，导出时会自动注入内容脚本并重试。

## 导出结构

```text
article-title.zip
├─ article.html
├─ article.md          # 仅 Markdown 导出时生成
├─ article.pdf         # 仅 PDF 导出时生成
├─ export-report.json
└─ images/
   ├─ img-001.jpg
   ├─ img-002.png
   └─ ...
```

## 安装方式

项目当前以未打包 Chrome 扩展的方式使用。

```bash
npm install
npm run vendor
```

然后在 Chrome 中加载：

1. 打开 `chrome://extensions`。
2. 启用 **开发者模式**。
3. 点击 **加载已解压的扩展程序**。
4. 选择项目中的 `extension/` 目录。
5. 打开一篇微信公众号文章，例如 `https://mp.weixin.qq.com/s/...`。
6. 点击扩展图标，选择导出格式。

每次拉取新代码后，需要在 `chrome://extensions` 里重新加载扩展。

## 使用方式

1. 打开单篇微信公众号文章。
2. 点击 WeChat Article Exporter 扩展图标。
3. 选择 `HTML`、`Markdown` 或 `PDF`。
4. 点击 **导出**。
5. 保存生成的 ZIP 文件。

归档场景推荐使用 HTML 导出，因为它的视觉保真度最高。Markdown 和 PDF 更适合后续加工或快速分享，但视觉效果可能不如 HTML 精确。

## 隐私与安全

- 扩展不会把文章内容或图片上传到任何服务器。
- 图片请求限制在微信公众号文章和图片相关域名。
- 后台图片请求不携带凭据，避免任意带凭证请求。
- 写入归档前会对 HTML 做安全清理。
- ZIP 中的图片路径限制为 `images/img-XXX.ext` 格式。

本项目与腾讯或微信没有隶属关系。

## 开发

```bash
npm install
npm run vendor
npm test
```

常用验证命令：

```bash
npm run verify
node --check extension/background.js
node --check extension/content.js
node --check extension/popup.js
```

## 项目结构

```text
extension/
├─ manifest.json
├─ popup.html
├─ popup.css
├─ popup.js
├─ content.js
├─ background.js
├─ shared.js
├─ zip.js
└─ vendor/

tests/
├─ background.test.js
├─ content.test.js
├─ popup.test.js
├─ shared.test.js
└─ zip.test.js

docs/
└─ prd.md
```

## 手动验收清单

- 非微信页面会禁用导出。
- 微信非文章页面会禁用导出。
- 微信文章 HTML 导出可以下载 ZIP。
- ZIP 包含 `article.html`、`images/` 和 `export-report.json`。
- `article.html` 可离线打开，正文可读，图片来自本地目录。
- Markdown 和 PDF 会作为辅助格式生成。

## 后续计划

- 支持历史文章页批量导出。
- 支持图片 base64 内嵌的自包含 HTML。
- 支持自定义 Markdown front matter。
- 支持自定义 PDF 样式。
- 支持更多文章来源。

## 开源协议

本项目使用 [Apache License 2.0](LICENSE) 开源。
