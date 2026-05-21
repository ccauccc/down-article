importScripts("vendor/jszip.min.js", "shared.js", "zip.js");

async function fetchImage(image) {
  try {
    const response = await fetch(image.sourceUrl, {
      credentials: "include",
      cache: "force-cache"
    });

    if (!response.ok) {
      return {
        ...image,
        ok: false,
        error: `HTTP ${response.status}`
      };
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
      error: error && error.message ? error.message : String(error)
    };
  }
}

async function downloadBase64Zip(base64, filename) {
  await chrome.downloads.download({
    url: `data:application/zip;base64,${base64}`,
    filename: filename,
    saveAs: true,
    conflictAction: "uniquify"
  });
}

async function exportArticle(payload) {
  const imageResults = await Promise.all(payload.article.images.map(fetchImage));
  const zipBase64 = await WeChatArticleExporter.zip.buildArticleZipBase64({
    JSZip: JSZip,
    title: payload.article.title,
    sourceUrl: payload.article.sourceUrl,
    files: payload.files,
    images: imageResults
  });
  const filename = `${WeChatArticleExporter.shared.sanitizeFileName(payload.article.title)}.zip`;

  await downloadBase64Zip(zipBase64, filename);

  return {
    imageTotal: imageResults.length,
    imageFailed: imageResults.filter(function (image) {
      return !image.ok;
    }).length
  };
}

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  if (!message || message.type !== "DOWNLOAD_WECHAT_ARTICLE_ZIP") {
    return false;
  }

  exportArticle(message.payload)
    .then(function (result) {
      sendResponse({
        ok: true,
        result: result
      });
    })
    .catch(function (error) {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : String(error)
      });
    });

  return true;
});
