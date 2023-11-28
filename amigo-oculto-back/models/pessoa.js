const Pessoa = (sequelize, DataTypes) => {
  const Pessoa = sequelize.define(
    "Pessoa",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      nick: {
        type: DataTypes.STRING,
      },
      nome_completo: {
        type: DataTypes.STRING,
      },
      escolheu: {
        type: DataTypes.BOOLEAN,
      },
      escolhido: {
        type: DataTypes.BOOLEAN,
      },
      data: {
        type: DataTypes.DATE,
      },
      hash: {
        type: DataTypes.STRING,
      },
    },
    {
      tableName: "pessoas",
      timestamps: false,
    }
  );

  return Pessoa;
};

module.exports = Pessoa;
