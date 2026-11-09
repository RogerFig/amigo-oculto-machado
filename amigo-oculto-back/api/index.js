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
  const { nome_completo, nick, escolheu, escolhido } = req.body;

  const max_id = await Pessoa.max("id", { where: {} });
  // Only new links change: keep existing hashes so issued links remain valid.
  const hash = crypto.randomBytes(32).toString("hex");

  const novaPessoa = await Pessoa.create({
    id: max_id + 1,
    nome_completo,
    nick,
    escolheu,
    escolhido,
    hash,
  });

  res.status(201).json({ mensagem: "Usuário inserido com sucesso" });
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
  const restricoes = req.body;
  console.log(restricoes);

  const t = await sequelize.transaction();

  try {
    await Restricao.destroy(
      {
        where: {
          id_retira: restricoes[0].id_retira,
        },
      },
      { transaction: t }
    );

    for (const restricao of restricoes) {
      await Restricao.create(
        {
          id_retira: restricao.id_retira,
          id_escolhido: restricao.id_escolhido,
        },
        { transaction: t }
      );
    }
    await t.commit();

    // If the execution reaches this line, the transaction has been committed successfully
    // `result` is whatever was returned from the transaction callback (the `user`, in this case)
  } catch (error) {
    console.log(error);
  }
  res.status(201).json({});
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
