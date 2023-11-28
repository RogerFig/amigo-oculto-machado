const Sequelize = require("sequelize");
const databaseConfig = require("./database");

const sequelize = new Sequelize(databaseConfig);

module.exports = sequelize;
