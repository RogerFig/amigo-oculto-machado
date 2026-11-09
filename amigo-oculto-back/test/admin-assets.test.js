const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const frontend = path.join(__dirname, "../../amigo-oculto-front");
const admin = path.join(__dirname, "../admin");

test("backend bundles the admin pages and static assets", (t) => {
  if (!fs.existsSync(frontend)) {
    t.diagnostic("Frontend source is not available in this deployment checkout.");
    assert.ok(fs.existsSync(path.join(admin, "login.html")));
    return;
  }

  function compare(relative) {
    const source = path.join(frontend, relative);
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      const target = path.join(relative, entry.name);
      if (entry.isDirectory()) compare(target);
      else assert.deepEqual(
        fs.readFileSync(path.join(admin, target)),
        fs.readFileSync(path.join(frontend, target)),
        `${target} differs; run npm run sync:admin in amigo-oculto-back/`
      );
    }
  }

  for (const page of ["index.html", "login.html", "listagem.html", "restricoes.html"]) {
    assert.deepEqual(fs.readFileSync(path.join(admin, page)), fs.readFileSync(path.join(frontend, page)), page);
  }
  for (const folder of ["css", "js", "images"]) compare(folder);
});
