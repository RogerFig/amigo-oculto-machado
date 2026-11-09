const fs = require("fs");
const path = require("path");

const source = path.join(__dirname, "../../amigo-oculto-front");
const output = path.join(__dirname, "../admin");
const pages = ["index.html", "login.html", "listagem.html", "restricoes.html"];
const folders = ["css", "js", "images"];

if (!fs.existsSync(source)) {
  throw new Error("Frontend source directory is required to sync admin assets.");
}

for (const file of pages) {
  fs.mkdirSync(output, { recursive: true });
  fs.copyFileSync(path.join(source, file), path.join(output, file));
}
for (const folder of folders) {
  fs.cpSync(path.join(source, folder), path.join(output, folder), { recursive: true, force: true });
}

console.log("Admin assets synced from amigo-oculto-front.");

module.exports = { pages, folders };
