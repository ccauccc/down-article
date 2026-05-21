(function (root, factory) {
  const shared = typeof module === "object" && module.exports
    ? require("./shared")
    : root.WeChatArticleExporter && root.WeChatArticleExporter.shared;
  const content = factory(root, shared);

  if (typeof module === "object" && module.exports) {
    module.exports = content;
  }

  if (root) {
    root.WeChatArticleExporter = root.WeChatArticleExporter || {};
    root.WeChatArticleExporter.content = content;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root, shared) {
  "use strict";

  function requireShared() {
    if (!shared) {
      throw new Error("WeChatArticleExporter shared helpers not found");
    }

    return shared;
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function textFrom(documentRef, selector) {
    const element = documentRef.querySelector(selector);
    return element ? normalizeText(element.textContent) : "";
  }

  function firstSrcsetUrl(srcset) {
    const firstCandidate = String(srcset || "").split(",")[0];
    return firstCandidate.trim().split(/\s+/)[0] || "";
  }

  function imageSource(image, baseUrl) {
    const helpers = requireShared();
    const candidates = [
      image.getAttribute("data-src"),
      image.getAttribute("data-original"),
      image.getAttribute("src"),
      firstSrcsetUrl(image.getAttribute("srcset"))
    ];

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];

      if (!candidate) {
        continue;
      }

      const resolved = helpers.resolveUrl(candidate, baseUrl);

      if (resolved) {
        return resolved;
      }
    }

    return "";
  }

  function removeScriptsFromElement(element) {
    Array.from(element.querySelectorAll("script")).forEach(function (script) {
      script.remove();
    });
  }

  function removeScriptTags(html) {
    return String(html || "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function extractArticle(documentRef, sourceUrl) {
    const helpers = requireShared();
    const articleBody = documentRef.querySelector("#js_content");

    if (!articleBody) {
      throw new Error("Article content not found");
    }

    const resolvedSourceUrl = sourceUrl || documentRef.location && documentRef.location.href || "";
    const bodyClone = articleBody.cloneNode(true);
    const images = [];

    removeScriptsFromElement(bodyClone);

    Array.from(bodyClone.querySelectorAll("img")).forEach(function (image) {
      const sourceImageUrl = imageSource(image, resolvedSourceUrl);

      if (!sourceImageUrl) {
        return;
      }

      const localPath = helpers.localImageName(images.length, "", sourceImageUrl);

      images.push({
        sourceUrl: sourceImageUrl,
        localPath: localPath
      });

      image.setAttribute("src", localPath);
      image.removeAttribute("data-src");
      image.removeAttribute("data-original");
      image.removeAttribute("srcset");
      image.setAttribute("loading", "lazy");
    });

    return {
      title: textFrom(documentRef, "h1.rich_media_title") || textFrom(documentRef, "h2.rich_media_title"),
      author: textFrom(documentRef, "#js_name"),
      publishedAt: textFrom(documentRef, "#publish_time"),
      sourceUrl: resolvedSourceUrl,
      bodyHtml: bodyClone.innerHTML,
      images: images
    };
  }

  function buildArticleHtml(article) {
    const title = escapeHtml(article && article.title);
    const author = escapeHtml(article && article.author);
    const publishedAt = escapeHtml(article && article.publishedAt);
    const sourceUrl = article && article.sourceUrl ? escapeHtml(article.sourceUrl) : "";
    const bodyHtml = removeScriptTags(article && article.bodyHtml);
    const metadata = [author, publishedAt].filter(Boolean).join(" | ");
    const sourceLink = sourceUrl ? '<a href="' + sourceUrl + '">Source</a>' : "";
    const metadataHtml = [metadata, sourceLink].filter(Boolean).join(" | ");

    return "<!doctype html>\n" +
      "<html lang=\"zh-CN\">\n" +
      "<head>\n" +
      "  <meta charset=\"utf-8\">\n" +
      "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
      "  <title>" + title + "</title>\n" +
      "  <style>\n" +
      "    body {\n" +
      "      margin: 0;\n" +
      "      background: #f6f7f9;\n" +
      "      color: #1f2329;\n" +
      "      font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;\n" +
      "      line-height: 1.75;\n" +
      "    }\n" +
      "    .page {\n" +
      "      max-width: 760px;\n" +
      "      min-height: 100vh;\n" +
      "      margin: 0 auto;\n" +
      "      padding: 32px 18px 56px;\n" +
      "      box-sizing: border-box;\n" +
      "      background: #ffffff;\n" +
      "    }\n" +
      "    .article-title {\n" +
      "      margin: 0 0 12px;\n" +
      "      font-size: 26px;\n" +
      "      line-height: 1.35;\n" +
      "      font-weight: 700;\n" +
      "    }\n" +
      "    .article-meta {\n" +
      "      margin: 0 0 28px;\n" +
      "      color: #69707d;\n" +
      "      font-size: 14px;\n" +
      "    }\n" +
      "    .article-meta a {\n" +
      "      color: #576b95;\n" +
      "      text-decoration: none;\n" +
      "      word-break: break-all;\n" +
      "    }\n" +
      "    #js_content {\n" +
      "      overflow-wrap: anywhere;\n" +
      "    }\n" +
      "    #js_content img {\n" +
      "      max-width: 100%;\n" +
      "      height: auto;\n" +
      "    }\n" +
      "  </style>\n" +
      "</head>\n" +
      "<body>\n" +
      "  <main class=\"page\">\n" +
      "    <h1 class=\"article-title\">" + title + "</h1>\n" +
      "    <p class=\"article-meta\">" + metadataHtml + "</p>\n" +
      "    <article id=\"js_content\">\n" +
      bodyHtml + "\n" +
      "    </article>\n" +
      "  </main>\n" +
      "</body>\n" +
      "</html>";
  }

  async function buildMarkdown(article) {
    const TurndownService = root && root.TurndownService;

    if (typeof TurndownService !== "function") {
      return "";
    }

    const turndown = new TurndownService({
      codeBlockStyle: "fenced",
      headingStyle: "atx"
    });

    return "# " + String(article && article.title || "") + "\n\n" +
      turndown.turndown(article && article.bodyHtml || "") + "\n";
  }

  async function buildPdfBase64(article) {
    const html2pdf = root && root.html2pdf;
    const documentRef = root && root.document;
    const FileReaderRef = root && root.FileReader;

    if (typeof html2pdf !== "function" || !documentRef || typeof FileReaderRef !== "function") {
      return "";
    }

    const wrapper = documentRef.createElement("div");
    wrapper.innerHTML = buildArticleHtml(article);
    const blob = await html2pdf()
      .set({
        margin: 10,
        filename: "article.pdf",
        html2canvas: {
          scale: 2,
          useCORS: true
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait"
        }
      })
      .from(wrapper)
      .outputPdf("blob");

    return new Promise(function (resolve, reject) {
      const reader = new FileReaderRef();

      reader.onload = function () {
        resolve(String(reader.result || "").split(",")[1] || "");
      };
      reader.onerror = function () {
        reject(reader.error || new Error("PDF read failed"));
      };
      reader.readAsDataURL(blob);
    });
  }

  async function handleExportRequest(message) {
    const documentRef = root && root.document;
    const windowRef = root && root.window;
    const format = message && message.format || "html";

    if (!documentRef) {
      throw new Error("Document not available");
    }

    const article = extractArticle(documentRef, windowRef && windowRef.location ? windowRef.location.href : "");
    const files = {
      html: buildArticleHtml(article),
      markdown: "",
      pdfBase64: ""
    };

    if (format === "markdown") {
      files.markdown = await buildMarkdown(article);
    }

    if (format === "pdf") {
      files.pdfBase64 = await buildPdfBase64(article);
    }

    return {
      format: format,
      article: article,
      files: files
    };
  }

  if (root && typeof root.chrome !== "undefined" && root.chrome.runtime && root.chrome.runtime.onMessage) {
    root.chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
      if (!message || message.type !== "EXPORT_WECHAT_ARTICLE") {
        return false;
      }

      handleExportRequest(message)
        .then(function (payload) {
          sendResponse({
            ok: true,
            payload: payload
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
  }

  return {
    extractArticle: extractArticle,
    buildArticleHtml: buildArticleHtml,
    buildMarkdown: buildMarkdown,
    buildPdfBase64: buildPdfBase64,
    handleExportRequest: handleExportRequest
  };
});
