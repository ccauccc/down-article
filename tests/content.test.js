import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const content = require("../extension/content");
const shared = require("../extension/shared");
const contentSource = readFileSync(path.resolve("extension/content.js"), "utf8");

function createDom(body, url = "https://mp.weixin.qq.com/s/demo") {
  return new JSDOM(`<!doctype html><html><body>${body}</body></html>`, { url });
}

function createDocument(body, url) {
  return createDom(body, url).window.document;
}

describe("content extraction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts title, metadata, source URL, body HTML, and localized images", () => {
    const documentRef = createDocument(`
      <h1 class="rich_media_title"> Demo Article </h1>
      <div id="js_name"> Demo Author </div>
      <em id="publish_time">2026-05-21</em>
      <div id="js_content">
        <section class="layout" style="text-align:center">
          <p>hello</p>
          <img data-src="//mmbiz.qpic.cn/one.jpg" width="640" height="320" style="max-width:100%;" alt="one">
          <img data-original="/two.png?token=1" data-src="" style="border:0">
          <img src="https://mmbiz.qpic.cn/three.webp">
          <img srcset="../four.gif 1x, https://mmbiz.qpic.cn/four@2x.gif 2x">
        </section>
      </div>
    `);

    const article = content.extractArticle(documentRef, "https://mp.weixin.qq.com/s/demo");

    expect(article.title).toBe("Demo Article");
    expect(article.author).toBe("Demo Author");
    expect(article.publishedAt).toBe("2026-05-21");
    expect(article.sourceUrl).toBe("https://mp.weixin.qq.com/s/demo");
    expect(article.images).toEqual([
      {
        sourceUrl: "https://mmbiz.qpic.cn/one.jpg",
        localPath: "images/img-001.jpg"
      },
      {
        sourceUrl: "https://mp.weixin.qq.com/two.png?token=1",
        localPath: "images/img-002.png"
      },
      {
        sourceUrl: "https://mmbiz.qpic.cn/three.webp",
        localPath: "images/img-003.webp"
      },
      {
        sourceUrl: "https://mp.weixin.qq.com/four.gif",
        localPath: "images/img-004.gif"
      }
    ]);
    expect(article.bodyHtml).toContain("<p>hello</p>");
    expect(article.bodyHtml).toContain('src="images/img-001.jpg"');
    expect(article.bodyHtml).toContain('src="images/img-002.png"');
    expect(article.bodyHtml).toContain('src="images/img-003.webp"');
    expect(article.bodyHtml).toContain('src="images/img-004.gif"');
    expect(article.bodyHtml).toContain('width="640"');
    expect(article.bodyHtml).toContain('height="320"');
    expect(article.bodyHtml).toContain('style="max-width:100%;"');
    expect(article.bodyHtml).toContain('loading="lazy"');
    expect(article.bodyHtml).not.toContain("data-src");
    expect(article.bodyHtml).not.toContain("data-original");
    expect(article.bodyHtml).not.toContain("srcset");
  });

  it("falls back from h1.rich_media_title to h2.rich_media_title", () => {
    const documentRef = createDocument(`
      <h2 class="rich_media_title"> Fallback Title </h2>
      <div id="js_content"><p>body</p></div>
    `);

    expect(content.extractArticle(documentRef, "https://mp.weixin.qq.com/s/demo").title).toBe("Fallback Title");
  });

  it("removes scripts from the cloned body", () => {
    const documentRef = createDocument(`
      <h1 class="rich_media_title">Scripted</h1>
      <div id="js_content">
        <p>safe</p>
        <script>alert("nope")</script>
      </div>
    `);

    const article = content.extractArticle(documentRef, "https://mp.weixin.qq.com/s/demo");

    expect(article.bodyHtml).toContain("<p>safe</p>");
    expect(article.bodyHtml).not.toContain("<script");
  });

  it("sanitizes dangerous article elements, event handlers, srcdoc, and javascript URLs", () => {
    const documentRef = createDocument(`
      <h1 class="rich_media_title">Malicious</h1>
      <div id="js_content">
        <p onclick="alert(1)" style="color:red" class="keep">safe</p>
        <a href=" JAVASCRIPT:alert(1) ">bad link</a>
        <form action="javascript:alert(1)"><button>bad form</button></form>
        <img data-src="//mmbiz.qpic.cn/safe.jpg" onerror="alert(1)" src="javascript:alert(2)">
        <svg onload="alert(1)"><circle></circle></svg>
        <iframe srcdoc="<script>alert(1)</script>" src="https://example.com"></iframe>
        <object data="https://example.com"></object>
        <embed src="https://example.com">
        <link rel="preload" href="https://example.com">
        <meta http-equiv="refresh" content="0">
        <base href="https://evil.example/">
        <script>alert("nope")</script>
      </div>
    `);

    const article = content.extractArticle(documentRef, "https://mp.weixin.qq.com/s/demo");
    const html = content.buildArticleHtml(article);

    expect(article.bodyHtml).toContain('style="color:red"');
    expect(article.bodyHtml).toContain('class="keep"');
    expect(article.bodyHtml).toContain('src="images/img-001.jpg"');
    expect(article.bodyHtml).not.toMatch(/\son[a-z]+\s*=/i);
    expect(article.bodyHtml).not.toMatch(/javascript:/i);
    expect(article.bodyHtml).not.toMatch(/srcdoc/i);
    expect(article.bodyHtml).not.toContain("<iframe");
    expect(article.bodyHtml).not.toContain("<script");
    expect(article.bodyHtml).not.toContain("<object");
    expect(article.bodyHtml).not.toContain("<embed");
    expect(article.bodyHtml).not.toContain("<link");
    expect(article.bodyHtml).not.toContain("<meta");
    expect(article.bodyHtml).not.toContain("<base");
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<script");
  });

  it("infers local image extensions from WeChat URL and DOM format hints", () => {
    const documentRef = createDocument(`
      <h1 class="rich_media_title">Images</h1>
      <div id="js_content">
        <img data-src="https://mmbiz.qpic.cn/mmbiz_jpg/foo?wx_fmt=png">
        <img data-src="https://mmbiz.qpic.cn/no-extension" data-type="webp">
        <img data-src="https://mmbiz.qpic.cn/type-hint" type="image/gif">
      </div>
    `);

    const article = content.extractArticle(documentRef, "https://mp.weixin.qq.com/s/demo");

    expect(article.images).toEqual([
      {
        sourceUrl: "https://mmbiz.qpic.cn/mmbiz_jpg/foo?wx_fmt=png",
        localPath: "images/img-001.png"
      },
      {
        sourceUrl: "https://mmbiz.qpic.cn/no-extension",
        localPath: "images/img-002.webp"
      },
      {
        sourceUrl: "https://mmbiz.qpic.cn/type-hint",
        localPath: "images/img-003.gif"
      }
    ]);
  });

  it("throws a clear error when article content is missing", () => {
    const documentRef = createDocument(`<h1 class="rich_media_title">Missing</h1>`);

    expect(() => content.extractArticle(documentRef, "https://mp.weixin.qq.com/s/demo")).toThrow(
      "Article content not found"
    );
  });

  it("builds complete offline HTML with escaped metadata, source link, CSS, and no scripts", () => {
    const html = content.buildArticleHtml({
      title: `Demo <Article>`,
      author: `Author & Co`,
      publishedAt: "2026-05-21",
      sourceUrl: "https://mp.weixin.qq.com/s/demo?x=1&y=2",
      bodyHtml: `<p>hello<img src="images/img-001.jpg"></p><script>alert(1)</script>`,
      images: []
    });

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<html lang=\"zh-CN\">");
    expect(html).toContain("<title>Demo &lt;Article&gt;</title>");
    expect(html).toContain("Author &amp; Co");
    expect(html).toContain("2026-05-21");
    expect(html).toContain('href="https://mp.weixin.qq.com/s/demo?x=1&amp;y=2"');
    expect(html).toContain("images/img-001.jpg");
    expect(html).toContain("<style>");
    expect(html).not.toContain("<script");
  });

  it("returns empty markdown and PDF strings when optional browser libraries are unavailable", async () => {
    await expect(content.buildMarkdown({ title: "Demo", bodyHtml: "<p>body</p>" })).resolves.toBe("");
    await expect(content.buildPdfBase64({ title: "Demo", bodyHtml: "<p>body</p>" })).resolves.toBe("");
  });

  it("builds markdown when TurndownService is available", async () => {
    class FakeTurndownService {
      constructor(options) {
        this.options = options;
      }

      turndown(html) {
        return `converted:${html}`;
      }
    }

    vi.stubGlobal("TurndownService", FakeTurndownService);

    await expect(content.buildMarkdown({ title: "Demo", bodyHtml: "<p>body</p>" })).resolves.toBe(
      "# Demo\n\nconverted:<p>body</p>\n"
    );
  });

  it("handles export requests using current document and requested companion format", async () => {
    const dom = createDom(`
      <h1 class="rich_media_title"> Demo Article </h1>
      <div id="js_name"> Demo Author </div>
      <div id="js_content"><p>body</p></div>
    `);
    class FakeTurndownService {
      turndown(html) {
        return html.replace(/<[^>]+>/g, "");
      }
    }

    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("TurndownService", FakeTurndownService);

    const payload = await content.handleExportRequest({ format: "markdown" });

    expect(payload.article.title).toBe("Demo Article");
    expect(payload.files.html).toContain("<!doctype html>");
    expect(payload.files.markdown).toContain("# Demo Article");
    expect(payload.files.pdfBase64).toBe("");
  });

  it("registers a Chrome runtime listener and responds asynchronously to export requests", async () => {
    const dom = createDom(`
      <h1 class="rich_media_title"> Runtime Article </h1>
      <div id="js_content"><p>runtime body</p></div>
    `);
    let registeredListener;
    const sandbox = {
      console,
      setTimeout,
      clearTimeout,
      WeChatArticleExporter: {
        shared
      },
      document: dom.window.document,
      window: dom.window,
      chrome: {
        runtime: {
          onMessage: {
            addListener(listener) {
              registeredListener = listener;
            }
          }
        }
      }
    };
    sandbox.globalThis = sandbox;

    vm.runInNewContext(contentSource, sandbox, { filename: "content.js" });

    const response = await new Promise((resolve) => {
      const returned = registeredListener(
        { type: "EXPORT_WECHAT_ARTICLE", format: "html" },
        {},
        resolve
      );

      expect(returned).toBe(true);
    });

    expect(response.ok).toBe(true);
    expect(response.payload.article.title).toBe("Runtime Article");
    expect(response.payload.files.html).toContain("<!doctype html>");
  });
});
