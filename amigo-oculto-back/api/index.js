const express = require("express");
const router = express.Router();
const { Pessoa, Par, Restricao, sequelize } = require("../models");
const crypto = require("crypto");
const { Op } = require("sequelize");
const { assignPairs } = require("../draw/assign");

class DrawError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function safeRoute(handler) {
  return async (req, res, next) => {
    try {
      return await handler(req, res);
    } catch (error) {
      if (res.headersSent) return next(error);
      return res.status(error instanceof ApiError ? error.status : 500).json({
        mensagem: error instanceof ApiError ? error.message : "Não foi possível concluir a operação.",
      });
    }
  };
}

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validName(value) {
  return typeof value === "string" && Boolean(value.trim()) && value.length <= 255;
}

async function whilePreparing(action) {
  return sequelize.transaction(async (transaction) => {
    const people = await Pessoa.findAll({
      attributes: ["id", "escolheu", "escolhido"],
      order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE,
    });
    if (await Par.count({ transaction }) || people.some((person) => person.escolheu || person.escolhido)) {
      throw new ApiError(409, "O sorteio já foi realizado. Confirme um reset antes de alterar participantes ou restrições.");
    }
    return action(transaction);
  });
}

router.get("/", safeRoute(async (req, res) => {
  const { id } = req.query;
  if (id !== undefined && !validId(id)) throw new ApiError(400, "ID inválido.");

  const results = id
    ? await Pessoa.findAll({
        where: {
          id: validId(id),
        },
      })
    : await Pessoa.findAll();

  return res.json(results);
}));

router.post("/", safeRoute(async (req, res) => {
  const { nome_completo, nick } = req.body || {};
  if (!validName(nome_completo) || !validName(nick)) throw new ApiError(400, "Dados do participante inválidos.");

  await whilePreparing((transaction) =>
    // Let MySQL's autoIncrement allocate the ID, even for concurrent requests.
    Pessoa.create({
      nome_completo: nome_completo.trim(),
      nick: nick.trim(),
      escolheu: false,
      escolhido: false,
      hash: crypto.randomBytes(32).toString("hex"),
    }, { transaction })
  );
  return res.status(201).json({ mensagem: "Usuário inserido com sucesso" });
}));

router.delete("/:id", safeRoute(async (req, res) => {
  const id = validId(req.params.id);
  if (!id) throw new ApiError(400, "ID inválido.");
  await whilePreparing(async (transaction) => {
    const person = await Pessoa.findByPk(id, { transaction });
    if (!person) throw new ApiError(404, "Participante não encontrado.");
    await Restricao.destroy({ where: { [Op.or]: [{ id_retira: id }, { id_escolhido: id }] }, transaction });
    await Pessoa.destroy({ where: { id }, transaction });
  });
  return res.status(204).end();
}));

router.put("/:id", safeRoute(async (req, res) => {
  const id = validId(req.params.id);
  const { nome_completo, nick } = req.body || {};
  if (!id || !validName(nome_completo) || !validName(nick)) throw new ApiError(400, "Dados do participante inválidos.");
  await whilePreparing(async (transaction) => {
    const person = await Pessoa.findByPk(id, { transaction });
    if (!person) throw new ApiError(404, "Participante não encontrado.");
    await Pessoa.update(
      { nome_completo: nome_completo.trim(), nick: nick.trim() },
      { where: { id }, transaction }
    );
  });
  return res.status(200).json({ mensagem: "Usuário editado com sucesso!" });
}));

// Método de RESET
router.put("/", safeRoute(async (req, res) => {
  if (req.body?.confirmacao !== "RESETAR SORTEIO") {
    throw new ApiError(400, "Confirme o reset digitando RESETAR SORTEIO.");
  }
  await sequelize.transaction(async (transaction) => {
    await Pessoa.findAll({
      attributes: ["id"], order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE,
    });
    // TRUNCATE commits implicitly in MySQL; DELETE participates in the transaction.
    await Par.destroy({ where: {}, transaction });
    await Pessoa.update(
      { escolhido: false, escolheu: false, data: null },
      { where: {}, transaction }
    );
  });
  return res.status(200).json({ mensagem: "Sorteio resetado com sucesso." });
}));

// Rotas de restrições
router.get("/restricao", safeRoute(async (req, res) => {
  const restricoes = await Restricao.findAll({
    attributes: ["id_retira", "id_escolhido"],
    where: {},
  });
  return res.json(restricoes);
}));

router.post("/restricao", safeRoute(async (req, res) => {
  const { id_retira, id_escolhidos } = req.body || {};
  if (
    !Number.isSafeInteger(id_retira) || id_retira < 1 ||
    !Array.isArray(id_escolhidos) ||
    id_escolhidos.some((id) => !Number.isSafeInteger(id) || id < 1 || id === id_retira) ||
    new Set(id_escolhidos).size !== id_escolhidos.length
  ) {
    throw new ApiError(400, "Restrições inválidas.");
  }

    const result = await whilePreparing(async (transaction) => {
      const giver = await Pessoa.findByPk(id_retira, { transaction });
      if (!giver) return false;
      if (id_escolhidos.length) {
        const recipients = await Pessoa.count({
          where: { id: { [Op.in]: id_escolhidos } }, transaction,
        });
        if (recipients !== id_escolhidos.length) return false;
      }

      await Restricao.destroy({ where: { id_retira }, transaction });
      if (id_escolhidos.length) {
        await Restricao.bulkCreate(
          id_escolhidos.map((id_escolhido) => ({ id_retira, id_escolhido })),
          { transaction }
        );
      }
      return true;
    });
    if (!result) throw new ApiError(404, "Participante não encontrado.");
    return res.status(200).json({ mensagem: "Restrições atualizadas." });
}));

router.get("/sorteia", async (req, res) => {
  try {
    await sequelize.transaction(async (transaction) => {
      // Lock the participant rows before checking existing results or writing any pairs.
      const people = await Pessoa.findAll({
        attributes: ["id", "escolheu", "escolhido"],
        order: [["id", "ASC"]],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (people.length < 2) {
        throw new DrawError(422, "Cadastre ao menos duas pessoas antes de sortear.");
      }
      const existing = await Par.count({ transaction });
      if (existing || people.some((person) => person.escolheu || person.escolhido)) {
        throw new DrawError(409, "Já existe um sorteio. Não é possível sortear novamente.");
      }

      const restrictions = await Restricao.findAll({
        attributes: ["id_retira", "id_escolhido"], transaction,
      });
      const pairs = assignPairs(people.map((person) => person.id), restrictions);
      if (!pairs) {
        throw new DrawError(422, "Não há sorteio possível com as restrições atuais.");
      }

      await Par.bulkCreate(pairs, { transaction });
      await Pessoa.update(
        { escolheu: true, escolhido: true },
        { where: { id: { [Op.in]: people.map((person) => person.id) } }, transaction }
      );
    });
    res.status(200).json({ mensagem: "Sorteio Realizado com Sucesso!" });
  } catch (error) {
    res.status(error instanceof DrawError ? error.status : 500).json({
      mensagem: error instanceof DrawError ? error.message : "Não foi possível realizar o sorteio.",
    });
  }
});

router.get("/u/:hash", async (req, res) => {
  try {
    const pessoa = await Pessoa.findOne({ where: { hash: req.params.hash } });
    if (!pessoa) return res.status(404).send("Link não encontrado.");

    const escolhido = await Par.findOne({ where: { id_retira: pessoa.id } });
    if (!escolhido) return res.render("resultado", { pessoa, dados_escolhido: null });

    const dados_escolhido = await Pessoa.findOne({ where: { id: escolhido.id_escolhido } });
    if (!dados_escolhido) return res.status(404).send("Resultado não encontrado.");
    return res.render("resultado", { pessoa, dados_escolhido });
  } catch (_error) {
    return res.status(500).send("Não foi possível consultar o resultado.");
  }
});

module.exports = router;
