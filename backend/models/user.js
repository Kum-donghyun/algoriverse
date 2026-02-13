module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    USER_ID:   { type: DataTypes.STRING(50), primaryKey: true, allowNull: false, field: 'USER_ID' },
    PW:        { type: DataTypes.STRING(100), allowNull: false, field: 'PW' },
    NICK:      { type: DataTypes.STRING(50),  allowNull: false, field: 'NICK' }, // NN(Not Null) 체크됨
    BIRTH:     { type: DataTypes.DATEONLY,    allowNull: false, field: 'BIRTH' }, // NN 체크됨
    GENDER:    { type: DataTypes.STRING(50),  allowNull: false, field: 'GENDER' }, // ENUM 대신 DB 사양에 맞춤
    RECOMMEND: { type: DataTypes.TINYINT,     allowNull: true,  field: 'RECOMMEND' }, // STRING에서 TINYINT로 수정
    EMAIL:     { type: DataTypes.STRING(100), allowNull: true,  field: 'EMAIL' }, // Add EMAIL field
    ADMIN_ID:  { type: DataTypes.STRING(45),  allowNull: true, field: 'ADMIN_ID' }, // 관리자 ID, 일반 사용자는 null
    // deletedYN: DB 테이블에 컬럼이 없다면 이 줄은 삭제하거나 DB에 컬럼을 추가해야 합니다.
  }, {
    tableName: 'USER', // Workbench 상단에 대문자 USER로 표시됨 확인
    timestamps: false,
    underscored: false,
  });

  // 모델 관계 설정을 위한 associate 메소드
  User.associate = (db) => {
    // User는 여러 Question을 가질 수 있다 (1:N)
    User.hasMany(db.Question, { foreignKey: 'USER_ID', sourceKey: 'USER_ID' });
  };

  User.addHook('beforeCreate', async (user) => {
    if (user.PW) {
      const bcrypt = require('bcrypt');
      user.PW = await bcrypt.hash(user.PW, 10);
    }
  });

  User.addHook('beforeUpdate', async (user) => {
    if (user.changed('PW')) {
      const bcrypt = require('bcrypt');
      user.PW = await bcrypt.hash(user.PW, 10);
    }
  });

  return User;
};