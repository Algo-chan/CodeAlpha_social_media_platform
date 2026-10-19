const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Follow = sequelize.define(
    'Follow',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      follower_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      following_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
    },
    {
      tableName: 'follows',
      underscored: true,
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['follower_id', 'following_id'],
        },
      ],
      validate: {
        notSelfFollow() {
          if (
            this.follower_id &&
            this.following_id &&
            String(this.follower_id) === String(this.following_id)
          ) {
            throw new Error('Self-following is not allowed');
          }
        },
      },
      hooks: {
        beforeValidate(follow) {
          if (
            follow.follower_id &&
            follow.following_id &&
            String(follow.follower_id) === String(follow.following_id)
          ) {
            throw new Error('Self-following is not allowed');
          }
        },
        beforeCreate(follow) {
          if (
            follow.follower_id &&
            follow.following_id &&
            String(follow.follower_id) === String(follow.following_id)
          ) {
            throw new Error('Self-following is not allowed');
          }
        },
        beforeUpdate(follow) {
          if (
            follow.follower_id &&
            follow.following_id &&
            String(follow.follower_id) === String(follow.following_id)
          ) {
            throw new Error('Self-following is not allowed');
          }
        },
      },
    }
  );

  return Follow;
};
