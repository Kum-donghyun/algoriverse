import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const BoardEdit = () => {
  const { id } = useParams();
  const [text, setText] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDetail = async () => {
      const res = await axios.get(`http://localhost:5000/api/board/${id}`);
      setText(res.data.question_text);
    };
    fetchDetail();
  }, [id]);

  const handleUpdate = async () => {
    try {
      await axios.put(`http://localhost:5000/api/board/${id}`, { question_text: text }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert('수정되었습니다.');
      navigate(`/board/${id}`);
    } catch (error) {
      alert('수정 실패');
    }
  };

  return (
    <div className="board-container">
      <h2>질문 수정</h2>
      <textarea 
        className="edit-textarea"
        value={text} 
        onChange={(e) => setText(e.target.value)} 
      />
      <div className="write-buttons">
        <button onClick={() => navigate(-1)} className="btn-cancel">취소</button>
        <button onClick={handleUpdate} className="btn-submit">수정 완료</button>
      </div>
    </div>
  );
};

export default BoardEdit;