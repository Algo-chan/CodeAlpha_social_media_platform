const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Like = sequelize.define(
    'Like',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      post_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'posts',
          key: 'id',
        },
      },
    },
    {
      tableName: 'likes',
      underscored: true,
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['user_id', 'post_id'],
        },
      ],
    }
  );

  return Like;
};
