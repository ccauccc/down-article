import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");
const zip = require("../extension/zip");
const zipSource = readFileSync(path.resolve("extension/zip.js"), "utf8");

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

  it("decodes base64 strings with browser atob when Buffer is unavailable", () => {
    const sandbox = {
      Uint8Array,
      atob(value) {
        return Buffer.from(value, "base64").toString("binary");
      },
      WeChatArticleExporter: {
        shared: {
          createExportReport() {
            return {};
          }
        }
      }
    };
    sandbox.globalThis = sandbox;

    vm.runInNewContext(zipSource, sandbox, { filename: "zip.js" });

    expect(
      sandbox.WeChatArticleExporter.zip.base64ToUint8Array(Buffer.from("browser", "utf8").toString("base64"))
    ).toEqual(new Uint8Array(Buffer.from("browser", "utf8")));
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

  it("reports ok images without data or localPath as failed and does not write them", async () => {
    const archive = await loadArticleZip({
      files: {
        markdown: "",
        pdfBase64: ""
      },
      images: [
        {
          sourceUrl: "https://mmbiz.qpic.cn/no-data.jpg",
          localPath: "images/img-001.jpg",
          ok: true
        },
        {
          sourceUrl: "https://mmbiz.qpic.cn/no-path.jpg",
          ok: true,
          data: new Uint8Array([4, 5, 6])
        }
      ]
    });
    const report = JSON.parse(await archive.file("export-report.json").async("text"));

    expect(archive.file("images/img-001.jpg")).toBeNull();
    expect(report).toMatchObject({
      imageTotal: 2,
      imageSucceeded: 0,
      imageFailed: 2,
      failures: [
        {
          url: "https://mmbiz.qpic.cn/no-data.jpg",
          localPath: "images/img-001.jpg",
          error: "Image data missing"
        },
        {
          url: "https://mmbiz.qpic.cn/no-path.jpg",
          localPath: "",
          error: "Unsafe image path"
        }
      ]
    });
  });

  it("rejects unsafe image paths before writing and reports them as failed", async () => {
    const archive = await loadArticleZip({
      files: {
        markdown: "",
        pdfBase64: ""
      },
      images: [
        {
          sourceUrl: "https://mmbiz.qpic.cn/traversal.jpg",
          localPath: "../evil.jpg",
          ok: true,
          data: new Uint8Array([1])
        },
        {
          sourceUrl: "https://mmbiz.qpic.cn/backslash.jpg",
          localPath: "images\\img-002.jpg",
          ok: true,
          data: new Uint8Array([2])
        },
        {
          sourceUrl: "https://mmbiz.qpic.cn/drive.jpg",
          localPath: "C:/tmp/img-003.jpg",
          ok: true,
          data: new Uint8Array([3])
        },
        {
          sourceUrl: "https://mmbiz.qpic.cn/outside.jpg",
          localPath: "other/img-004.jpg",
          ok: true,
          data: new Uint8Array([4])
        },
        {
          sourceUrl: "https://mmbiz.qpic.cn/control.jpg",
          localPath: "images/img-005\u0000.jpg",
          ok: true,
          data: new Uint8Array([5])
        },
        {
          sourceUrl: "https://mmbiz.qpic.cn/bad-ext.jpg",
          localPath: "images/img-006.exe",
          ok: true,
          data: new Uint8Array([6])
        },
        {
          sourceUrl: "https://mmbiz.qpic.cn/safe.webp",
          localPath: "images/img-007.webp",
          ok: true,
          data: new Uint8Array([7])
        }
      ]
    });
    const report = JSON.parse(await archive.file("export-report.json").async("text"));

    expect(archive.file("../evil.jpg")).toBeNull();
    expect(archive.file("images\\img-002.jpg")).toBeNull();
    expect(archive.file("C:/tmp/img-003.jpg")).toBeNull();
    expect(archive.file("other/img-004.jpg")).toBeNull();
    expect(archive.file("images/img-005\u0000.jpg")).toBeNull();
    expect(archive.file("images/img-006.exe")).toBeNull();
    await expect(archive.file("images/img-007.webp").async("uint8array")).resolves.toEqual(new Uint8Array([7]));
    expect(report.imageTotal).toBe(7);
    expect(report.imageSucceeded).toBe(1);
    expect(report.imageFailed).toBe(6);
    expect(report.failures).toEqual([
      {
        url: "https://mmbiz.qpic.cn/traversal.jpg",
        localPath: "../evil.jpg",
        error: "Unsafe image path"
      },
      {
        url: "https://mmbiz.qpic.cn/backslash.jpg",
        localPath: "images\\img-002.jpg",
        error: "Unsafe image path"
      },
      {
        url: "https://mmbiz.qpic.cn/drive.jpg",
        localPath: "C:/tmp/img-003.jpg",
        error: "Unsafe image path"
      },
      {
        url: "https://mmbiz.qpic.cn/outside.jpg",
        localPath: "other/img-004.jpg",
        error: "Unsafe image path"
      },
      {
        url: "https://mmbiz.qpic.cn/control.jpg",
        localPath: "images/img-005\u0000.jpg",
        error: "Unsafe image path"
      },
      {
        url: "https://mmbiz.qpic.cn/bad-ext.jpg",
        localPath: "images/img-006.exe",
        error: "Unsafe image path"
      }
    ]);
  });
});
