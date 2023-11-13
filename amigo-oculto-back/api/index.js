const express = require("express");

const router = express.Router();

lista_pessoas = [
  {
    id: "1",
    nome: "Maria José",
    telefone: "86999885544",
  },
  {
    id: "2",
    nome: "José Maria",
    telefone: "86999885544",
  },
  {
    id: "3",
    nome: "Marta Maria",
    telefone: "86999885544",
  },
  {
    id: "4",
    nome: "João Maria",
    telefone: "86999885544",
  },
];

let proxId = lista_pessoas.length + 1;

router.get("/", (req, res) => {
  const { id } = req.query;
  console.log(req.query);
  const results = id
    ? lista_pessoas.filter((user) => user.id === id)
    : lista_pessoas;
  // console.log(results);
  return res.json(results);
});

router.post("/", (req, res) => {
  const dados = req.body;
  const novoUser = {
    id: `${proxId}`,
    nome: dados.nome,
    telefone: dados.telefone,
  };
  lista_pessoas.push(novoUser);
  proxId++;
  res.status(201).json({ mensagem: "Usuário inserido com sucesso" });
});

router.delete("/:id", (req, res) => {
  const { id } = req.params;
  result = lista_pessoas.filter((pessoa) => pessoa.id === id);
  if (result) {
    lista_pessoas = lista_pessoas.filter((pessoa) => pessoa.id !== id);
    res.status(204).end();
  } else {
    res.status(400).json({ mensagem: "Não encontrado." });
  }
  // console.log(lista_pessoas);
});

router.put("/:id", (req, res) => {
  const { id } = req.params;
  const pessoa = req.body;
  console.log(`Recebi a edição do id ${id}`);

  lista_pessoas.forEach((element) => {
    if (element.id === id) {
      element.nome = pessoa.nome;
      element.telefone = pessoa.telefone;
      return;
    }
  });
  console.log(lista_pessoas);
  res.status(200).json({ mensagem: "Usuário editado com sucesso!" });
});

module.exports = router;
