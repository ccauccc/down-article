import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const popup = require("../extension/popup");

function createPopupDom(checkedValue = "html") {
  const dom = new JSDOM(`<!doctype html>
    <main class="popup">
      <fieldset>
        <label><input type="radio" name="format" value="html">HTML 压缩包</label>
        <label><input type="radio" name="format" value="markdown">Markdown 压缩包</label>
        <label><input type="radio" name="format" value="pdf">PDF 压缩包</label>
      </fieldset>
      <button id="exportButton" type="button">导出</button>
      <p id="status" role="status" aria-live="polite">打开公众号文章后即可导出。</p>
    </main>`);
  const input = checkedValue
    ? dom.window.document.querySelector(`input[value="${checkedValue}"]`)
    : null;

  if (input) {
    input.checked = true;
  }

  return dom;
}

function stubChrome(tabUrl, options = {}) {
  const tab = options.tab === undefined
    ? {
        id: 7,
        url: tabUrl
      }
    : options.tab;
  const exportResponse = options.exportResponse || {
    ok: true,
    payload: {
      article: {
        images: [{ sourceUrl: "https://mmbiz.qpic.cn/one.jpg" }]
      },
      files: {
        html: "<p>demo</p>"
      }
    }
  };
  const downloadResponse = options.downloadResponse || {
    ok: true,
    result: {
      imageTotal: 1,
      imageFailed: 0
    }
  };

  globalThis.chrome = {
    tabs: {
      query: options.query || vi.fn(async () => (tab ? [tab] : [])),
      sendMessage: vi.fn(async () => exportResponse)
    },
    runtime: {
      sendMessage: vi.fn(async () => downloadResponse)
    }
  };

  return globalThis.chrome;
}

describe("popup helpers and flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete globalThis.chrome;
  });

  it("accepts only mp.weixin.qq.com article hostnames", () => {
    expect(popup.isWeChatArticleUrl("https://mp.weixin.qq.com/s/demo")).toBe(true);
    expect(popup.isWeChatArticleUrl("https://m.mp.weixin.qq.com/s/demo")).toBe(false);
    expect(popup.isWeChatArticleUrl("https://example.com/s/demo")).toBe(false);
    expect(popup.isWeChatArticleUrl("not a url")).toBe(false);
  });

  it("enables export only for likely single article routes", async () => {
    expect(popup.isLikelyWeChatArticleUrl("https://mp.weixin.qq.com/s/demo")).toBe(true);
    expect(popup.isLikelyWeChatArticleUrl("https://mp.weixin.qq.com/s?__biz=demo")).toBe(true);
    expect(popup.isLikelyWeChatArticleUrl("https://mp.weixin.qq.com/cgi-bin/home")).toBe(false);

    stubChrome("https://mp.weixin.qq.com/cgi-bin/home");
    const dom = createPopupDom();

    await popup.bind(dom.window.document);

    expect(dom.window.document.getElementById("exportButton").disabled).toBe(true);
    expect(dom.window.document.getElementById("status").textContent).toBe("当前页面不是支持的公众号文章。");
    expect(dom.window.document.getElementById("status").className).toBe("error");
  });

  it("returns the checked format and falls back to html", async () => {
    stubChrome("https://mp.weixin.qq.com/s/demo");
    const dom = createPopupDom("markdown");

    await popup.bind(dom.window.document);
    expect(popup.selectedFormat()).toBe("markdown");

    dom.window.document.querySelectorAll("input[name=\"format\"]").forEach((input) => {
      input.checked = false;
    });

    expect(popup.selectedFormat()).toBe("html");
  });

  it("disables export on non-WeChat pages during initialization", async () => {
    stubChrome("https://example.com/article");
    const dom = createPopupDom();

    await popup.bind(dom.window.document);

    expect(dom.window.document.getElementById("exportButton").disabled).toBe(true);
    expect(dom.window.document.getElementById("status").textContent).toBe("当前页面不是微信公众号文章。");
    expect(dom.window.document.getElementById("status").className).toBe("error");
  });

  it("exports the selected format and reports success", async () => {
    const chrome = stubChrome("https://mp.weixin.qq.com/s/demo");
    const dom = createPopupDom("pdf");

    await popup.bind(dom.window.document);
    await popup.exportCurrentArticle();

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
      type: "EXPORT_WECHAT_ARTICLE",
      format: "pdf"
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "DOWNLOAD_WECHAT_ARTICLE_ZIP",
      payload: expect.objectContaining({
        article: expect.objectContaining({
          images: expect.any(Array)
        })
      })
    });
    expect(dom.window.document.getElementById("status").textContent).toBe("导出完成。");
    expect(dom.window.document.getElementById("status").className).toBe("success");
    expect(dom.window.document.getElementById("exportButton").disabled).toBe(false);
  });

  it("shows warning status for partial image failures", async () => {
    stubChrome("https://mp.weixin.qq.com/s/demo", {
      downloadResponse: {
        ok: true,
        result: {
          imageTotal: 3,
          imageFailed: 2
        }
      }
    });
    const dom = createPopupDom();

    await popup.bind(dom.window.document);
    await popup.exportCurrentArticle();

    expect(dom.window.document.getElementById("status").textContent).toBe("导出完成，2 张图片下载失败，已写入报告。");
    expect(dom.window.document.getElementById("status").className).toBe("warning");
    expect(dom.window.document.getElementById("status").className).not.toBe("success");
  });

  it("shows content script errors and re-enables article exports", async () => {
    stubChrome("https://mp.weixin.qq.com/s/demo", {
      exportResponse: {
        ok: false,
        error: "Article content not found"
      }
    });
    const dom = createPopupDom();

    await popup.bind(dom.window.document);
    await popup.exportCurrentArticle();

    expect(dom.window.document.getElementById("status").textContent).toBe("Article content not found");
    expect(dom.window.document.getElementById("status").className).toBe("error");
    expect(dom.window.document.getElementById("exportButton").disabled).toBe(false);
  });

  it("shows background errors and re-enables article exports", async () => {
    stubChrome("https://mp.weixin.qq.com/s/demo", {
      downloadResponse: {
        ok: false,
        error: "ZIP failed"
      }
    });
    const dom = createPopupDom();

    await popup.bind(dom.window.document);
    await popup.exportCurrentArticle();

    expect(dom.window.document.getElementById("status").textContent).toBe("ZIP failed");
    expect(dom.window.document.getElementById("status").className).toBe("error");
    expect(dom.window.document.getElementById("exportButton").disabled).toBe(false);
  });

  it("keeps export disabled when the active tab cannot be resolved", async () => {
    stubChrome("https://mp.weixin.qq.com/s/demo", {
      query: vi.fn(async () => {
        throw new Error("tabs unavailable");
      })
    });
    const rejectedDom = createPopupDom();

    await popup.bind(rejectedDom.window.document);

    expect(rejectedDom.window.document.getElementById("exportButton").disabled).toBe(true);
    expect(rejectedDom.window.document.getElementById("status").textContent).toBe("tabs unavailable");
    expect(rejectedDom.window.document.getElementById("status").className).toBe("error");

    stubChrome("", { tab: null });
    const noTabDom = createPopupDom();

    await popup.bind(noTabDom.window.document);

    expect(noTabDom.window.document.getElementById("exportButton").disabled).toBe(true);
    expect(noTabDom.window.document.getElementById("status").textContent).toBe("当前页面不是支持的公众号文章。");
    expect(noTabDom.window.document.getElementById("status").className).toBe("error");
  });
});
