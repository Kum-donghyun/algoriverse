module.exports = (sequelize, DataTypes) => {
  const Chatbot = sequelize.define('Chatbot', {
    id: { 
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      autoIncrement: true,
      field: 'id' 
    },
    user_message: { 
      type: DataTypes.TEXT, 
      allowNull: true,
      field: 'user_message' 
    },
    bot_message: { 
      type: DataTypes.TEXT, 
      allowNull: true,
      field: 'bot_message' 
    },
    created_at: { 
      type: DataTypes.DATE, 
      defaultValue: DataTypes.NOW,
      field: 'created_at' 
    }
  }, {
    tableName: 'chat_logs',
    timestamps: false
  });

  return Chatbot;
};