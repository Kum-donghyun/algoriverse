import React, { useState } from 'react';
import '../styles/Login.css';
import Join from './Join'; // Join 컴포넌트를 import 합니다.

const Login = ({ isVisible, onClose, onLoginSuccess }) => {
  const [showLogin, setShowLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  if (!isVisible) return null;

  const handleSwitchToJoin = (e) => {
    e.preventDefault(); // 링크의 기본 동작(페이지 이동)을 막습니다.
    setShowLogin(false);
  };

  const handleSwitchToLogin = (e) => {
    e.preventDefault();
    setShowLogin(true);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (username.trim() === '' || password.trim() === '') {
      alert('아이디와 비밀번호를 모두 입력하세요.');
      return;
    }
    
    try {
      const response = await fetch('http://localhost:5000/api/user/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ USER_ID: username, PW: password }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('로그인 성공!');
        // Store the token in localStorage
        localStorage.setItem('token', data.token);
        onLoginSuccess(data.user);
      } else {
        alert(`로그인 실패: ${data.message || '서버 오류'}`);
      }
    } catch (error) {
      console.error('로그인 에러:', error);
      alert('로그인 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>&times;</button>
        
        {showLogin ? (
          <form className="login-form" onSubmit={handleLoginSubmit}>
            <div className="login-input-group">
              <label htmlFor="id-or-phone">아이디</label>
              <input 
                type="text" 
                id="id-or-phone" 
                placeholder="" 
                style={{ width: '100%' }} 
                className="login-id-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="login-input-group login-password-group">
              <label htmlFor="password">비밀번호</label>
              <input 
                type="password" 
                id="password" 
                placeholder="" 
                style={{ width: '100%' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <input type="submit" value="로그인" className="login-submit-btn" />

            <div className="login-footer-links">
              <a href="/find?tab=id">아이디 찾기</a> | 
              <a href="/find?tab=pw">비밀번호 찾기</a> | 
              <a 
                href="#" 
                onClick={handleSwitchToJoin} 
                style={{ padding: '0 5px' }}
              >
                회원가입
              </a>
            </div>
          </form>
        ) : (
          <Join onSwitchToLogin={handleSwitchToLogin} />
        )}
      </div>
    </div>
  );
};

export default Login;
