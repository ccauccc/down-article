import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");
const zip = require("../extension/zip");

async function loadArticleZip(input) {
  const base64 = await zip.buildArticleZipBase64({
    JSZip,
    title: "Demo Article",
    sourceUrl: "https://mp.weixin.qq.com/s/demo",
    files: {
      html: "<!doctype html><p>hello</p>",
      markdown: "# Demo Article\n\nhello\n",
      pdfBase64: Buffer.from("%PDF-demo", "utf8").toString("base64"),
      ...input.files
    },
    images: input.images || [
      {
        sourceUrl: "https://mmbiz.qpic.cn/ok.jpg",
        localPath: "images/img-001.jpg",
        ok: true,
        data: new Uint8Array([1, 2, 3])
      },
      {
        sourceUrl: "https://mmbiz.qpic.cn/missing.jpg",
        localPath: "images/img-002.jpg",
        ok: false,
        error: "HTTP 403",
        data: new Uint8Array([9, 9, 9])
      }
    ]
  });

  return JSZip.loadAsync(base64, { base64: true });
}

describe("zip packaging", () => {
  it("decodes base64 strings to bytes", () => {
    expect(zip.base64ToUint8Array(Buffer.from("hello", "utf8").toString("base64"))).toEqual(
      new Uint8Array(Buffer.from("hello", "utf8"))
    );
  });

  it("builds a base64 ZIP with article files, successful images, and export report", async () => {
    const archive = await loadArticleZip({});

    expect(archive.file("article.html")).toBeTruthy();
    expect(archive.file("images/img-001.jpg")).toBeTruthy();
    expect(archive.file("images/img-002.jpg")).toBeNull();
    expect(archive.file("export-report.json")).toBeTruthy();
    expect(archive.file("article.md")).toBeTruthy();
    expect(archive.file("article.pdf")).toBeTruthy();

    await expect(archive.file("article.html").async("text")).resolves.toBe("<!doctype html><p>hello</p>");
    await expect(archive.file("article.md").async("text")).resolves.toBe("# Demo Article\n\nhello\n");
    await expect(archive.file("images/img-001.jpg").async("uint8array")).resolves.toEqual(new Uint8Array([1, 2, 3]));
    await expect(archive.file("article.pdf").async("uint8array")).resolves.toEqual(
      new Uint8Array(Buffer.from("%PDF-demo", "utf8"))
    );

    const report = JSON.parse(await archive.file("export-report.json").async("text"));
    expect(report).toMatchObject({
      sourceUrl: "https://mp.weixin.qq.com/s/demo",
      title: "Demo Article",
      imageTotal: 2,
      imageSucceeded: 1,
      imageFailed: 1,
      failures: [
        {
          url: "https://mmbiz.qpic.cn/missing.jpg",
          localPath: "images/img-002.jpg",
          error: "HTTP 403"
        }
      ]
    });
    expect(JSON.stringify(report)).not.toContain("data");
  });

  it("omits optional article.md and article.pdf when their inputs are empty", async () => {
    const archive = await loadArticleZip({
      files: {
        markdown: "",
        pdfBase64: ""
      }
    });

    expect(archive.file("article.html")).toBeTruthy();
    expect(archive.file("article.md")).toBeNull();
    expect(archive.file("article.pdf")).toBeNull();
  });
});
