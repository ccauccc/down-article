# **PRD：微信公众号文章导出插件（多格式）**

**项目名称**：WeChat Article Exporter
**版本**：1.0
**日期**：2026-05-19

---

## **1. 项目背景**

微信公众号是内容创作和信息传播的重要平台，用户往往希望将文章内容下载到本地便于归档、离线阅读或二次加工。目前微信官方并不提供导出功能，用户通常依靠截图或第三方工具，但这些方式：

* 不支持保留原文章格式
* 图片和多媒体内容无法完整保存
* 批量保存效率低

因此，需要一个 **浏览器插件**，用户可以一键导出文章内容，并支持 Markdown、PDF、HTML 三种格式，以满足不同需求。

---

## **2. 产品目标**

1. 实现微信公众号文章内容抓取、格式转换、打包下载功能。
2. 支持 Markdown、PDF、HTML 三种导出格式。
3. 支持文章正文和图片的完整保存。
4. 界面简洁，操作一键完成，支持未来扩展批量导出。
5. 安全无上传，所有操作本地执行。

---

## **3. 用户群体**

* 内容创作者：保存自己或参考的公众号文章。
* 数据分析人员：批量抓取文章数据进行分析。
* 个人用户：离线阅读或归档收藏公众号文章。

---

## **4. 用户故事**

1. **单篇文章导出**

   * 用户在公众号文章页面点击插件图标
   * 弹出格式选择（Markdown / PDF / HTML）
   * 点击导出 → 自动下载 ZIP 包（文章 + 图片）

2. **未来批量导出（可选拓展）**

   * 用户在历史文章列表页选择多篇文章
   * 一键导出所选文章
   * 生成每篇文章独立 ZIP 包，或批量压缩

---

## **5. 功能需求**

| 功能          | 描述                    | 输入                         | 输出                   |
| ----------- | --------------------- | -------------------------- | -------------------- |
| 格式选择        | 用户选择导出格式              | Markdown / PDF / HTML      | 触发不同导出流程             |
| 导出 Markdown | 将文章 HTML 转换为 Markdown | 当前文章 DOM                   | Markdown 文件 + 图片 ZIP |
| 导出 PDF      | 将文章渲染为 PDF            | 当前文章 DOM                   | PDF 文件 + 图片 ZIP      |
| 导出 HTML     | 保存文章原始 HTML + 样式      | 当前文章 DOM                   | HTML 文件 + 图片 ZIP     |
| 图片抓取        | 自动下载文章中的图片            | `<img>` 标签 `src`           | ZIP 文件中的 images/     |
| 打包 ZIP      | 将文件及图片打包              | Markdown / PDF / HTML + 图片 | ZIP 文件下载             |
| 用户界面        | 弹出窗口可选择导出格式           | 点击插件按钮                     | 弹出操作选项               |

---

## **6. 非功能需求**

* 插件兼容 Chrome 最新版本。
* 全部操作本地执行，无上传行为。
* 处理大文章、图片数量多时保持性能稳定。
* 统一 ZIP 文件结构，便于归档管理。

---

## **7. UI/UX 设计**

### 7.1 Popup 界面

* **下拉菜单/单选按钮**：

  * Markdown 压缩包
  * PDF 压缩包
  * HTML 压缩包
* **导出按钮**：点击触发抓取和下载
* **未来拓展**：

  * 批量选择文章
  * 自定义导出模板（PDF 样式、Markdown 头信息）

### 7.2 文件结构

```text
article-title.zip
├─ article-title.md / .pdf / .html
└─ images/
    ├─ img1.jpg
    ├─ img2.jpg
    └─ ...
```

---

## **8. 数据流程**

1. 用户在公众号文章页点击插件 → 弹出导出界面
2. 用户选择导出格式 → `popup.js` 发送消息到 `content.js`
3. `content.js` 获取文章 DOM：

   * 标题：`h2.rich_media_title`
   * 正文：`#js_content`
   * 图片：`<img>` 标签 `src`
4. 根据格式执行转换：

   * **Markdown**：HTML -> Markdown → 打包 ZIP（含图片）
   * **PDF**：HTML -> PDF → 打包 ZIP（含图片）
   * **HTML**：抓取 HTML + 样式 → 打包 ZIP（含图片）
5. 使用 `FileSaver.js` 下载 ZIP 到本地

---

## **9. 技术方案**

### 9.1 插件结构

```text
wechat-article-export/
│
├─ manifest.json
├─ popup.html
├─ popup.js
├─ content.js
├─ lib/
│   ├─ turndown.min.js        # HTML -> Markdown
│   ├─ jszip.min.js           # ZIP 打包
│   ├─ FileSaver.min.js       # 文件下载
│   └─ html2pdf.bundle.min.js # HTML -> PDF
└─ icon.png
```

### 9.2 关键库

* **Turndown.js**：HTML → Markdown
* **html2pdf.js**：HTML → PDF
* **JSZip.js**：打包 ZIP
* **FileSaver.js**：下载文件

### 9.3 Manifest 配置 (Chrome v3)

```json
{
  "manifest_version": 3,
  "name": "WeChat Article Exporter",
  "version": "2.0",
  "permissions": ["activeTab", "downloads"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  },
  "content_scripts": [
    {
      "matches": ["*://mp.weixin.qq.com/*"],
      "js": [
        "lib/turndown.min.js",
        "lib/jszip.min.js",
        "lib/FileSaver.min.js",
        "lib/html2pdf.bundle.min.js",
        "content.js"
      ]
    }
  ]
}
```

---

## **10. 验收标准 (Acceptance Criteria)**

1. 点击插件 → 弹出导出界面可选择格式。
2. 选择格式 → 点击导出 → 正确抓取文章内容。
3. 图片正确下载并打包到 ZIP。
4. Markdown / PDF / HTML 文件在本地可正确打开，保留正文和图片。
5. 文件命名规范：文章标题为文件名，非法字符自动处理。
6. 插件不会修改网页内容或上传用户数据。

---

## **11. 后续扩展**

* 批量导出公众号历史文章
* 支持图片嵌入 Markdown/PDF（base64）
* 自定义导出模板（Markdown 头信息、PDF 样式）
* 支持多语言或国际化

---
