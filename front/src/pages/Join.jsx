import React, { useState } from 'react';
import '../styles/Join.css';

const Join = ({ onSwitchToLogin }) => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [recommend, setRecommend] = useState('');

  const [idChecked, setIdChecked] = useState(false);

  const handleIdCheck = async () => {
    if (!id) {
      alert('아이디를 입력해주세요.');
      return;
    }
    try {
      const response = await fetch(`http://localhost:5000/api/user/check/${id}`);
      const data = await response.json();
      if (data.exists) {
        alert('이미 사용중인 아이디입니다.');
        setIdChecked(false);
      } else {
        alert('사용 가능한 아이디입니다.');
        setIdChecked(true);
      }
    } catch (error) {
      console.error('ID 중복 확인 오류:', error);
      alert('ID 중복 확인 중 오류가 발생했습니다.');
    }
  };

  const handleJoinSubmit = async (e) => {
    e.preventDefault();

    if (!idChecked) {
      alert('아이디 중복 확인을 해주세요.');
      return;
    }

    if (password !== confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    const formData = {
      USER_ID: id,
      PW: password,
      NICK: name,
      EMAIL: email,
      BIRTH: dateOfBirth,
      GENDER: gender,
      RECOMMEND: recommend,
    };

    try {
      const response = await fetch('http://localhost:5000/api/user/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        alert('회원가입 성공!');
        onSwitchToLogin(e); // Switch back to login form
      } else {
        alert(`회원가입 실패: ${data.message || '서버 오류'}`);
      }
    } catch (error) {
      console.error('회원가입 에러:', error);
      alert('회원가입 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="join-container">
      <h3>회원가입</h3>
      <form className="join-form" onSubmit={handleJoinSubmit}>
        <div className="join-input-group">
          <label htmlFor="join-id">아이디</label>
          <div className="join-input-with-button">
            <input 
              type="text" 
              id="join-id" 
              placeholder="" 
              style={{ flex: 1 }} 
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                setIdChecked(false);
              }}
              required
            />
            <button type="button" onClick={handleIdCheck} className="join-check-btn">중복 확인</button>
          </div>
        </div>
        <div className="join-input-group">
          <label htmlFor="join-password">비밀번호</label>
          <input 
            type="password" 
            id="join-password" 
            placeholder="" 
            style={{ width: '100%' }} 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="join-input-group">
          <label htmlFor="confirm-password">비밀번호 확인</label>
          <input 
            type="password" 
            id="confirm-password" 
            placeholder="" 
            style={{ width: '100%' }} 
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <div className="join-input-group">
          <label htmlFor="name">이름</label>
          <input 
            type="text" 
            id="name" 
            placeholder="" 
            style={{ width: '100%' }} 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="join-input-group">
          <label htmlFor="email">이메일</label>
          <input 
            type="email" 
            id="email" 
            placeholder="e.g., abc@gmail.com" 
            style={{ width: '100%' }} 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="join-input-group">
          <label htmlFor="date-of-birth">생년월일</label>
          <input 
            type="date" 
            id="date-of-birth" 
            style={{ width: '100%' }} 
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            required
          />
        </div>
        <div className="join-input-group">
          <label htmlFor="gender">성별</label>
          <select 
            id="gender" 
            style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }} 
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            required
          >
            <option value="">선택하세요</option>
            <option value="male">남성</option>
            <option value="female">여성</option>
            <option value="other">기타</option>
          </select>
        </div>
        <div className="join-input-group">
          <label htmlFor="recommend">추천인 (선택 사항)</label>
          <input 
            type="text" 
            id="recommend" 
            placeholder="추천인 아이디" 
            style={{ width: '100%' }} 
            value={recommend}
            onChange={(e) => setRecommend(e.target.value)}
          />
        </div>
        <input type="submit" value="가입하기" className="join-submit-btn" />
      </form>
      <div className="join-footer-links">
        <span>이미 계정이 있으신가요? </span>
        <a href="#" onClick={onSwitchToLogin}>
          로그인
        </a>
      </div>
    </div>
  );
};

export default Join;