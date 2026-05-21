import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const shared = require("../extension/shared");

describe("shared helpers", () => {
  it("sanitizes article titles into safe filenames", () => {
    expect(shared.sanitizeFileName(" A:/B* C? <D> | E ")).toBe("A-B C D E");
    expect(shared.sanitizeFileName("")).toMatch(/^wechat-article-\d{8}-\d{6}$/);
  });

  it("truncates very long filenames", () => {
    const value = shared.sanitizeFileName("\u6d4b".repeat(200));
    expect(value.length).toBeLessThanOrEqual(80);
  });

  it("avoids Windows reserved basenames", () => {
    expect(shared.sanitizeFileName("CON")).toBe("CON-article");
    expect(shared.sanitizeFileName("lpt9")).toBe("lpt9-article");
    expect(shared.sanitizeFileName("COM1.txt")).toBe("COM1-article.txt");
  });

  it("truncates filenames to 80 UTF-8 bytes without splitting surrogate pairs", () => {
    const value = shared.sanitizeFileName("\u{1f4a1}".repeat(100));

    expect(Buffer.byteLength(value, "utf8")).toBeLessThanOrEqual(80);
    expect(value).not.toContain("\ufffd");
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

  it("normalizes malformed image report entries as failures", () => {
    const report = shared.createExportReport({
      images: [null]
    });

    expect(report.imageTotal).toBe(1);
    expect(report.imageSucceeded).toBe(0);
    expect(report.imageFailed).toBe(1);
    expect(report.failures[0]).toEqual({
      url: "",
      localPath: "",
      error: "Invalid image entry"
    });
  });
});
