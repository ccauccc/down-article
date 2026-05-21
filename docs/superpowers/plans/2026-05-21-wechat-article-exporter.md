# WeChat Article Exporter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome Manifest V3 extension that exports the currently open WeChat public account article as a local ZIP, prioritizing high-fidelity `article.html + images/` output.

**Architecture:** Use a vanilla MV3 extension with a popup for user actions, a content script for article DOM extraction and HTML/PDF/Markdown generation, and a background service worker for image fetching, ZIP creation, and `chrome.downloads.download`. Keep reusable logic in small UMD-style helper files so the same code can run in Chrome and in Vitest.

**Tech Stack:** Chrome Manifest V3, vanilla JavaScript, JSZip, Turndown, html2pdf.js, Vitest, jsdom.

---

## File Structure

- Create `package.json`: npm scripts, runtime libraries, test dependencies.
- Create `scripts/copy-vendor.js`: copies minified browser bundles from `node_modules` into `extension/vendor/`.
- Create `extension/manifest.json`: MV3 extension definition, popup, background worker, content scripts, host permissions.
- Create `extension/popup.html`: placeholder first, then minimal format selector, export button, status region.
- Create `extension/popup.css`: compact popup styling.
- Create `extension/popup.js`: tab validation, message dispatch, progress display.
- Create `extension/shared.js`: UMD helper functions for filename safety, URL handling, image file naming, MIME extension inference, and report creation.
- Create `extension/content.js`: UMD article extraction helpers plus Chrome message handler.
- Create `extension/zip.js`: UMD ZIP helper used by background and tests.
- Create `extension/background.js`: MV3 service worker, image fetching, ZIP generation, download.
- Create `extension/vendor/.gitkeep`: keeps vendor directory present before install.
- Create `tests/shared.test.js`: unit tests for shared helpers.
- Create `tests/content.test.js`: jsdom tests for article extraction and HTML output.
- Create `tests/zip.test.js`: unit tests for ZIP/report creation.
- Modify `README.md`: installation, development, and manual verification instructions.

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `scripts/copy-vendor.js`
- Create: `extension/manifest.json`
- Create: `extension/popup.html`
- Create: `extension/background.js`
- Create: `extension/shared.js`
- Create: `extension/content.js`
- Create: `extension/vendor/.gitkeep`
- Modify: `README.md`

- [ ] **Step 1: Create the failing smoke test command**

Run:

```bash
npm test
```

Expected: FAIL because `package.json` does not exist.

- [ ] **Step 2: Add npm scripts and dependencies**

Create `package.json`:

```json
{
  "name": "wechat-article-exporter",
  "version": "0.1.0",
  "private": true,
  "description": "Chrome extension for exporting WeChat public account articles as local ZIP archives.",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "vendor": "node scripts/copy-vendor.js",
    "verify": "npm run vendor && npm test"
  },
  "dependencies": {
    "html2pdf.js": "^0.14.0",
    "jszip": "^3.10.1",
    "turndown": "^7.2.0"
  },
  "devDependencies": {
    "jsdom": "^24.1.3",
    "vitest": "^2.1.9"
  }
}
```

- [ ] **Step 3: Add vendor copy script**

Create `scripts/copy-vendor.js`:

```js
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const vendorDir = path.join(root, "extension", "vendor");

const files = [
  {
    from: path.join(root, "node_modules", "jszip", "dist", "jszip.min.js"),
    to: path.join(vendorDir, "jszip.min.js")
  },
  {
    from: path.join(root, "node_modules", "turndown", "dist", "turndown.js"),
    to: path.join(vendorDir, "turndown.js")
  },
  {
    from: path.join(root, "node_modules", "html2pdf.js", "dist", "html2pdf.bundle.min.js"),
    to: path.join(vendorDir, "html2pdf.bundle.min.js")
  }
];

fs.mkdirSync(vendorDir, { recursive: true });

for (const file of files) {
  if (!fs.existsSync(file.from)) {
    throw new Error(`Missing dependency bundle: ${file.from}. Run npm install first.`);
  }

  fs.copyFileSync(file.from, file.to);
  console.log(`Copied ${path.relative(root, file.to)}`);
}
```

- [ ] **Step 4: Add Manifest V3 config**

Create `extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "WeChat Article Exporter",
  "version": "0.1.0",
  "description": "Export the current WeChat public account article as a local ZIP archive.",
  "permissions": ["activeTab", "downloads"],
  "host_permissions": ["*://mp.weixin.qq.com/*"],
  "action": {
    "default_popup": "popup.html"
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["*://mp.weixin.qq.com/*"],
      "js": [
        "vendor/turndown.js",
        "vendor/html2pdf.bundle.min.js",
        "shared.js",
        "content.js"
      ],
      "run_at": "document_idle"
    }
  ]
}
```

- [ ] **Step 5: Add vendor directory marker**

Create `extension/vendor/.gitkeep` as an empty file so the unpacked extension directory shape is present before dependencies are installed.

- [ ] **Step 6: Add placeholder extension entry files**

Create `extension/popup.html`:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WeChat Article Exporter</title>
</head>
<body>
  <p>WeChat Article Exporter is initializing.</p>
</body>
</html>
```

Create `extension/background.js`:

```js
// Background export pipeline is implemented in a later task.
```

Create `extension/shared.js`:

```js
globalThis.WeChatArticleExporter = globalThis.WeChatArticleExporter || {};
```

Create `extension/content.js`:

```js
// Article extraction is implemented in a later task.
```

- [ ] **Step 7: Add README setup instructions**

Replace `README.md` with:

```markdown
# WeChat Article Exporter

Chrome extension for exporting the current WeChat public account article as a local ZIP archive.

## Development

```bash
npm install
npm run vendor
npm test
```

## Load In Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select the `extension/` directory.
5. Open a `https://mp.weixin.qq.com/...` article and click the extension icon.

## First Version Scope

- Single current article only.
- HTML export is the high-fidelity priority.
- ZIP output contains `article.html`, `images/`, and `export-report.json`.
- Markdown and PDF exports are best-effort companion formats.
- All processing happens locally in the browser extension.
```

- [ ] **Step 8: Install dependencies**

Run:

```bash
npm install
```

Expected: PASS with `node_modules` and `package-lock.json` created.

- [ ] **Step 9: Copy vendor bundles**

Run:

```bash
npm run vendor
```

Expected: PASS and prints copied paths for `jszip.min.js`, `turndown.js`, and `html2pdf.bundle.min.js`.

- [ ] **Step 10: Check runtime dependency audit**

Run:

```bash
npm audit --omit=dev
```

Expected: PASS with no runtime vulnerabilities. Dev-only Vitest/Vite audit warnings are handled separately and do not block the extension runtime scaffold.

- [ ] **Step 11: Run tests after scaffolding**

Run:

```bash
npm test
```

Expected: PASS with "No test files found" or Vitest equivalent empty-suite result. If Vitest exits non-zero because no tests exist, continue to Task 2 where the first tests are added.

- [ ] **Step 12: Commit scaffolding**

```bash
git add package.json package-lock.json scripts/copy-vendor.js extension/manifest.json extension/popup.html extension/background.js extension/shared.js extension/content.js extension/vendor/.gitkeep README.md
git commit -m "chore: scaffold chrome extension project"
```

---

## Task 2: Shared Utility Helpers

**Files:**
- Create: `extension/shared.js`
- Create: `tests/shared.test.js`

- [ ] **Step 1: Write failing shared helper tests**

Create `tests/shared.test.js`:

```js
const { describe, expect, it } = require("vitest");
const shared = require("../extension/shared");

describe("shared helpers", () => {
  it("sanitizes article titles into safe filenames", () => {
    expect(shared.sanitizeFileName(" A:/B* C? <D> | E ")).toBe("A-B C D E");
    expect(shared.sanitizeFileName("")).toMatch(/^wechat-article-\d{8}-\d{6}$/);
  });

  it("truncates very long filenames", () => {
    const value = shared.sanitizeFileName("测".repeat(200));
    expect(value.length).toBeLessThanOrEqual(80);
  });

  it("resolves protocol-relative and relative URLs", () => {
    expect(shared.resolveUrl("//mmbiz.qpic.cn/a.jpg", "https://mp.weixin.qq.com/s/x")).toBe("https://mmbiz.qpic.cn/a.jpg");
    expect(shared.resolveUrl("/cgi-bin/readtemplate", "https://mp.weixin.qq.com/s/x")).toBe("https://mp.weixin.qq.com/cgi-bin/readtemplate");
  });

  it("infers extensions from content type and URL", () => {
    expect(shared.extensionFromContentType("image/png", "")).toBe("png");
    expect(shared.extensionFromContentType("image/jpeg", "")).toBe("jpg");
    expect(shared.extensionFromContentType("", "https://example.com/a.webp?x=1")).toBe("webp");
    expect(shared.extensionFromContentType("", "https://example.com/no-extension")).toBe("jpg");
  });

  it("builds stable local image names", () => {
    expect(shared.localImageName(0, "image/png", "https://x/a")).toBe("images/img-001.png");
    expect(shared.localImageName(11, "", "https://x/a.gif")).toBe("images/img-012.gif");
  });

  it("creates export reports", () => {
    const report = shared.createExportReport({
      sourceUrl: "https://mp.weixin.qq.com/s/demo",
      title: "Demo",
      images: [
        { sourceUrl: "https://ok", localPath: "images/img-001.jpg", ok: true },
        { sourceUrl: "https://bad", localPath: "images/img-002.jpg", ok: false, error: "403" }
      ]
    });

    expect(report.title).toBe("Demo");
    expect(report.imageTotal).toBe(2);
    expect(report.imageSucceeded).toBe(1);
    expect(report.imageFailed).toBe(1);
    expect(report.failures[0].url).toBe("https://bad");
  });
});
```

- [ ] **Step 2: Run shared tests to verify failure**

Run:

```bash
npm test -- tests/shared.test.js
```

Expected: FAIL because `extension/shared.js` does not exist.

- [ ] **Step 3: Implement shared helpers**

Create `extension/shared.js`:

```js
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.WeChatArticleExporter = root.WeChatArticleExporter || {};
    root.WeChatArticleExporter.shared = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"]);

  function pad(value, width) {
    return String(value).padStart(width, "0");
  }

  function timestampForFile(date = new Date()) {
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1, 2),
      pad(date.getDate(), 2),
      "-",
      pad(date.getHours(), 2),
      pad(date.getMinutes(), 2),
      pad(date.getSeconds(), 2)
    ].join("");
  }

  function sanitizeFileName(value, fallbackDate) {
    const cleaned = String(value || "")
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\s-\s/g, "-");

    const fallback = `wechat-article-${timestampForFile(fallbackDate)}`;
    const safe = cleaned || fallback;
    return safe.slice(0, 80).trim() || fallback;
  }

  function resolveUrl(value, baseUrl) {
    if (!value) return "";
    try {
      return new URL(value, baseUrl).toString();
    } catch (_error) {
      return "";
    }
  }

  function extensionFromContentType(contentType, url) {
    const normalized = String(contentType || "").split(";")[0].trim().toLowerCase();
    const fromType = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/bmp": "bmp",
      "image/svg+xml": "svg"
    }[normalized];

    if (fromType) return fromType;

    try {
      const pathname = new URL(url || "https://example.invalid").pathname;
      const match = pathname.match(/\.([a-z0-9]+)$/i);
      const ext = match ? match[1].toLowerCase() : "";
      if (IMAGE_EXTENSIONS.has(ext)) return ext === "jpeg" ? "jpg" : ext;
    } catch (_error) {
      return "jpg";
    }

    return "jpg";
  }

  function localImageName(index, contentType, url) {
    return `images/img-${pad(index + 1, 3)}.${extensionFromContentType(contentType, url)}`;
  }

  function createExportReport({ sourceUrl, title, images }) {
    const failures = images
      .filter((image) => !image.ok)
      .map((image) => ({
        url: image.sourceUrl,
        localPath: image.localPath,
        error: image.error || "Unknown error"
      }));

    return {
      exportedAt: new Date().toISOString(),
      sourceUrl,
      title,
      imageTotal: images.length,
      imageSucceeded: images.length - failures.length,
      imageFailed: failures.length,
      failures
    };
  }

  return {
    createExportReport,
    extensionFromContentType,
    localImageName,
    resolveUrl,
    sanitizeFileName,
    timestampForFile
  };
});
```

- [ ] **Step 4: Run shared tests to verify pass**

Run:

```bash
npm test -- tests/shared.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit shared helpers**

```bash
git add extension/shared.js tests/shared.test.js
git commit -m "feat: add export shared helpers"
```

---

## Task 3: Article Extraction And HTML Generation

**Files:**
- Create: `tests/content.test.js`
- Create: `extension/content.js`

- [ ] **Step 1: Write failing article extraction tests**

Create `tests/content.test.js`:

```js
const { describe, expect, it } = require("vitest");
const { JSDOM } = require("jsdom");
const content = require("../extension/content");

function createDocument(html) {
  const dom = new JSDOM(html, { url: "https://mp.weixin.qq.com/s/demo" });
  return dom.window.document;
}

describe("content extraction", () => {
  it("extracts title, metadata, localized images, and article HTML", () => {
    const document = createDocument(`
      <h1 class="rich_media_title"> Demo Article </h1>
      <div id="js_name"> Demo Author </div>
      <em id="publish_time">2026-05-21</em>
      <div id="js_content">
        <section style="text-align:center">
          <p>hello</p>
          <img data-src="//mmbiz.qpic.cn/one.jpg" width="640" />
          <img src="https://mmbiz.qpic.cn/two.png" />
        </section>
      </div>
    `);

    const article = content.extractArticle(document, "https://mp.weixin.qq.com/s/demo");

    expect(article.title).toBe("Demo Article");
    expect(article.author).toBe("Demo Author");
    expect(article.publishedAt).toBe("2026-05-21");
    expect(article.images).toEqual([
      {
        sourceUrl: "https://mmbiz.qpic.cn/one.jpg",
        localPath: "images/img-001.jpg"
      },
      {
        sourceUrl: "https://mmbiz.qpic.cn/two.png",
        localPath: "images/img-002.png"
      }
    ]);
    expect(article.bodyHtml).toContain('src="images/img-001.jpg"');
    expect(article.bodyHtml).toContain('src="images/img-002.png"');
  });

  it("throws a clear error when article content is missing", () => {
    const document = createDocument(`<h1 class="rich_media_title">Missing</h1>`);
    expect(() => content.extractArticle(document, "https://mp.weixin.qq.com/s/demo")).toThrow("Article content not found");
  });

  it("builds a complete offline html document", () => {
    const html = content.buildArticleHtml({
      title: "Demo",
      author: "Author",
      publishedAt: "2026-05-21",
      sourceUrl: "https://mp.weixin.qq.com/s/demo",
      bodyHtml: "<p>hello<img src=\"images/img-001.jpg\"></p>"
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Demo</title>");
    expect(html).toContain("Author");
    expect(html).toContain("images/img-001.jpg");
    expect(html).not.toContain("<script");
  });
});
```

- [ ] **Step 2: Run content tests to verify failure**

Run:

```bash
npm test -- tests/content.test.js
```

Expected: FAIL because `extension/content.js` does not exist.

- [ ] **Step 3: Implement content extraction and message handler**

Create `extension/content.js`:

```js
(function (root, factory) {
  const shared = root.WeChatArticleExporter && root.WeChatArticleExporter.shared
    ? root.WeChatArticleExporter.shared
    : require("./shared");
  const api = factory(shared);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.WeChatArticleExporter = root.WeChatArticleExporter || {};
    root.WeChatArticleExporter.content = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (shared) {
  function text(selector, documentRef) {
    const element = documentRef.querySelector(selector);
    return element ? element.textContent.replace(/\s+/g, " ").trim() : "";
  }

  function imageSource(img, baseUrl) {
    const candidates = [
      img.getAttribute("data-src"),
      img.getAttribute("data-original"),
      img.getAttribute("src"),
      firstSrcsetUrl(img.getAttribute("srcset"))
    ];

    for (const candidate of candidates) {
      const resolved = shared.resolveUrl(candidate, baseUrl);
      if (resolved) return resolved;
    }

    return "";
  }

  function firstSrcsetUrl(srcset) {
    if (!srcset) return "";
    return srcset.split(",")[0].trim().split(/\s+/)[0] || "";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function extractArticle(documentRef, sourceUrl) {
    const content = documentRef.querySelector("#js_content");
    if (!content) {
      throw new Error("Article content not found");
    }

    const title = text("h1.rich_media_title", documentRef) || text("h2.rich_media_title", documentRef) || "wechat-article";
    const author = text("#js_name", documentRef) || text(".rich_media_meta_text", documentRef);
    const publishedAt = text("#publish_time", documentRef);
    const clone = content.cloneNode(true);
    const images = [];

    clone.querySelectorAll("img").forEach((img) => {
      const sourceUrlForImage = imageSource(img, sourceUrl);
      if (!sourceUrlForImage) return;

      const localPath = shared.localImageName(images.length, img.getAttribute("type") || "", sourceUrlForImage);
      images.push({ sourceUrl: sourceUrlForImage, localPath });

      img.setAttribute("src", localPath);
      img.removeAttribute("data-src");
      img.removeAttribute("data-original");
      img.removeAttribute("srcset");
      img.setAttribute("loading", "lazy");
    });

    clone.querySelectorAll("script").forEach((script) => script.remove());

    return {
      title,
      author,
      publishedAt,
      sourceUrl,
      bodyHtml: clone.innerHTML,
      images
    };
  }

  function buildArticleHtml(article) {
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(article.title)}</title>
  <style>
    body {
      margin: 0;
      background: #f6f7f9;
      color: #1f2329;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.75;
    }
    .page {
      max-width: 760px;
      margin: 0 auto;
      padding: 32px 18px 56px;
      background: #fff;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .article-title {
      margin: 0 0 12px;
      font-size: 24px;
      line-height: 1.35;
      font-weight: 700;
    }
    .article-meta {
      margin: 0 0 28px;
      color: #69707d;
      font-size: 14px;
    }
    .article-meta a {
      color: #576b95;
      text-decoration: none;
      word-break: break-all;
    }
    #js_content {
      overflow-wrap: anywhere;
    }
    #js_content img {
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <main class="page">
    <h1 class="article-title">${escapeHtml(article.title)}</h1>
    <p class="article-meta">
      ${escapeHtml([article.author, article.publishedAt].filter(Boolean).join(" · "))}
      ${article.sourceUrl ? ` · <a href="${escapeHtml(article.sourceUrl)}">原文链接</a>` : ""}
    </p>
    <article id="js_content">${article.bodyHtml}</article>
  </main>
</body>
</html>`;
  }

  async function buildMarkdown(article) {
    if (typeof TurndownService === "undefined") {
      return "";
    }

    const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
    return `# ${article.title}\n\n${turndown.turndown(article.bodyHtml)}\n`;
  }

  async function buildPdfBase64(article) {
    if (typeof html2pdf === "undefined") {
      return "";
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = buildArticleHtml(article);
    const blob = await html2pdf()
      .set({
        margin: 10,
        filename: "article.pdf",
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      })
      .from(wrapper)
      .outputPdf("blob");

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function handleExportRequest(message) {
    const article = extractArticle(document, window.location.href);
    const html = buildArticleHtml(article);
    const markdown = message.format === "markdown" ? await buildMarkdown(article) : "";
    const pdfBase64 = message.format === "pdf" ? await buildPdfBase64(article) : "";

    return {
      format: message.format,
      article,
      files: {
        html,
        markdown,
        pdfBase64
      }
    };
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || message.type !== "EXPORT_WECHAT_ARTICLE") return false;

      handleExportRequest(message)
        .then((payload) => sendResponse({ ok: true, payload }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));

      return true;
    });
  }

  return {
    buildArticleHtml,
    buildMarkdown,
    buildPdfBase64,
    extractArticle,
    handleExportRequest
  };
});
```

- [ ] **Step 4: Run content tests to verify pass**

Run:

```bash
npm test -- tests/content.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit content extraction**

```bash
git add extension/content.js tests/content.test.js
git commit -m "feat: extract wechat article content"
```

---

## Task 4: ZIP Packaging And Export Report

**Files:**
- Create: `extension/zip.js`
- Create: `tests/zip.test.js`

- [ ] **Step 1: Write failing ZIP tests**

Create `tests/zip.test.js`:

```js
const { describe, expect, it } = require("vitest");
const JSZip = require("jszip");
const zipHelper = require("../extension/zip");

describe("zip packaging", () => {
  it("builds a zip with html, images, and report", async () => {
    const base64 = await zipHelper.buildArticleZipBase64({
      JSZip,
      title: "Demo",
      sourceUrl: "https://mp.weixin.qq.com/s/demo",
      files: {
        html: "<!doctype html><p>Hello</p>",
        markdown: "",
        pdfBase64: ""
      },
      images: [
        {
          sourceUrl: "https://example.com/a.jpg",
          localPath: "images/img-001.jpg",
          ok: true,
          data: new Uint8Array([1, 2, 3])
        }
      ]
    });

    const loaded = await JSZip.loadAsync(Buffer.from(base64, "base64"));
    expect(loaded.file("article.html")).toBeTruthy();
    expect(loaded.file("images/img-001.jpg")).toBeTruthy();
    expect(loaded.file("export-report.json")).toBeTruthy();
  });

  it("includes markdown and pdf when present", async () => {
    const base64 = await zipHelper.buildArticleZipBase64({
      JSZip,
      title: "Demo",
      sourceUrl: "https://mp.weixin.qq.com/s/demo",
      files: {
        html: "<!doctype html><p>Hello</p>",
        markdown: "# Hello",
        pdfBase64: Buffer.from("pdf").toString("base64")
      },
      images: []
    });

    const loaded = await JSZip.loadAsync(Buffer.from(base64, "base64"));
    expect(await loaded.file("article.md").async("string")).toBe("# Hello");
    expect(await loaded.file("article.pdf").async("uint8array")).toEqual(new Uint8Array([112, 100, 102]));
  });
});
```

- [ ] **Step 2: Run ZIP tests to verify failure**

Run:

```bash
npm test -- tests/zip.test.js
```

Expected: FAIL because `extension/zip.js` does not exist.

- [ ] **Step 3: Implement ZIP helper**

Create `extension/zip.js`:

```js
(function (root, factory) {
  const shared = root.WeChatArticleExporter && root.WeChatArticleExporter.shared
    ? root.WeChatArticleExporter.shared
    : require("./shared");
  const api = factory(shared);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.WeChatArticleExporter = root.WeChatArticleExporter || {};
    root.WeChatArticleExporter.zip = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (shared) {
  function base64ToUint8Array(value) {
    if (!value) return new Uint8Array();

    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(value, "base64"));
    }

    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  async function buildArticleZipBase64({ JSZip, title, sourceUrl, files, images }) {
    const zip = new JSZip();
    const imageResults = images.map((image) => ({
      sourceUrl: image.sourceUrl,
      localPath: image.localPath,
      ok: Boolean(image.ok),
      error: image.error || ""
    }));

    zip.file("article.html", files.html || "");

    if (files.markdown) {
      zip.file("article.md", files.markdown);
    }

    if (files.pdfBase64) {
      zip.file("article.pdf", base64ToUint8Array(files.pdfBase64));
    }

    for (const image of images) {
      if (image.ok && image.data) {
        zip.file(image.localPath, image.data);
      }
    }

    zip.file(
      "export-report.json",
      JSON.stringify(shared.createExportReport({ sourceUrl, title, images: imageResults }), null, 2)
    );

    return zip.generateAsync({ type: "base64" });
  }

  return {
    base64ToUint8Array,
    buildArticleZipBase64
  };
});
```

- [ ] **Step 4: Run ZIP tests to verify pass**

Run:

```bash
npm test -- tests/zip.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit ZIP helper**

```bash
git add extension/zip.js tests/zip.test.js
git commit -m "feat: package article export zip"
```

---

## Task 5: Background Export Pipeline

**Files:**
- Create: `extension/background.js`

- [ ] **Step 1: Add background worker implementation**

Create `extension/background.js`:

```js
importScripts("vendor/jszip.min.js", "shared.js", "zip.js");

async function fetchImage(image) {
  try {
    const response = await fetch(image.sourceUrl, {
      credentials: "include",
      cache: "force-cache"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    return {
      ...image,
      ok: true,
      data: new Uint8Array(buffer)
    };
  } catch (error) {
    return {
      ...image,
      ok: false,
      error: error.message
    };
  }
}

async function downloadBase64Zip(base64, filename) {
  await chrome.downloads.download({
    url: `data:application/zip;base64,${base64}`,
    filename,
    saveAs: true,
    conflictAction: "uniquify"
  });
}

async function exportArticle(payload) {
  const imageResults = await Promise.all(payload.article.images.map(fetchImage));
  const zipBase64 = await WeChatArticleExporter.zip.buildArticleZipBase64({
    JSZip,
    title: payload.article.title,
    sourceUrl: payload.article.sourceUrl,
    files: payload.files,
    images: imageResults
  });
  const filename = `${WeChatArticleExporter.shared.sanitizeFileName(payload.article.title)}.zip`;

  await downloadBase64Zip(zipBase64, filename);

  return {
    imageTotal: imageResults.length,
    imageFailed: imageResults.filter((image) => !image.ok).length
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "DOWNLOAD_WECHAT_ARTICLE_ZIP") return false;

  exportArticle(message.payload)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
```

- [ ] **Step 2: Run automated tests**

Run:

```bash
npm test
```

Expected: PASS for shared, content, and ZIP tests.

- [ ] **Step 3: Copy vendor bundles**

Run:

```bash
npm run vendor
```

Expected: PASS and `extension/vendor/` contains all three browser bundles.

- [ ] **Step 4: Commit background pipeline**

```bash
git add extension/background.js extension/vendor/jszip.min.js extension/vendor/turndown.js extension/vendor/html2pdf.bundle.min.js
git commit -m "feat: add background export pipeline"
```

---

## Task 6: Popup UI And User Flow

**Files:**
- Create: `extension/popup.html`
- Create: `extension/popup.css`
- Create: `extension/popup.js`

- [ ] **Step 1: Add popup markup**

Create `extension/popup.html`:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WeChat Article Exporter</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <main class="popup">
    <h1>文章导出</h1>
    <fieldset class="format-group">
      <legend>导出格式</legend>
      <label><input type="radio" name="format" value="html" checked> HTML 压缩包</label>
      <label><input type="radio" name="format" value="markdown"> Markdown 压缩包</label>
      <label><input type="radio" name="format" value="pdf"> PDF 压缩包</label>
    </fieldset>
    <button id="exportButton" type="button">导出</button>
    <p id="status" role="status" aria-live="polite">打开公众号文章后即可导出。</p>
  </main>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Add popup styles**

Create `extension/popup.css`:

```css
* {
  box-sizing: border-box;
}

body {
  width: 280px;
  margin: 0;
  color: #1f2329;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #ffffff;
}

.popup {
  padding: 16px;
}

h1 {
  margin: 0 0 14px;
  font-size: 18px;
  line-height: 1.3;
}

.format-group {
  display: grid;
  gap: 8px;
  margin: 0 0 14px;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 8px;
  color: #69707d;
  font-size: 12px;
}

label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  font-size: 14px;
}

button {
  width: 100%;
  min-height: 36px;
  border: 0;
  border-radius: 6px;
  background: #1677ff;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

#status {
  min-height: 36px;
  margin: 12px 0 0;
  color: #69707d;
  font-size: 12px;
  line-height: 1.5;
}

#status.error {
  color: #c5221f;
}

#status.success {
  color: #137333;
}
```

- [ ] **Step 3: Add popup behavior**

Create `extension/popup.js`:

```js
const exportButton = document.getElementById("exportButton");
const statusEl = document.getElementById("status");

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = type || "";
}

function selectedFormat() {
  const input = document.querySelector('input[name="format"]:checked');
  return input ? input.value : "html";
}

async function currentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function isWeChatArticleUrl(url) {
  try {
    return new URL(url).hostname === "mp.weixin.qq.com";
  } catch (_error) {
    return false;
  }
}

async function sendMessageToTab(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

async function sendMessageToBackground(message) {
  return chrome.runtime.sendMessage(message);
}

async function initialize() {
  const tab = await currentTab();
  if (!tab || !isWeChatArticleUrl(tab.url)) {
    exportButton.disabled = true;
    setStatus("当前页面不是微信公众号文章。", "error");
    return;
  }

  exportButton.disabled = false;
  setStatus("选择格式后点击导出。");
}

async function exportCurrentArticle() {
  exportButton.disabled = true;
  setStatus("正在读取文章内容...");

  try {
    const tab = await currentTab();
    const extraction = await sendMessageToTab(tab.id, {
      type: "EXPORT_WECHAT_ARTICLE",
      format: selectedFormat()
    });

    if (!extraction || !extraction.ok) {
      throw new Error(extraction && extraction.error ? extraction.error : "文章读取失败");
    }

    setStatus(`正在下载图片并打包，共 ${extraction.payload.article.images.length} 张图片...`);

    const result = await sendMessageToBackground({
      type: "DOWNLOAD_WECHAT_ARTICLE_ZIP",
      payload: extraction.payload
    });

    if (!result || !result.ok) {
      throw new Error(result && result.error ? result.error : "ZIP 下载失败");
    }

    const failed = result.result.imageFailed;
    setStatus(failed ? `导出完成，${failed} 张图片下载失败，已写入报告。` : "导出完成。", failed ? "" : "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    const tab = await currentTab();
    exportButton.disabled = !tab || !isWeChatArticleUrl(tab.url);
  }
}

exportButton.addEventListener("click", exportCurrentArticle);
initialize();
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit popup UI**

```bash
git add extension/popup.html extension/popup.css extension/popup.js
git commit -m "feat: add export popup"
```

---

## Task 7: Final Verification And Polish

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm run verify
```

Expected: PASS. Vendor bundles are copied and all Vitest tests pass.

- [ ] **Step 2: Load extension manually**

Open Chrome and load `extension/` as an unpacked extension from `chrome://extensions`.

Expected: Chrome accepts the extension without manifest errors.

- [ ] **Step 3: Verify non-WeChat page behavior**

Open `https://example.com`, click the extension icon.

Expected: popup disables export and shows `当前页面不是微信公众号文章。`.

- [ ] **Step 4: Verify HTML export on a WeChat article**

Open a single article under `https://mp.weixin.qq.com/`, select `HTML 压缩包`, click export, and save the ZIP.

Expected:

- ZIP filename is based on the article title.
- ZIP contains `article.html`, `export-report.json`, and `images/`.
- `article.html` opens offline.
- Main article text and images are visible.
- Successfully fetched images use `images/img-XXX.ext` relative paths.

- [ ] **Step 5: Verify Markdown export**

On the same article, select `Markdown 压缩包`, click export, and save the ZIP.

Expected:

- ZIP contains `article.html`, `article.md`, `export-report.json`, and `images/`.
- `article.md` contains the article title and body text.
- Markdown image references point at `images/`.

- [ ] **Step 6: Verify PDF export**

On the same article, select `PDF 压缩包`, click export, and save the ZIP.

Expected:

- ZIP contains `article.html`, `article.pdf`, `export-report.json`, and `images/`.
- `article.pdf` opens locally.
- PDF is readable, even if it is less visually exact than `article.html`.

- [ ] **Step 7: Update README with verification notes**

Append to `README.md`:

```markdown

## Manual Verification Checklist

- Non-WeChat pages disable export.
- WeChat article HTML export downloads a ZIP.
- ZIP includes `article.html`, `images/`, and `export-report.json`.
- `article.html` opens offline and keeps the article body readable with local images.
- Markdown and PDF exports are companion formats and may be less visually exact than HTML.
```

- [ ] **Step 8: Commit verification docs**

```bash
git add README.md
git commit -m "docs: add extension verification checklist"
```

---

## Self-Review

- Spec coverage: The plan covers single-page `mp.weixin.qq.com` export, HTML-first fidelity, local image storage, ZIP output, popup UI, no upload behavior, error reporting, and Markdown/PDF companion formats.
- Scope control: Batch export, settings, custom templates, base64 HTML, and more sources remain out of scope.
- Test coverage: Shared utilities, article extraction, HTML generation, ZIP packaging, and export reports have automated tests. Extension loading and actual WeChat image fetching require manual Chrome verification.
- Known implementation risk: Some WeChat image URLs may require cookies or referrer behavior. The background fetch uses `credentials: "include"` and records failures instead of blocking the export.
