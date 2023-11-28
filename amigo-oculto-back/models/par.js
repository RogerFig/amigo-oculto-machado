const Par = (sequelize, DataTypes) => {
  const Par = sequelize.define(
    "Par",
    {
      id_retira: {
        type: DataTypes.INTEGER,
      },
      id_escolhido: {
        type: DataTypes.INTEGER,
      },
    },
    {
      tableName: "pares",
      timestamps: false,
    }
  );
  Par.removeAttribute("id");

  return Par;
};

module.exports = Par;
