const Restricao = (sequelize, DataTypes) => {
  const Restricao = sequelize.define(
    "Restricao",
    {
      id_retira: {
        type: DataTypes.INTEGER,
      },
      id_escolhido: {
        type: DataTypes.INTEGER,
      },
    },
    {
      tableName: "restritos",
      timestamps: false,
    }
  );
  Restricao.removeAttribute("id");

  return Restricao;
};

module.exports = Restricao;
