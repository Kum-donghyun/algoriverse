// models/index.js에서 export한 db 객체를 그대로 require 
const db = require('../models');
const { Op } = db.Sequelize;
const { Question, Answer, User, Comment, QuestionComment } = db;

// 1. 질문 목록 조회 (작성자 정보 포함)
exports.getQuestions = async (req, res) => {
  try {
    const { searchType, keyword } = req.query;

    const where = { is_active: 1 };
    const include = [{
      model: User,
      attributes: ['NICK', 'USER_ID'],
      required: false // LEFT OUTER JOIN by default
    }, {
      model: Answer,
      attributes: ['answer_id'], // 답변 존재 여부 확인용
      required: false
    }];

    if (keyword && keyword.trim() !== '') {
      // '제목' 또는 '내용' 검색 시 question_text에서 검색
      if (searchType === 'title' || searchType === 'content') {
        where.question_text = { [Op.like]: `%${keyword}%` };
      } 
      // '작성자' 검색 시 User 모델의 NICK에서 검색
      else if (searchType === 'author') {
        include[0].where = { NICK: { [Op.like]: `%${keyword}%` } };
        // INNER JOIN으로 변경하여 NICK이 일치하는 사용자의 질문만 가져옴
        include[0].required = true; 
      }
    }

    const questions = await Question.findAll({
      where,
      order: [['created_at', 'DESC']],
      include
    });
    res.status(200).json(questions);
  } catch (error) {
    console.error('목록 조회 오류:', error);
    res.status(500).json({ message: '목록을 불러오는데 실패했습니다.' });
  }
};

// 2. 질문 상세 및 답변 조회 (작성자 정보 포함)
exports.getQuestionDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const detail = await Question.findOne({
      where: { question_id: id },
      include: [
        {
          model: db.User, // Question 작성자
          attributes: ['NICK', 'USER_ID']
        },
        {
          model: db.Answer,
          include: [
            {
              model: db.Comment,
              include: [{ model: db.User, attributes: ['NICK', 'USER_ID'] }] // Comment 작성자
            }
          ]
        }
      ]
    });

    if (!detail) return res.status(404).json({ message: '글을 찾을 수 없습니다.' });
    res.status(200).json(detail);
  } catch (error) {
    console.error('상세 조회 오류:', error);
    res.status(500).json({ message: '상세 조회 실패' });
  }
};

// 3. 질문 등록
exports.createQuestion = async (req, res) => {
  // 인증 미들웨어를 통과한 사용자 정보가 req.user에 있다고 가정
  if (!req.user || !req.user.USER_ID) {
    return res.status(401).json({ message: '인증 정보가 유효하지 않습니다. 로그인 해주세요.' });
  }

  try {
    const { article_id, question_text, question_type } = req.body;
    const USER_ID = req.user.USER_ID; // JWT 토큰에서 추출한 사용자 ID

    const newQuestion = await Question.create({
      article_id,
      question_text,
      question_type,
      USER_ID // 작성자 ID 추가
    });
    res.status(201).json(newQuestion);
  } catch (error) {
    console.error('글 등록 오류:', error);
    res.status(500).json({ message: '글 등록 실패' });
  }
};

// 4. 질문 수정
exports.updateQuestion = async (req, res) => {
  if (!req.user || !req.user.USER_ID) {
    return res.status(401).json({ message: '인증 정보가 유효하지 않습니다. 로그인 해주세요.' });
  }

  try {
    const { id } = req.params;
    const { question_text, question_type } = req.body;
    const requestUserId = req.user.USER_ID;
    const isAdmin = !!req.user.ADMIN_ID;

    const question = await Question.findByPk(id);
    if (!question) {
      return res.status(404).json({ message: '수정할 글을 찾을 수 없습니다.' });
    }

    // 권한 확인: 관리자이거나, 게시글 작성자 본인일 경우에만 수정 허용
    const isOwner = question.USER_ID === requestUserId;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: '글을 수정할 권한이 없습니다.' });
    }
    
    // 'announcement' 타입의 글은 관리자만 수정 가능
    if (question.question_type === 'announcement' && !isAdmin) {
        return res.status(403).json({ message: '공지사항은 관리자만 수정할 수 있습니다.' });
    }

    await question.update({ question_text, question_type });
    res.status(200).json(question);

  } catch (error) {
    console.error('글 수정 오류:', error);
    res.status(500).json({ message: '글 수정 실패' });
  }
};

// 5. 질문 삭제
exports.deleteQuestion = async (req, res) => {
  if (!req.user || !req.user.USER_ID) {
    return res.status(401).json({ message: '인증 정보가 유효하지 않습니다. 로그인 해주세요.' });
  }
  
  try {
    const { id } = req.params;
    const requestUserId = req.user.USER_ID;
    const isAdmin = !!req.user.ADMIN_ID;

    const question = await Question.findOne({
      where: { question_id: id },
      include: [
        { 
          model: Answer,
          include: [{
            model: Comment
          }]
        }
      ]
    });
    if (!question) {
      return res.status(404).json({ message: '삭제할 글을 찾을 수 없습니다.' });
    }

    // ... ownership/admin checks ...

    // 소프트 삭제 (is_active를 0으로 변경)
    await question.update({ is_active: 0 });

    // 연관된 답변과 댓글도 소프트 삭제
    if (question.Answers) {
      for (const answer of question.Answers) {
        await answer.update({ is_active: 0 });
        if (answer.Comments) {
          for (const comment of answer.Comments) {
            await comment.update({ is_active: 0 });
          }
        }
      }
    }
    res.status(200).json({ message: '글이 성공적으로 삭제되었습니다.' });

  } catch (error) {
    console.error('글 삭제 오류:', error);
    res.status(500).json({ message: '글 삭제 실패' });
  }
};

// 6. 질문 일괄 삭제
exports.deleteBulkQuestions = async (req, res) => {
  // 1. 인증 확인
  if (!req.user || !req.user.USER_ID) {
    return res.status(401).json({ message: '인증 정보가 유효하지 않습니다.' });
  }

  try {
    const { question_ids } = req.body;
    const requestUserId = req.user.USER_ID;
    const isAdmin = !!req.user.ADMIN_ID;

    // 2. ID 목록 유효성 검사
    if (!question_ids || !Array.isArray(question_ids) || question_ids.length === 0) {
      return res.status(400).json({ message: '삭제할 질문 ID 목록을 제공해야 합니다.' });
    }

    // 3. 권한 검사
    if (!isAdmin) {
      // 일반 사용자인 경우, 모든 게시물이 자신의 것인지 확인
      const questions = await Question.findAll({
        where: { question_id: question_ids }
      });
      
      // 요청된 ID 중에 존재하지 않는 게시물이 있거나, 타인의 게시물이 섞여있는 경우
      if (questions.length !== question_ids.length) {
        return res.status(404).json({ message: '일부 게시물을 찾을 수 없습니다. 다시 시도해주세요.'});
      }

      const isOwnerOfAll = questions.every(q => q.USER_ID === requestUserId);
      if (!isOwnerOfAll) {
        return res.status(403).json({ message: '자신이 작성한 게시물만 삭제할 수 있습니다.' });
      }
    }
    
    // 4. 일괄 삭제 (soft delete)
    // 관리자이거나, 모든 게시물 소유가 확인된 사용자
    const result = await Question.update(
      { is_active: 0 },
      { where: { question_id: question_ids } }
    );
    
    if (result[0] > 0) {
      res.status(200).json({ message: `${result[0]}개의 질문이 성공적으로 삭제되었습니다.` });
    } else {
      res.status(404).json({ message: '삭제할 질문을 찾지 못했거나 이미 삭제되었습니다.' });
    }

  } catch (error) {
    console.error('일괄 삭제 오류:', error);
    res.status(500).json({ message: '일괄 삭제 실패' });
  }
};

// 7. 답변 등록 (관리자 전용)
exports.createAnswer = async (req, res) => {
  // 1. 관리자 인증 확인
  if (!req.user || !req.user.ADMIN_ID) {
    return res.status(403).json({ message: '답변을 등록할 권한이 없습니다.' });
  }

  try {
    const { question_id, stance, answer_summary } = req.body;

    // 2. 해당 질문이 존재하는지, 이미 답변이 있는지 확인
    const question = await Question.findByPk(question_id, { include: [Answer] });
    if (!question) {
      return res.status(404).json({ message: '답변할 질문을 찾을 수 없습니다.' });
    }
    if (question.Answers && question.Answers.length > 0) {
      return res.status(400).json({ message: '이미 답변이 등록된 질문입니다.' });
    }

    // 3. 답변 생성
    const newAnswer = await Answer.create({
      question_id,
      stance,
      answer_summary
    });
    res.status(201).json(newAnswer);
  } catch (error) {
    console.error('답변 등록 오류:', error);
    res.status(500).json({ message: '답변 등록에 실패했습니다.' });
  }
};

// 8. 댓글 등록 (사용자)
exports.createComment = async (req, res) => {
  // 1. 사용자 인증 확인
  if (!req.user || !req.user.USER_ID) {
    return res.status(401).json({ message: '인증 정보가 유효하지 않습니다. 로그인 해주세요.' });
  }

  try {
    const { answer_id, comment_text } = req.body;
    const USER_ID = req.user.USER_ID; 

    // 2. 해당 답변이 존재하는지 확인
    const answer = await Answer.findByPk(answer_id);
    if (!answer) {
      return res.status(404).json({ message: '댓글을 달 답변을 찾을 수 없습니다.' });
    }

    // 3. 댓글 생성
    const newComment = await Comment.create({
      answer_id,
      USER_ID,
      comment_text
    });
    res.status(201).json(newComment);
  } catch (error) {
    console.error('댓글 등록 오류:', error);
    res.status(500).json({ message: '댓글 등록에 실패했습니다.' });
  }
};
