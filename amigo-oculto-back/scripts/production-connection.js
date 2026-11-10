const fs = require("node:fs");
const path = require("node:path");
const Sequelize = require("sequelize");
const definePessoa = require("../models/pessoa");

function privateFile(filename) {
  if (!filename) throw new Error("Arquivo de acesso ou certificado não informado.");
  const resolved = fs.realpathSync(filename);
  const stat = fs.statSync(resolved);
  if (!stat.isFile() || (stat.mode & 0o077) !== 0) throw new Error("Arquivo deve ser privado (modo 600). ");
  const repository = path.resolve(__dirname, "../..");
  if (resolved.startsWith(repository + path.sep)) throw new Error("Não mantenha credenciais ou certificados no repositório.");
  return resolved;
}

function productionConnection({ urlFile = process.env.DB_URL_FILE, caFile = process.env.DB_CA_FILE } = {}) {
  const raw = fs.readFileSync(privateFile(urlFile), "utf8").trim();
  // URL() includes its input in ERR_INVALID_URL; never let a malformed secret reach logs.
  if (!/^mysql:\/\/[^\s{}]+$/.test(raw)) throw new Error("Arquivo deve conter apenas a URL MySQL em texto puro.");
  let connection;
  try { connection = new URL(raw); }
  catch { throw new Error("String de conexão MySQL inválida."); }
  if (connection.protocol !== "mysql:" || !connection.hostname || !connection.pathname.slice(1) || !connection.username || !connection.password) {
    throw new Error("String de conexão MySQL incompleta.");
  }
  const database = decodeURIComponent(connection.pathname.slice(1));
  const host = connection.hostname;
  const db = new Sequelize(database, decodeURIComponent(connection.username), decodeURIComponent(connection.password), {
    host, port: connection.port ? Number(connection.port) : 3306,
    dialect: "mysql", logging: false,
    dialectOptions: { ssl: { ca: fs.readFileSync(privateFile(caFile)), rejectUnauthorized: true } },
  });
  const people = definePessoa(db, Sequelize.DataTypes);
  return { db, people, host, database };
}

module.exports = { productionConnection };
