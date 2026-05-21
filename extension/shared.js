(function (root, factory) {
  const shared = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = shared;
  }

  if (root) {
    root.WeChatArticleExporter = root.WeChatArticleExporter || {};
    root.WeChatArticleExporter.shared = shared;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_FILENAME_LENGTH = 80;
  const DEFAULT_IMAGE_EXTENSION = "jpg";

  const MIME_EXTENSIONS = {
    "image/avif": "avif",
    "image/bmp": "bmp",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/svg+xml": "svg",
    "image/tiff": "tif",
    "image/vnd.microsoft.icon": "ico",
    "image/webp": "webp",
    "image/x-icon": "ico"
  };

  const URL_EXTENSIONS = new Set([
    "avif",
    "bmp",
    "gif",
    "ico",
    "jpeg",
    "jpg",
    "png",
    "svg",
    "tif",
    "tiff",
    "webp"
  ]);

  function pad(value, length) {
    return String(value).padStart(length, "0");
  }

  function timestampForFile(date) {
    const value = date instanceof Date ? date : new Date();

    return [
      value.getFullYear(),
      pad(value.getMonth() + 1, 2),
      pad(value.getDate(), 2)
    ].join("") + "-" + [
      pad(value.getHours(), 2),
      pad(value.getMinutes(), 2),
      pad(value.getSeconds(), 2)
    ].join("");
  }

  function truncateFileName(value) {
    return Array.from(value).slice(0, MAX_FILENAME_LENGTH).join("");
  }

  function sanitizeFileName(title) {
    const safeTitle = String(title || "")
      .replace(/:[/\\]+/g, "-")
      .replace(/[/\\]+/g, "-")
      .replace(/[<>:"|?*\u0000-\u001f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return truncateFileName(safeTitle || "wechat-article-" + timestampForFile());
  }

  function resolveUrl(url, baseUrl) {
    if (!url) {
      return "";
    }

    return new URL(url, baseUrl).href;
  }

  function normalizeExtension(extension) {
    const value = String(extension || "").toLowerCase();

    if (value === "jpeg") {
      return "jpg";
    }

    if (value === "tiff") {
      return "tif";
    }

    return value;
  }

  function extensionFromContentType(contentType, url) {
    const mimeType = String(contentType || "").split(";")[0].trim().toLowerCase();

    if (MIME_EXTENSIONS[mimeType]) {
      return MIME_EXTENSIONS[mimeType];
    }

    try {
      const pathname = new URL(url).pathname;
      const match = pathname.match(/\.([a-z0-9]+)$/i);
      const extension = normalizeExtension(match && match[1]);

      if (URL_EXTENSIONS.has(extension)) {
        return extension;
      }
    } catch (error) {
      const path = String(url || "").split(/[?#]/)[0];
      const match = path.match(/\.([a-z0-9]+)$/i);
      const extension = normalizeExtension(match && match[1]);

      if (URL_EXTENSIONS.has(extension)) {
        return extension;
      }
    }

    return DEFAULT_IMAGE_EXTENSION;
  }

  function localImageName(index, contentType, sourceUrl) {
    const number = pad(Number(index) + 1, 3);
    const extension = extensionFromContentType(contentType, sourceUrl);

    return "images/img-" + number + "." + extension;
  }

  function createExportReport(options) {
    const images = Array.isArray(options && options.images) ? options.images : [];
    const failures = images
      .filter(function (image) {
        return !image.ok;
      })
      .map(function (image) {
        return {
          url: image.sourceUrl || "",
          localPath: image.localPath || "",
          error: image.error || ""
        };
      });

    return {
      exportedAt: new Date().toISOString(),
      sourceUrl: options && options.sourceUrl ? options.sourceUrl : "",
      title: options && options.title ? options.title : "",
      imageTotal: images.length,
      imageSucceeded: images.length - failures.length,
      imageFailed: failures.length,
      failures: failures
    };
  }

  return {
    createExportReport: createExportReport,
    extensionFromContentType: extensionFromContentType,
    localImageName: localImageName,
    resolveUrl: resolveUrl,
    sanitizeFileName: sanitizeFileName,
    timestampForFile: timestampForFile
  };
});
