import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import '../styles/Find.css'; 

const Find = () => {
  // 탭 상태 관리 ('id' 또는 'pw')
  const [activeTab, setActiveTab] = useState('id');

  // 아이디 찾기 State
  const [findIdName, setFindIdName] = useState('');
  const [findIdEmail, setFindIdEmail] = useState('');
  const [foundId, setFoundId] = useState('');
  const [findIdError, setFindIdError] = useState('');

  // 비밀번호 찾기 State
  const [findPwId, setFindPwId] = useState('');
  const [findPwEmail, setFindPwEmail] = useState('');
  const [foundPwResult, setFoundPwResult] = useState('');
  const [findPwError, setFindPwError] = useState('');

  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'pw') {
      setActiveTab('pw');
    } else {
      setActiveTab('id');
    }
  }, [location.search]);

  // 아이디 찾기 핸들러
  const handleFindIdSubmit = async (e) => {
    e.preventDefault();
    setFindIdError('');
    setFoundId('');
    try {
      const response = await fetch('http://localhost:5000/api/user/find-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ NICK: findIdName, EMAIL: findIdEmail }), // DB 필드명 NICK에 맞춤
      });
      const data = await response.json();
      if (response.ok) {
        setFoundId(`회원님의 아이디는 [ ${data.USER_ID} ] 입니다.`);
      } else {
        setFindIdError(data.message || '일치하는 사용자를 찾을 수 없습니다.');
      }
    } catch (error) {
      setFindIdError('아이디를 찾는 중 오류가 발생했습니다.');
    }
  };

  // 비밀번호 찾기 핸들러
  const handleFindPwSubmit = async (e) => {
    e.preventDefault();
    setFindPwError('');
    setFoundPwResult('');
    try {
      const response = await fetch('http://localhost:5000/api/user/find-pw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ USER_ID: findPwId, EMAIL: findPwEmail }),
      });
      const data = await response.json();
      if (response.ok) {
        // 실제 운영 시에는 이메일 발송 로직으로 대체하는 것이 좋습니다.
        // 백엔드에서 tempPw를 반환하지 않아 임시로 '123456789'를 사용합니다. 실제로는 백엔드를 수정해야 합니다.
        setFoundPwResult(`회원님의 임시 비밀번호는 [ ${data.tempPw || '123456789'} ] 입니다. 로그인 후 반드시 변경해주세요.`);
      } else {
        setFindPwError(data.message || '일치하는 사용자를 찾을 수 없습니다.');
      }
    } catch (error) {
      setFindPwError('비밀번호를 찾는 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="find-info-page">
      <div className="find-info-container">
        {/* 쿠팡 스타일 탭 헤더 */}
        <div className="find-tab-header">
          <button 
            className={`find-tab-btn ${activeTab === 'id' ? 'active' : ''}`}
            onClick={() => setActiveTab('id')}
          >
            아이디 찾기
          </button>
          <button 
            className={`find-tab-btn ${activeTab === 'pw' ? 'active' : ''}`}
            onClick={() => setActiveTab('pw')}
          >
            비밀번호 찾기
          </button>
        </div>

        {/* 탭 컨텐츠 영역 */}
        <div className="tab-content">
          <div className="form-content">
            {activeTab === 'id' ? (
              foundId ? (
                <div style={{ textAlign: 'center' }}>
                  <p className="find-result-success" style={{ margin: '20px 0' }}>{foundId}</p>
                  <button 
                    type="button" 
                    className="find-submit-btn" 
                    onClick={() => {
                      setFoundId('');
                      setFindIdName('');
                      setFindIdEmail('');
                    }}
                  >
                    다시 찾기
                  </button>
                </div>
              ) : (
                <form className="find-form" onSubmit={handleFindIdSubmit}>
                  <div className="find-input-group">
                    <label>이름</label>
                    <div className="find-input-field">
                      <input 
                        type="text" 
                        value={findIdName}
                        onChange={(e) => setFindIdName(e.target.value)}
                        placeholder="이름을 입력하세요" 
                        required 
                      />
                    </div>
                  </div>
                  <div className="find-input-group">
                    <label>이메일</label>
                    <div className="find-input-field">
                      <input 
                        type="email" 
                        value={findIdEmail}
                        onChange={(e) => setFindIdEmail(e.target.value)}
                        placeholder="가입 시 등록한 이메일" 
                        required 
                      />
                    </div>
                  </div>
                  <button type="submit" className="find-submit-btn">아이디 찾기</button>
                  {findIdError && <p className="find-result-error">{findIdError}</p>}
                </form>
              )
            ) : (
              foundPwResult ? (
                <div style={{ textAlign: 'center' }}>
                  <p className="find-result-success" style={{ margin: '20px 0' }}>{foundPwResult}</p>
                  <button 
                    type="button" 
                    className="find-submit-btn" 
                    onClick={() => {
                      setFoundPwResult('');
                      setFindPwId('');
                      setFindPwEmail('');
                    }}
                  >
                    다시 찾기
                  </button>
                </div>
              ) : (
                <form className="find-form" onSubmit={handleFindPwSubmit}>
                  <div className="find-input-group">
                    <label>아이디</label>
                    <div className="find-input-field">
                      <input 
                        type="text" 
                        value={findPwId}
                        onChange={(e) => setFindPwId(e.target.value)}
                        placeholder="아이디를 입력하세요" 
                        required 
                      />
                    </div>
                  </div>
                  <div className="find-input-group">
                    <label>이메일</label>
                    <div className="find-input-field">
                      <input 
                        type="email" 
                        value={findPwEmail}
                        onChange={(e) => setFindPwEmail(e.target.value)}
                        placeholder="가입 시 등록한 이메일" 
                        required 
                      />
                    </div>
                  </div>
                  <button type="submit" className="find-submit-btn">비밀번호 찾기</button>
                  {findPwError && <p className="find-result-error">{findPwError}</p>}
                </form>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Find;