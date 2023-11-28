const sequelize = require("../config/sequelize");
const Sequelize = require("sequelize");

const pessoa = require("./pessoa");
const par = require("./par");
const restricao = require("./restricao");

const Pessoa = pessoa(sequelize, Sequelize.DataTypes);
const Par = par(sequelize, Sequelize.DataTypes);
const Restricao = restricao(sequelize, Sequelize.DataTypes);

const db = {
  Pessoa,
  Par,
  Restricao,
  sequelize,
};

module.exports = db;
