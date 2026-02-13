require('dotenv').config();

const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config/db')[process.env.NODE_ENV || 'development'];

// 데이터베이스가 없으면 생성하기 위한 초기 연결
const sequelizeInitial = new Sequelize({
  username: config.username,
  password: config.password,
  host: config.host,
  port: config.port,
  dialect: config.dialect,
  logging: false
});

// 동기적으로 데이터베이스 생성 시도
try {
  sequelizeInitial.sync({ force: false });
  sequelizeInitial.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`).catch(() => {});
  console.log(`📁 데이터베이스 생성 확인 완료`);
} catch (e) {
  console.warn(`⚠️ 데이터베이스 생성 중 경고:`, e.message);
}

// 메인 Sequelize 연결
const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  { ...config, logging: false }
);

const db = {};

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