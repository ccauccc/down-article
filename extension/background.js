importScripts("vendor/jszip.min.js", "shared.js", "zip.js");

const MAX_CONCURRENT_IMAGE_FETCHES = 4;
const ALLOWED_IMAGE_HOSTS = new Set([
  "mp.weixin.qq.com",
  "mmbiz.qpic.cn"
]);

function imageUrlError(sourceUrl) {
  if (!sourceUrl || !String(sourceUrl).trim()) {
    return "Missing image URL";
  }

  try {
    const url = new URL(sourceUrl);
    const protocol = url.protocol.toLowerCase();
    const hostname = url.hostname.toLowerCase();

    if (protocol !== "https:") {
      return "Unsupported image URL";
    }

    if (!ALLOWED_IMAGE_HOSTS.has(hostname)) {
      return "Unsupported image host";
    }
  } catch (_error) {
    return "Unsupported image URL";
  }

  return "";
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({
    length: Math.min(limit, items.length)
  }, worker));

  return results;
}

async function fetchImage(image) {
  const validationError = imageUrlError(image && image.sourceUrl);

  if (validationError) {
    return {
      ...image,
      ok: false,
      error: validationError
    };
  }

  try {
    const response = await fetch(image.sourceUrl, {
      credentials: "omit",
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
  const images = Array.isArray(payload.article.images) ? payload.article.images : [];
  const imageResults = await mapWithConcurrency(images, MAX_CONCURRENT_IMAGE_FETCHES, fetchImage);
  const normalizedImageResults = WeChatArticleExporter.zip.normalizeImageResults(imageResults);
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
    imageFailed: normalizedImageResults.filter(function (image) {
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
