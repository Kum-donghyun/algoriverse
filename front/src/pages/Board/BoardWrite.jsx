import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const BoardWrite = () => {
  const [text, setText] = useState('');
  const [type, setType] = useState('일반');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/board', {
        article_id: 1, // 임시 기사 ID
        question_text: text,
        question_type: type
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert('질문이 등록되었습니다.');
      navigate('/board');
    } catch (error) {
      alert('등록 실패');
    }
  };

  return (
    <div className="board-container">
      <h2>질문하기</h2>
      <form onSubmit={handleSubmit} className="write-form">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="일반">일반 질문</option>
          <option value="오류">오류 신고</option>
          <option value="기타">기타</option>
        </select>
        <textarea 
          placeholder="질문 내용을 입력하세요" 
          value={text} 
          onChange={(e) => setText(e.target.value)} 
          required 
        />
        <div className="write-buttons">
          <button type="button" onClick={() => navigate('/board')} className="btn-cancel">취소</button>
          <button type="submit" className="btn-submit">등록</button>
        </div>
      </form>
    </div>
  );
};

export default BoardWrite;