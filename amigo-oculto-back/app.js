const express = require("express");
const rotas = require("./api");
const cors = require("cors");

const PORT = 3000;

const app = express();

app.use(cors());
app.use(express.json());

app.use("/", rotas);

app.listen(PORT, () => console.log(`Aplicação rodando na porta ${PORT}`));
