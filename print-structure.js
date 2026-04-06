const fs = require("fs");
const path = require("path");

function printTree(dir, prefix = "") {
  const files = fs.readdirSync(dir);

  files.forEach((file, index) => {
    const fullPath = path.join(dir, file);
    const isLast = index === files.length - 1;
    const connector = isLast ? "└── " : "├── ";

    console.log(prefix + connector + file);

    if (fs.statSync(fullPath).isDirectory()) {
      printTree(fullPath, prefix + (isLast ? "    " : "│   "));
    }
  });
}

printTree(process.cwd());
