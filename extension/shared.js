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
  const RESERVED_WINDOWS_BASENAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

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

  function utf8ByteLength(value) {
    const text = String(value || "");

    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(text).length;
    }

    if (typeof Buffer !== "undefined") {
      return Buffer.byteLength(text, "utf8");
    }

    return unescape(encodeURIComponent(text)).length;
  }

  function truncateUtf8(value, maxBytes) {
    let result = "";
    let byteLength = 0;

    Array.from(String(value || "")).some(function (character) {
      const characterBytes = utf8ByteLength(character);

      if (byteLength + characterBytes > maxBytes) {
        return true;
      }

      result += character;
      byteLength += characterBytes;
      return false;
    });

    return result;
  }

  function makeReservedBasenameSafe(value) {
    const match = String(value || "").match(RESERVED_WINDOWS_BASENAME);

    if (!match) {
      return value;
    }

    return match[1] + "-article" + (match[2] || "");
  }

  function sanitizeFileName(title) {
    const safeTitle = String(title || "")
      .replace(/:[/\\]+/g, "-")
      .replace(/[/\\]+/g, "-")
      .replace(/[<>:"|?*\u0000-\u001f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const fileName = makeReservedBasenameSafe(safeTitle || "wechat-article-" + timestampForFile());

    return truncateUtf8(fileName, MAX_FILENAME_LENGTH);
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
    const normalizedImages = images.map(function (image) {
      if (!image || typeof image !== "object") {
        return {
          sourceUrl: "",
          localPath: "",
          ok: false,
          error: "Invalid image entry"
        };
      }

      return image;
    });
    const failures = normalizedImages
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
