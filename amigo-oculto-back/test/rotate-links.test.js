const test = require("node:test");
const assert = require("node:assert/strict");
const { rotateLinks } = require("../scripts/rotate-links");

function fixture({ failOnUpdate = 0 } = {}) {
  let rows = [
    { id: 1, hash: "legacy-a", nome_completo: "Fictício A", escolheu: true },
    { id: 2, hash: "legacy-b", nome_completo: "Fictício B", escolheu: true },
  ];
  const index = { created: false };
  let updates = 0;
  const db = {
    getQueryInterface: () => ({
      showIndex: async () => index.created ? [{ name: "pessoas_hash_unique", unique: true, fields: [{ attribute: "hash" }] }] : [],
      addIndex: async (table, fields, options) => {
        assert.equal(table, "pessoas");
        assert.deepEqual(fields, ["hash"]);
        assert.equal(options.unique, true);
        index.created = true;
      },
    }),
    transaction: async (callback) => {
      const snapshot = structuredClone(rows);
      try { return await callback({ LOCK: { UPDATE: "UPDATE" } }); }
      catch (error) { rows = snapshot; throw error; }
    },
  };
  const people = {
    findAll: async () => rows.map(({ id, hash }) => ({ id, hash })),
    update: async ({ hash }, { where, transaction }) => {
      assert.ok(transaction);
      updates++;
      if (updates === failOnUpdate) throw Error("simulated failure");
      const row = rows.find(({ id }) => id === where.id);
      row.hash = hash;
      return [1];
    },
  };
  let nonce = 0;
  return { db, people, index, get rows() { return rows; }, randomBytes: () => Buffer.alloc(32, ++nonce) };
}

test("rotation changes only tokens, makes them distinct and keeps the unique index", async () => {
  const setup = fixture();
  const originalFields = setup.rows.map(({ nome_completo, escolheu }) => ({ nome_completo, escolheu }));
  assert.equal(await rotateLinks({ ...setup, expectedCount: 2 }), 2);
  assert.equal(setup.index.created, true);
  assert.equal(new Set(setup.rows.map((row) => row.hash)).size, 2);
  assert.ok(setup.rows.every((row) => /^[a-f0-9]{64}$/.test(row.hash) && !row.hash.startsWith("legacy")));
  assert.deepEqual(setup.rows.map(({ nome_completo, escolheu }) => ({ nome_completo, escolheu })), originalFields);
});

test("wrong participant count, missing token or duplicate abort before schema and data changes", async () => {
  const setup = fixture();
  await assert.rejects(rotateLinks({ ...setup, expectedCount: 3 }), /Contagem/);
  setup.rows[1].hash = setup.rows[0].hash;
  await assert.rejects(rotateLinks({ ...setup, expectedCount: 2 }), /duplicados/);
  assert.equal(setup.index.created, false);
  assert.equal(setup.rows[0].hash, "legacy-a");
});

test("failure during rotation rolls back every token (index can remain)", async () => {
  const setup = fixture({ failOnUpdate: 2 });
  await assert.rejects(rotateLinks({ ...setup, expectedCount: 2 }), /simulated failure/);
  assert.deepEqual(setup.rows.map((row) => row.hash), ["legacy-a", "legacy-b"]);
  assert.equal(setup.index.created, true);
});
