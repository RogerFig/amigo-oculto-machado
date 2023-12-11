const sequelize = require("../config/sequelize");
const Sequelize = require("sequelize");

const pessoa = require("./pessoa");

const Pessoa = pessoa(sequelize, Sequelize.DataTypes);

const db = {
  Pessoa,
  sequelize,
};

module.exports = db;
