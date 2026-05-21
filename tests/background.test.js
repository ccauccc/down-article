import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const backgroundSource = readFileSync(path.resolve("extension/background.js"), "utf8");

function createSandbox(options = {}) {
  const downloadsDownload = vi.fn(() => Promise.resolve(1));
  const fetchImpl = options.fetch || vi.fn();
  const normalizeImageResults = options.normalizeImageResults || vi.fn((images) => images);
  const buildArticleZipBase64 = vi.fn(async () => "zip-base64");
  const sandbox = {
    Uint8Array,
    URL,
    fetch: fetchImpl,
    chrome: {
      downloads: {
        download: downloadsDownload
      },
      runtime: {
        onMessage: {
          addListener(listener) {
            sandbox.messageListener = listener;
          }
        }
      }
    },
    importScripts() {
      sandbox.JSZip = function JSZip() {};
      sandbox.WeChatArticleExporter = {
        shared: {
          sanitizeFileName(value) {
            return String(value || "article");
          }
        },
        zip: {
          buildArticleZipBase64,
          normalizeImageResults
        }
      };
    }
  };
  sandbox.globalThis = sandbox;

  vm.runInNewContext(backgroundSource, sandbox, { filename: "background.js" });

  return {
    buildArticleZipBase64,
    downloadsDownload,
    fetchImpl,
    normalizeImageResults,
    sandbox
  };
}

function articlePayload(images) {
  return {
    article: {
      title: "Demo",
      sourceUrl: "https://mp.weixin.qq.com/s/demo",
      images
    },
    files: {
      html: "<p>demo</p>"
    }
  };
}

describe("background export pipeline", () => {
  it("rejects missing, non-https, and unsupported-host image URLs before fetch", async () => {
    const { fetchImpl, sandbox } = createSandbox();

    await expect(sandbox.fetchImage({ localPath: "images/img-001.jpg" })).resolves.toMatchObject({
      ok: false,
      error: "Missing image URL"
    });
    await expect(sandbox.fetchImage({ sourceUrl: "data:image/png;base64,AAAA" })).resolves.toMatchObject({
      ok: false,
      error: "Unsupported image URL"
    });
    await expect(sandbox.fetchImage({ sourceUrl: "http://mmbiz.qpic.cn/image.jpg" })).resolves.toMatchObject({
      ok: false,
      error: "Unsupported image URL"
    });
    await expect(sandbox.fetchImage({ sourceUrl: "https://example.com/image.jpg" })).resolves.toMatchObject({
      ok: false,
      error: "Unsupported image host"
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fetches allowed WeChat image URLs without credentials and with force cache", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
    }));
    const { sandbox } = createSandbox({ fetch: fetchImpl });

    await expect(sandbox.fetchImage({
      sourceUrl: "https://mmbiz.qpic.cn/mmbiz_jpg/demo/0",
      localPath: "images/img-001.jpg"
    })).resolves.toMatchObject({
      ok: true,
      data: new Uint8Array([1, 2, 3])
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://mmbiz.qpic.cn/mmbiz_jpg/demo/0", {
      credentials: "omit",
      cache: "force-cache"
    });
  });

  it("returns imageFailed from zip-normalized image results", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1]).buffer
    }));
    const normalizeImageResults = vi.fn((images) => images.map((image) => ({
      sourceUrl: image.sourceUrl,
      localPath: image.localPath || "",
      ok: Boolean(image.ok && image.localPath && image.data),
      error: image.localPath ? "" : "Unsafe image path"
    })));
    const { sandbox } = createSandbox({ fetch: fetchImpl, normalizeImageResults });

    await expect(sandbox.exportArticle(articlePayload([
      {
        sourceUrl: "https://mmbiz.qpic.cn/ok.jpg",
        localPath: "images/img-001.jpg"
      },
      {
        sourceUrl: "https://mmbiz.qpic.cn/missing-path.jpg"
      }
    ]))).resolves.toEqual({
      imageTotal: 2,
      imageFailed: 1
    });
  });

  it("limits image fetch concurrency", async () => {
    let activeFetches = 0;
    let maxActiveFetches = 0;
    const fetchImpl = vi.fn(async () => {
      activeFetches += 1;
      maxActiveFetches = Math.max(maxActiveFetches, activeFetches);

      await new Promise((resolve) => setTimeout(resolve, 5));
      activeFetches -= 1;

      return {
        ok: true,
        arrayBuffer: async () => new Uint8Array([1]).buffer
      };
    });
    const { sandbox } = createSandbox({ fetch: fetchImpl });
    const images = Array.from({ length: 9 }, (_value, index) => ({
      sourceUrl: `https://mmbiz.qpic.cn/img-${index}.jpg`,
      localPath: `images/img-${String(index + 1).padStart(3, "0")}.jpg`
    }));

    await sandbox.exportArticle(articlePayload(images));

    expect(fetchImpl).toHaveBeenCalledTimes(9);
    expect(maxActiveFetches).toBeLessThanOrEqual(4);
  });
});
