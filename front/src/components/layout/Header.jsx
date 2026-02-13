import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PersonaSelector from '../common/PersonaSelector';
import '../../styles/Header.css';

const Header = ({ onLoginClick, loggedInUser, onLogout, onSearch, onLogoClick }) => {
  const [inputValue, setInputValue] = useState('');
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const navigate = useNavigate();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch && inputValue.trim()) {
      onSearch(inputValue);
    }
  };

  return (
    <header className="site-header">
      {/* 1. 로고 영역 */}
      <span className="logo" onClick={onLogoClick} style={{ cursor: 'pointer' }}>Algoriverse</span>
      
      {/* 2. 검색창 영역 - flex: 1로 공간을 다 먹어야 함 */}
      <div className="site-header__search-container">
        <form onSubmit={handleSearchSubmit}>
          <input 
            type="text" 
            placeholder="검색어 입력 (예: 해산, 선거, 경제)" 
            className="site-header__search-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button type="submit" className="site-header__search-btn">검색</button>
        </form>
      </div>

      {/* 3. 우측 버튼 영역 - flex-shrink: 0으로 찌그러짐 방지 */}
      <div className="header-right">
        <button 
          className="header-menu-btn" 
          onClick={() => navigate('/education-template')}
          title="교육 자료 템플릿"
        >
          📋 교육자료
        </button>
        <button 
          className="header-menu-btn" 
          onClick={() => navigate('/quiz')}
          title="편향성 퀴즈"
        >
          🎮 퀴즈
        </button>
        <button 
          className="persona-btn" 
          onClick={() => setShowPersonaModal(true)}
          title="페르소나 변경"
        >
          👤
        </button>
        <button 
          className="dashboard-btn" 
          onClick={() => navigate('/dashboard')}
          title="마이 대시보드"
        >
          📊
        </button>
        {loggedInUser ? (
          <div className="user-info">
            <span>{loggedInUser.NICK}님</span>
            <button className="logout-btn" onClick={onLogout}>로그아웃</button>
          </div>
        ) : (
          <button className="login-btn" onClick={onLoginClick}>로그인</button>
        )}
      </div>
      
      {showPersonaModal && (
        <PersonaSelector 
          onClose={() => setShowPersonaModal(false)}
          onSelect={() => window.location.reload()}
        />
      )}
    </header>
  );
};

export default Header;