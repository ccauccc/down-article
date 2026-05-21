const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const vendorDir = path.join(root, "extension", "vendor");

const files = [
  {
    from: path.join(root, "node_modules", "jszip", "dist", "jszip.min.js"),
    to: path.join(vendorDir, "jszip.min.js")
  },
  {
    from: path.join(root, "node_modules", "turndown", "dist", "turndown.js"),
    to: path.join(vendorDir, "turndown.js")
  },
  {
    from: path.join(root, "node_modules", "html2pdf.js", "dist", "html2pdf.bundle.min.js"),
    to: path.join(vendorDir, "html2pdf.bundle.min.js")
  },
  {
    from: path.join(root, "node_modules", "html2pdf.js", "dist", "html2pdf.bundle.min.js.LICENSE.txt"),
    to: path.join(vendorDir, "html2pdf.bundle.min.js.LICENSE.txt"),
    optional: true
  },
  {
    from: path.join(root, "node_modules", "html2pdf.js", "dist", "html2pdf.bundle.min.js.map"),
    to: path.join(vendorDir, "html2pdf.bundle.min.js.map"),
    optional: true
  }
];

fs.mkdirSync(vendorDir, { recursive: true });

for (const file of files) {
  if (!fs.existsSync(file.from)) {
    if (file.optional) {
      console.log(`Skipped missing optional vendor file: ${path.relative(root, file.from)}`);
      continue;
    }

    throw new Error(`Missing dependency bundle: ${file.from}. Run npm install first.`);
  }

  fs.copyFileSync(file.from, file.to);
  console.log(`Copied ${path.relative(root, file.to)}`);
}
