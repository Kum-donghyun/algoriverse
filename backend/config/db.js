require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'campus_g_1229_3',
    password: process.env.DB_PASSWORD || 'smhrd3',
    database: process.env.DB_NAME || 'campus_g_1229_3',
    host: process.env.DB_HOST || 'project-db-stu3.smhrd.com',
    port: process.env.DB_PORT || 3307,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000
    }
  },
};