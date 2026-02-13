import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../styles/board.css';

const BoardDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [answerStance, setAnswerStance] = useState('중립');
  const [answerSummary, setAnswerSummary] = useState('');

  const user = JSON.parse(localStorage.getItem('user'));
  const isAdmin = user && (user.ADMIN_ID || user.ROLE === 'ADMIN' || user.NICK === '관리자');

  const fetchDetail = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/board/${id}`);
      setPost(response.data);
    } catch (error) {
      console.error("데이터 로딩 실패:", error);
      navigate('/board');
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (!answerSummary.trim()) {
      alert('답변 내용을 입력해주세요.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/board/answer', 
        { question_id: id, stance: answerStance, answer_summary: answerSummary },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      alert('답변이 등록되었습니다.');
      setAnswerSummary('');
      fetchDetail();
    } catch (error) {
      alert('답변 등록 실패');
    }
  };

  if (!post) return <div className="loading">로딩 중...</div>;

  const currentAnswers = post.Answers || post.answers || [];

  return (
    <div className="board-container">
      {/* 질문 헤더 */}
      <div className="detail-header">
        <h3>{post.question_text}</h3>
        <div className="post-info">
          <span>작성일: {new Date(post.created_at).toLocaleDateString()}</span>
          <span>유형: {post.question_type}</span>
        </div>
      </div>

      {/* 질문 본문 */}
      <div className="detail-content">
        {post.question_text}
      </div>

      {/* 1. 답변 목록 - CSS의 .answer-item 클래스 적용 */}
      <div className="answers-section">
        {currentAnswers.map(ans => (
          <div key={ans.answer_id} className="answer-item">
            <div className="answer-badge">답변 [{ans.stance}]</div>
            <div className="answer-body" style={{ whiteSpace: 'pre-wrap' }}>{ans.answer_summary}</div>
          </div>
        ))}
      </div>

      {/* 2. 관리자 답변 등록 폼 - CSS 클래스로 완전 교체 */}
      {isAdmin && (
        <div className="admin-reply-box">
          <div className="admin-reply-header">
            <div className="admin-reply-title">
              <span>💬</span> 관리자 답변 작성
            </div>
            <select 
              className="stance-select"
              value={answerStance} 
              onChange={(e) => setAnswerStance(e.target.value)}
            >
              <option value="진보">진보</option>
              <option value="보수">보수</option>
              <option value="중립">중립</option>
            </select>
          </div>
          <textarea
            className="admin-reply-textarea"
            value={answerSummary}
            onChange={(e) => setAnswerSummary(e.target.value)}
            placeholder="답변 내용을 입력하세요."
          />
          <div className="admin-reply-footer">
            <button onClick={handleSubmitAnswer} className="btn-edit">답변 등록</button>
          </div>
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="detail-buttons">
        <button onClick={() => navigate('/board')} className="btn-list">목록으로</button>
        {(user?.USER_ID === post.USER_ID || isAdmin) && (
          <button onClick={() => navigate(`/board/edit/${id}`)} className="btn-edit">수정</button>
        )}
      </div>
    </div>
  );
};

export default BoardDetail;