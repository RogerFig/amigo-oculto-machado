const express = require("express");
const router = express.Router();
const { Pessoa, Par, Restricao, sequelize } = require("../models");
const crypto = require("crypto");
const { Op } = require("sequelize");

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
  const hashfull = crypto.createHash("md5").update(nome_completo).digest("hex");

  const novaPessoa = await Pessoa.create({
    id: max_id + 1,
    nome_completo,
    nick,
    escolheu,
    escolhido,
    hash: hashfull.substring(0, 8),
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

function shuffle(array) {
  array.sort(() => Math.random() - 0.5);
}

router.get("/sorteia", async (req, res) => {
  const todos = await Pessoa.findAll({ attributes: ["id"] });
  // console.log(Math.floor(Math.random() * todos.length + 1));
  shuffle(todos);
  try {
    for (const pessoa of todos) {
      const restricoes = await Restricao.findAll({
        attributes: ["id_escolhido"],
        where: { id_retira: pessoa.id },
      });

      const restricoesId = [];

      restricoes.forEach((element) => {
        restricoesId.push(element.id_escolhido);
      });

      const disponiveis = await Pessoa.findAll({
        attributes: ["id"],
        where: {
          id: {
            [Op.notIn]: restricoesId,
          },
          escolhido: {
            [Op.eq]: 0,
          },
        },
      });

      shuffle(disponiveis);

      const indice = Math.floor(Math.random() * disponiveis.length);
      console.log(
        `Indice: ${indice} -> Disponíveis: ${disponiveis} -> Tamanho: ${disponiveis.length}`
      );
      const escolhido = disponiveis[indice];

      //update retirou

      await Pessoa.update(
        { escolheu: 1 },
        {
          where: {
            id: pessoa.id,
          },
        }
      );

      //update escolhido

      await Pessoa.update(
        { escolhido: 1 },
        {
          where: {
            id: escolhido.id,
          },
        }
      );

      //insert par
      await Par.create({
        id_retira: pessoa.id,
        id_escolhido: escolhido.id,
      });
    }
    res.status(200).json({ mensagem: "Sorteio Realizado com Sucesso!" });
  } catch (error) {
    res
      .status(400)
      .json({ mensagem: "Ocorreu algum problema, refazer...", erro: error });
  }
});

router.get("/u/:hash", async (req, res) => {
  const { hash } = req.params;

  const pessoa = await Pessoa.findOne({
    where: {
      hash: hash,
    },
  });

  const escolhido = await Par.findOne({
    where: {
      id_retira: pessoa.id,
    },
  });

  const dados_escolhido = await Pessoa.findOne({
    where: {
      id: escolhido.id_escolhido,
    },
  });

  res.render("resultado", { pessoa, escolhido, dados_escolhido });
});

module.exports = router;
