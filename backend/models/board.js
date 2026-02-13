module.exports = (sequelize, DataTypes) => {
  // 1. 질문(Question) 모델 정의
  const Question = sequelize.define('Question', {
    question_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    article_id: { type: DataTypes.INTEGER, allowNull: false },
    USER_ID: { type: DataTypes.STRING(50), allowNull: false }, 
    question_text: { type: DataTypes.STRING(300), allowNull: false },
    question_type: { type: DataTypes.STRING(50), defaultValue: null }, 
    is_active: { type: DataTypes.TINYINT(1), defaultValue: 1 },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'qna_question',
    timestamps: false
  });

  // 2. 답변(Answer) 모델 정의
  const Answer = sequelize.define('Answer', {
    answer_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    question_id: { type: DataTypes.INTEGER, allowNull: false },
    stance: { type: DataTypes.ENUM('진보', '보수', '중립'), allowNull: false },
    answer_summary: { type: DataTypes.TEXT, allowNull: true },
    is_active: { type: DataTypes.TINYINT(1), defaultValue: 1 }, // DB 컬럼 추가 완료
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'qna_answer',
    timestamps: false
  });

  // 3. 댓글(Comment) 모델 정의
  const Comment = sequelize.define('Comment', {
    comment_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    answer_id: { type: DataTypes.INTEGER, allowNull: false },
    USER_ID: { type: DataTypes.STRING(50), allowNull: false }, // DB 컬럼 추가 완료
    comment_text: { type: DataTypes.TEXT, allowNull: false },
    is_active: { type: DataTypes.TINYINT(1), defaultValue: 1 }, // DB 컬럼 추가 완료
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'qna_comment',
    timestamps: false
  });

  // --- 모델 관계 설정 (Associations) ---

  Question.associate = (db) => {
    // Question(1) : Answer(N)
    Question.hasMany(db.Answer, { foreignKey: 'question_id', sourceKey: 'question_id' });
    // Question(N) : User(1)
    Question.belongsTo(db.User, { foreignKey: 'USER_ID', targetKey: 'USER_ID', onDelete: 'CASCADE' });

  };

  Answer.associate = (db) => {
    // Answer(N) : Question(1)
    Answer.belongsTo(db.Question, { foreignKey: 'question_id', targetKey: 'question_id' });
    // Answer(1) : Comment(N) - for answer-level comments
    Answer.hasMany(db.Comment, { foreignKey: 'answer_id', sourceKey: 'answer_id' });
  };

  Comment.associate = (db) => {
    // Comment(N) : Answer(1) - for answer-level comments
    Comment.belongsTo(db.Answer, { foreignKey: 'answer_id', targetKey: 'answer_id' });

    // Comment(N) : User(1) - 작성자 확인을 위해 추가
    Comment.belongsTo(db.User, { foreignKey: 'USER_ID', targetKey: 'USER_ID', onDelete: 'CASCADE' });
  };

  return { Question, Answer, Comment };
};