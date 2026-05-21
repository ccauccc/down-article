(function (root, factory) {
  const shared = typeof module === "object" && module.exports
    ? require("./shared")
    : root.WeChatArticleExporter && root.WeChatArticleExporter.shared;
  const zip = factory(root, shared);

  if (typeof module === "object" && module.exports) {
    module.exports = zip;
  }

  if (root) {
    root.WeChatArticleExporter = root.WeChatArticleExporter || {};
    root.WeChatArticleExporter.zip = zip;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root, shared) {
  "use strict";

  const SAFE_IMAGE_LOCAL_PATH = /^images\/img-[0-9]{3,}\.(?:avif|bmp|gif|ico|jpe?g|png|svg|tiff?|webp)$/i;

  function requireShared() {
    if (!shared) {
      throw new Error("WeChatArticleExporter shared helpers not found");
    }

    return shared;
  }

  function base64ToUint8Array(value) {
    const text = String(value || "");
    const base64 = text.indexOf(",") === -1 ? text : text.split(",").pop();

    if (!base64) {
      return new Uint8Array(0);
    }

    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(base64, "base64"));
    }

    if (root && typeof root.atob === "function") {
      const binary = root.atob(base64);
      const bytes = new Uint8Array(binary.length);

      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      return bytes;
    }

    throw new Error("Base64 decoder not available");
  }

  function hasImageData(image) {
    return Boolean(image && image.data !== undefined && image.data !== null);
  }

  function isSafeImageLocalPath(localPath) {
    return SAFE_IMAGE_LOCAL_PATH.test(String(localPath || ""));
  }

  function normalizeImageResult(image) {
    const result = {
      sourceUrl: image && image.sourceUrl ? image.sourceUrl : "",
      localPath: image && image.localPath ? image.localPath : "",
      ok: false,
      error: image && image.error ? image.error : ""
    };

    if (!image || !image.ok) {
      return result;
    }

    if (!isSafeImageLocalPath(result.localPath)) {
      result.error = "Unsafe image path";
      return result;
    }

    if (!hasImageData(image)) {
      result.error = "Image data missing";
      return result;
    }

    result.ok = true;
    result.error = "";
    return result;
  }

  function imageResultForReport(result) {
    return {
      sourceUrl: result.sourceUrl,
      localPath: result.localPath,
      ok: result.ok,
      error: result.error
    };
  }

  function normalizeImageResults(images) {
    const imageList = Array.isArray(images) ? images : [];

    return imageList.map(normalizeImageResult).map(imageResultForReport);
  }

  async function buildArticleZipBase64(options) {
    const helpers = requireShared();
    const JSZip = options && options.JSZip;
    const archive = new JSZip();
    const files = options && options.files || {};
    const images = Array.isArray(options && options.images) ? options.images : [];
    const normalizedImages = images.map(normalizeImageResult);
    const imageResults = normalizedImages.map(imageResultForReport);

    archive.file("article.html", files.html || "");

    if (files.markdown) {
      archive.file("article.md", files.markdown);
    }

    if (files.pdfBase64) {
      archive.file("article.pdf", base64ToUint8Array(files.pdfBase64));
    }

    normalizedImages.forEach(function (image, index) {
      if (image.ok) {
        archive.file(image.localPath, images[index].data);
      }
    });

    archive.file("export-report.json", JSON.stringify(helpers.createExportReport({
      sourceUrl: options && options.sourceUrl,
      title: options && options.title,
      images: imageResults
    }), null, 2));

    return archive.generateAsync({ type: "base64" });
  }

  return {
    base64ToUint8Array: base64ToUint8Array,
    buildArticleZipBase64: buildArticleZipBase64,
    normalizeImageResults: normalizeImageResults
  };
});
