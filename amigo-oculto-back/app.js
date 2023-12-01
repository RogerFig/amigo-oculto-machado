const express = require("express");
const rotas = require("./api");
const { sequelize } = require("./models");
require("dotenv").config();

const cors = require("cors");

const PORT = process.env.PORT;

const app = express();

app.use(cors());
app.use(express.json());

app.set("view engine", "ejs");
app.set("views", "./views");

app.use("/", rotas);

sequelize.sync().then(() => {
  console.log("Conectado no DB com sucesso!");
});

app.listen(PORT, () => console.log(`Aplicação rodando na porta ${PORT}`));
