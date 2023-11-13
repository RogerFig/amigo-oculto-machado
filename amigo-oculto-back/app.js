const express = require("express");

const PORT = 3000;

const app = express();

app.use(express.json());

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

app.get("/", (req, res) => {});

app.post("/", (req, res) => {});

app.delete("/:id", (req, res) => {});

app.put("/:id", (req, res) => {});

app.listen(PORT, () => console.log(`Aplicação rodando na porta ${PORT}`));
