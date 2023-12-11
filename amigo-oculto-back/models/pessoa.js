const Pessoa = (sequelize, DataTypes) => {
  const Pessoa = sequelize.define(
    "Pessoa",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      nome: {
        type: DataTypes.STRING,
      },
      telefone: {
        type: DataTypes.STRING,
      },
    },
    {
      tableName: "pessoas",
    }
  );
  return Pessoa;
};

module.exports = Pessoa;
