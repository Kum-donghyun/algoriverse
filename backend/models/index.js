require('dotenv').config();

const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config/db')[process.env.NODE_ENV || 'development'];

// 메인 Sequelize 연결
const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  { ...config, logging: false }
);const db = {};

// 모델 로드
db.User = require('./user')(sequelize, DataTypes);

// --- 챗봇 모델 로드 추가 ---
db.Chatbot = require('./chatbot')(sequelize, DataTypes); 

const boardModels = require('./board')(sequelize, DataTypes);
db.Question = boardModels.Question;
db.Answer = boardModels.Answer;
db.Comment = boardModels.Comment;

// powerConsumption.js 로드 로직
try {
  const powerConsumptionModel = require('./powerConsumption');
  if (powerConsumptionModel && typeof powerConsumptionModel === 'function') {
    db.PowerConsumption = powerConsumptionModel(sequelize, DataTypes);
  }
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') {
    console.error("Error loading powerConsumption model:", e);
  }
}

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// 모델 간 관계 설정
Object.keys(db).forEach(modelName => {
  if (db[modelName] && db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;