import React from 'react';
import '../styles/Loading.css';

const Loading = ({ keyword }) => {
  const steps = [
    { id: 1, text: "뉴스 수집", subText: "검색 키워드로 최대 500개의 뉴스 기사 수집 중..." },
    { id: 2, text: "기사 전문 크롤링", subText: "각 기사의 전문(전체 내용) 수집 중..." },
    { id: 3, text: "프레임 분석", subText: "정치, 감정, 법률 등 카테고리별 분류 중..." },
    { id: 4, text: "결과 시각화", subText: "분석 결과를 프레임별 카드 UI로 준비 중..." },
  ];

  return (
    <div className="loading-container">
      <div className="loading-card">
        <div className="loading-header">
          <div className="icon-main">📊</div>
          <h1>뉴스 프레임 분석 중</h1>
          <p>뉴스 수집 및 분석이 진행 중입니다</p>
          <div className="keyword-badge">검색어: "{keyword}"</div>
        </div>

        {/* 애니메이션 스피너 */}
        <div className="spinner-container">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>

        {/* 프로그레스 바 */}
        <div className="progress-section">
          <div className="progress-bar-wrapper">
            <div className="progress-bar-fill"></div>
          </div>
          <div className="progress-label">진행 중... (약 2-5분 소요)</div>
        </div>

        {/* 단계별 가이드 리스트 */}
        <div className="steps-list">
          {steps.map((step) => (
            <div key={step.id} className="step-item">
              <div className="step-number">{step.id}</div>
              <div className="step-content">
                <span className="step-title">{step.text}</span>
                <span className="step-subtext">{step.subText}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 하단 경고창 */}
        <div className="warning-box">
          <span className="warning-icon">⏱️</span>
          <div className="warning-text">
            <strong>시간이 오래 걸립니다</strong>
            <p>뉴스 크롤링과 프레임 분석은 시간이 소요되는 작업입니다. 이 페이지를 닫지 말고 완료될 때까지 기다려주세요.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Loading;