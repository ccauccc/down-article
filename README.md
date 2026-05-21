# WeChat Article Exporter

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4.svg)](extension/manifest.json)

English | [简体中文](README.zh-CN.md)

WeChat Article Exporter is a Chrome extension that exports the currently open WeChat public account article into a local ZIP archive. It is designed for personal archiving, offline reading, and content review workflows where the article body and images need to remain available after the page is closed.

The first release focuses on single-article export. HTML export is the high-fidelity format; Markdown and PDF are companion formats.

## Features

- Export the current `mp.weixin.qq.com` article from the browser toolbar.
- Save a ZIP archive containing `article.html`, `images/`, and `export-report.json`.
- Preserve the main article body, inline styles, and locally downloaded images for offline HTML reading.
- Provide Markdown and PDF companion exports.
- Sanitize exported HTML to remove scripts, event handlers, `javascript:` URLs, and risky embedded elements.
- Keep all processing local in the browser extension. No server upload is performed.
- Retry content-script injection automatically when an article tab was opened before the extension was reloaded.

## Output Structure

```text
article-title.zip
├─ article.html
├─ article.md          # only for Markdown export
├─ article.pdf         # only for PDF export
├─ export-report.json
└─ images/
   ├─ img-001.jpg
   ├─ img-002.png
   └─ ...
```

## Installation

This project is currently distributed as an unpacked development extension.

```bash
npm install
npm run vendor
```

Then load it in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension/` directory.
5. Open a WeChat article URL such as `https://mp.weixin.qq.com/s/...`.
6. Click the extension icon and choose an export format.

After pulling new code, reload the extension from `chrome://extensions`.

## Usage

1. Open a single WeChat public account article.
2. Click the WeChat Article Exporter icon.
3. Choose `HTML`, `Markdown`, or `PDF`.
4. Click **Export**.
5. Save the generated ZIP archive.

HTML export is recommended for archival use because it keeps the best visual fidelity. Markdown and PDF are useful for downstream processing or quick sharing, but may be less visually exact than the HTML output.

## Privacy And Security

- The extension does not upload article content or images to any server.
- Image fetching is limited to scoped WeChat article/image hosts.
- Background image fetches use omitted credentials to avoid arbitrary credentialed requests.
- Exported HTML is sanitized before it is written to the archive.
- ZIP image paths are restricted to the expected `images/img-XXX.ext` format.

This project is not affiliated with Tencent or WeChat.

## Development

```bash
npm install
npm run vendor
npm test
```

Useful commands:

```bash
npm run verify
node --check extension/background.js
node --check extension/content.js
node --check extension/popup.js
```

## Project Structure

```text
extension/
├─ manifest.json
├─ popup.html
├─ popup.css
├─ popup.js
├─ content.js
├─ background.js
├─ shared.js
├─ zip.js
└─ vendor/

tests/
├─ background.test.js
├─ content.test.js
├─ popup.test.js
├─ shared.test.js
└─ zip.test.js

docs/
└─ prd.md
```

## Manual Verification Checklist

- Non-WeChat pages disable export.
- Non-article WeChat pages disable export.
- A WeChat article HTML export downloads a ZIP.
- The ZIP includes `article.html`, `images/`, and `export-report.json`.
- `article.html` opens offline and keeps the article body readable with local images.
- Markdown and PDF exports are generated as companion formats.

## Roadmap

- Batch export from article history pages.
- Self-contained HTML export with base64 images.
- Custom Markdown front matter.
- Custom PDF styling.
- Broader source support.

## License

Licensed under the [Apache License 2.0](LICENSE).
