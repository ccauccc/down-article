# WeChat Article Exporter

Chrome extension for exporting the current WeChat public account article as a local ZIP archive.

## Development

```bash
npm install
npm run vendor
npm test
```

## Load In Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select the `extension/` directory.
5. Open a `https://mp.weixin.qq.com/...` article and click the extension icon.

## First Version Scope

- Single current article only.
- HTML export is the high-fidelity priority.
- ZIP output contains `article.html`, `images/`, and `export-report.json`.
- Markdown and PDF exports are best-effort companion formats.
- All processing happens locally in the browser extension.

## Manual Verification Checklist

- Non-WeChat pages disable export.
- Non-article WeChat pages disable export.
- WeChat article HTML export downloads a ZIP.
- ZIP includes `article.html`, `images/`, and `export-report.json`.
- `article.html` opens offline and keeps the article body readable with local images.
- Markdown and PDF exports are companion formats and may be less visually exact than HTML.
