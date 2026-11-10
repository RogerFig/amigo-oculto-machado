// One-time operator command. Never run automatically during app startup or deploy.
const crypto = require("node:crypto");
const fs = require("node:fs");
const { productionConnection } = require("./production-connection");

async function rotateLinks({ db, people, expectedCount, randomBytes = crypto.randomBytes } = {}) {
  if (!db || !people) throw new Error("Conexão e modelo necessários.");
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 1) {
    throw new Error("Informe a contagem esperada de participantes.");
  }

  // Validate legacy rows before touching the schema. A preexisting collision needs a separate review.
  const before = await people.findAll({ attributes: ["id", "hash"], order: [["id", "ASC"]], raw: true });
  if (before.length !== expectedCount) throw new Error("Contagem de participantes diferente da esperada.");
  const old = new Set();
  for (const row of before) {
    if (!Number.isSafeInteger(row.id) || row.id < 1 || typeof row.hash !== "string" || !row.hash || old.has(row.hash)) {
      throw new Error("Tokens legados ausentes ou duplicados: abortando sem alterações.");
    }
    old.add(row.hash);
  }

  const queryInterface = db.getQueryInterface();
  const indexes = await queryInterface.showIndex("pessoas");
  const index = indexes.find(({ name }) => name === "pessoas_hash_unique");
  if (index && (!index.unique || index.fields.length !== 1 || index.fields[0].attribute !== "hash")) {
    throw new Error("Índice de tokens existente não garante unicidade de hash.");
  }
  // DDL commits implicitly on MySQL: do it BEFORE the transactional rotation.
  // If the transaction fails, old links remain valid and the unique index remains in place.
  if (!index) await queryInterface.addIndex("pessoas", ["hash"], { name: "pessoas_hash_unique", unique: true });

  const generated = new Set(old);
  const replacements = before.map(({ id }) => {
    let hash;
    do { hash = randomBytes(32).toString("hex"); } while (generated.has(hash));
    generated.add(hash);
    return { id, hash };
  });

  await db.transaction(async (transaction) => {
    const current = await people.findAll({
      attributes: ["id", "hash"], order: [["id", "ASC"]], transaction,
      lock: transaction.LOCK.UPDATE, raw: true,
    });
    if (current.length !== before.length || current.some((row, i) => row.id !== before[i].id || row.hash !== before[i].hash)) {
      throw new Error("Participantes alterados durante a preparação; tokens preservados.");
    }
    for (const { id, hash } of replacements) {
      const [updated] = await people.update({ hash }, { where: { id }, transaction });
      if (updated !== 1) throw new Error("Falha ao atualizar token; transação revertida.");
    }
  });
  return replacements.length;
}

async function main() {
  const { db, people, host, database } = productionConnection();
  try {
  const expectedCount = Number(process.env.EXPECTED_PARTICIPANTS);
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.CONFIRM_ROTATE_LINKS !== "ROTACIONAR TODOS OS LINKS" ||
    process.env.CONFIRM_DATABASE !== database ||
    process.env.CONFIRM_HOST !== host ||
    !/^[a-f0-9]{64}$/i.test(process.env.BACKUP_SHA256 || "") ||
    !process.env.BACKUP_FILE ||
    !Number.isSafeInteger(expectedCount) || expectedCount < 1
  ) {
    throw new Error("Rotação exige produção, confirmação explícita do host/banco, contagem e SHA-256 do backup recente.");
  }
  const backup = fs.statSync(process.env.BACKUP_FILE);
  if (!backup.isFile() || (backup.mode & 0o077) || backup.mtimeMs < Date.now() - 24 * 60 * 60 * 1000 || backup.size === 0) {
    throw new Error("Backup atual, não vazio e restrito (modo 600) necessário.");
  }
  const checksum = crypto.createHash("sha256").update(fs.readFileSync(process.env.BACKUP_FILE)).digest("hex");
  if (checksum.toLowerCase() !== process.env.BACKUP_SHA256.toLowerCase()) throw new Error("Checksum do backup não confere.");
  const count = await rotateLinks({ db, people, expectedCount });
  console.log(`Rotação concluída para ${count} participantes; demais campos não foram modificados.`);
  } finally { await db.close(); }
}

if (require.main === module) {
  main().catch((error) => {
    // Never print SQL, tokens, names or connection strings in logs.
    console.error("Rotação não concluída:", error.message.startsWith("Rotação exige") ? error.message : "verifique precondições e banco sem expor dados em logs.");
    process.exitCode = 1;
  });
}

module.exports = { rotateLinks };
