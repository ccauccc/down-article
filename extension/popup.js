(function (root, factory) {
  const popup = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = popup;
  }

  if (root) {
    root.WeChatArticleExporter = root.WeChatArticleExporter || {};
    root.WeChatArticleExporter.popup = popup;

    if (root.document) {
      popup.bind(root.document);
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  let documentRef;
  let exportButton;
  let status;

  function bind(nextDocument) {
    documentRef = nextDocument;
    exportButton = documentRef.getElementById("exportButton");
    status = documentRef.getElementById("status");

    if (exportButton) {
      exportButton.addEventListener("click", exportCurrentArticle);
    }

    return initialize();
  }

  function setStatus(message, type) {
    if (!status) {
      return;
    }

    status.textContent = message;
    status.className = type || "";
  }

  function selectedFormat() {
    const checkedInput = documentRef && documentRef.querySelector("input[name=\"format\"]:checked");

    return checkedInput && checkedInput.value ? checkedInput.value : "html";
  }

  async function currentTab() {
    const tabs = await root.chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    return Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null;
  }

  function isWeChatArticleUrl(url) {
    try {
      return new URL(url).hostname === "mp.weixin.qq.com";
    } catch (_error) {
      return false;
    }
  }

  async function initialize() {
    if (!exportButton) {
      return;
    }

    exportButton.disabled = true;

    try {
      const tab = await currentTab();

      if (!tab || !isWeChatArticleUrl(tab.url)) {
        setStatus("当前页面不是微信公众号文章。", "error");
        return;
      }

      exportButton.disabled = false;
      setStatus("选择格式后点击导出。", "");
    } catch (error) {
      setStatus(errorMessage(error), "error");
    }
  }

  function errorMessage(error) {
    return error && error.message ? error.message : String(error || "导出失败。");
  }

  function responsePayload(response, label) {
    if (!response || response.ok !== true) {
      throw new Error(response && response.error ? response.error : label);
    }

    return response.payload || response.result || {};
  }

  async function exportCurrentArticle() {
    if (!exportButton || exportButton.disabled) {
      return;
    }

    exportButton.disabled = true;
    setStatus("正在读取文章内容...", "");

    try {
      const tab = await currentTab();

      if (!tab || !isWeChatArticleUrl(tab.url)) {
        setStatus("当前页面不是微信公众号文章。", "error");
        return;
      }

      const articlePayload = responsePayload(await root.chrome.tabs.sendMessage(tab.id, {
        type: "EXPORT_WECHAT_ARTICLE",
        format: selectedFormat()
      }), "读取文章内容失败。");
      const imageTotal = articlePayload.article && Array.isArray(articlePayload.article.images)
        ? articlePayload.article.images.length
        : 0;

      setStatus("正在下载图片并打包，共 " + imageTotal + " 张图片...", "");

      const downloadResult = responsePayload(await root.chrome.runtime.sendMessage({
        type: "DOWNLOAD_WECHAT_ARTICLE_ZIP",
        payload: articlePayload
      }), "下载打包失败。");
      const imageFailed = Number(downloadResult.imageFailed) || 0;

      if (imageFailed > 0) {
        setStatus("导出完成，" + imageFailed + " 张图片下载失败，已写入报告。", "warning");
        return;
      }

      setStatus("导出完成。", "success");
    } catch (error) {
      setStatus(errorMessage(error), "error");
    } finally {
      await restoreButtonState();
    }
  }

  async function restoreButtonState() {
    if (!exportButton) {
      return;
    }

    try {
      const tab = await currentTab();
      exportButton.disabled = !tab || !isWeChatArticleUrl(tab.url);
    } catch (_error) {
      exportButton.disabled = true;
    }
  }

  return {
    bind: bind,
    currentTab: currentTab,
    exportCurrentArticle: exportCurrentArticle,
    initialize: initialize,
    isWeChatArticleUrl: isWeChatArticleUrl,
    selectedFormat: selectedFormat,
    setStatus: setStatus
  };
});
