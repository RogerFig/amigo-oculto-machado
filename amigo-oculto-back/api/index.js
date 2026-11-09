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

router.get("/", async (req, res) => {
  const { id } = req.query;

  const results = id
    ? await Pessoa.findAll({
        where: {
          id: id,
        },
      })
    : await Pessoa.findAll();

  return res.json(results);
});

router.post("/", async (req, res) => {
  const { nome_completo, nick, escolheu = false, escolhido = false } = req.body || {};
  if (
    typeof nome_completo !== "string" || !nome_completo.trim() || nome_completo.length > 255 ||
    typeof nick !== "string" || !nick.trim() || nick.length > 255 ||
    typeof escolheu !== "boolean" || typeof escolhido !== "boolean"
  ) {
    return res.status(400).json({ mensagem: "Dados do participante inválidos." });
  }

  try {
    // Let MySQL's autoIncrement allocate the ID, even for concurrent requests.
    await Pessoa.create({
      nome_completo: nome_completo.trim(),
      nick: nick.trim(),
      escolheu,
      escolhido,
      hash: crypto.randomBytes(32).toString("hex"),
    });
    return res.status(201).json({ mensagem: "Usuário inserido com sucesso" });
  } catch (_error) {
    return res.status(500).json({ mensagem: "Não foi possível cadastrar o participante." });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  await Pessoa.destroy({
    where: {
      id: id,
    },
  });

  res.status(204).end();
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nome_completo, nick, escolheu, escolhido } = req.body;

  await Pessoa.update(
    { nome_completo, nick, escolheu, escolhido },
    {
      where: {
        id: id,
      },
    }
  );

  res.status(200).json({ mensagem: "Usuário editado com sucesso!" });
});

// Método de RESET
router.put("/", async (req, res) => {
  await Pessoa.update(
    {
      escolhido: false,
      escolheu: false,
      data: null,
    },
    {
      where: {},
    }
  );

  await Par.destroy({
    truncate: true,
  });

  res.status(200).json({ mensagem: "Base resetada com sucesso!" });
});

// Rotas de restrições
router.get("/restricao", async (req, res) => {
  const restricoes = await Restricao.findAll({
    attributes: ["id_retira", "id_escolhido"],
    where: {},
  });
  res.json(restricoes);
});

router.post("/restricao", async (req, res) => {
  const { id_retira, id_escolhidos } = req.body || {};
  if (
    !Number.isSafeInteger(id_retira) || id_retira < 1 ||
    !Array.isArray(id_escolhidos) ||
    id_escolhidos.some((id) => !Number.isSafeInteger(id) || id < 1 || id === id_retira) ||
    new Set(id_escolhidos).size !== id_escolhidos.length
  ) {
    return res.status(400).json({ mensagem: "Restrições inválidas." });
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const giver = await Pessoa.findByPk(id_retira, { transaction, lock: transaction.LOCK.UPDATE });
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
    if (!result) return res.status(404).json({ mensagem: "Participante não encontrado." });
    return res.status(200).json({ mensagem: "Restrições atualizadas." });
  } catch (_error) {
    return res.status(500).json({ mensagem: "Não foi possível salvar as restrições." });
  }
});

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
