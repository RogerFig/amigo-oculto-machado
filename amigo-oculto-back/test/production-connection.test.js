const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { productionConnection } = require("../scripts/production-connection");

test("production connection uses a private URL file and CA validation without accessing local .env", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "amigo-rotate-test-"));
  const urlFile = path.join(dir, "db-url");
  const caFile = path.join(dir, "ca.pem");
  try {
    fs.writeFileSync(urlFile, "mysql://user:encoded%40password@example.invalid:3307/isolated_test\n", { mode: 0o600 });
    fs.writeFileSync(caFile, "test ca", { mode: 0o600 });
    const { db, host, database } = productionConnection({ urlFile, caFile });
    try {
      assert.equal(host, "example.invalid");
      assert.equal(database, "isolated_test");
      assert.equal(db.config.password, "encoded@password");
      assert.equal(db.config.port, 3307);
      assert.equal(db.options.dialectOptions.ssl.rejectUnauthorized, true);
    } finally { await db.close(); }
    fs.chmodSync(urlFile, 0o644);
    assert.throws(() => productionConnection({ urlFile, caFile }), /modo 600/);
    fs.chmodSync(urlFile, 0o600);
    fs.writeFileSync(urlFile, "{\\rtf1 mysql://example:secret@example.invalid/database}");
    assert.throws(() => productionConnection({ urlFile, caFile }), (error) => {
      assert.doesNotMatch(error.message, /secret/);
      assert.match(error.message, /texto puro/);
      return true;
    });
  } finally {
    fs.rmSync(urlFile, { force: true });
    fs.rmSync(caFile, { force: true });
    fs.rmdirSync(dir);
  }
});
