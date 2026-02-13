import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Introduce.css';

const Introduce = () => {
    const navigate = useNavigate();

    const handleNavClick = (path) => {
        navigate(`/${path}`);
    };

    return (
        <nav id="sideMenu" className="sidebar-visible">
            
            {/* (1) Algoriverse 소개 타이틀 */}
            <h2 className="sidebar-title">
                <span className="icon">📖</span> Algoriverse 소개
            </h2>
            
            {/* (2) 플랫폼 소개 섹션 */}
            <div className="sidebar-section">
                <h3 className="section-header">
                    <span className="icon">🌐</span> 플랫폼 소개
                </h3>
                <p className="section-description">
                    뉴스 속 다양한 프레임을 분석하고, 사용자가 균형 잡힌 시각을 형성할 수 있도록 돕는 중립적·참여형 뉴스 플랫폼입니다.
                </p>
            </div>

            {/* (3) 주요 특징 섹션 */}
            <div className="sidebar-section">
                <h3 className="section-header">
                    <span className="icon">✨</span> 주요 특징
                </h3>
                <ul className="sidebar-section-list">
                    <li>AI 기반 프레임 분석</li>
                    <li>여러 관점에서 뉴스 분류</li>
                    <li onClick={() => handleNavClick('visualization')} style={{cursor: 'pointer'}}>시각화 기반 정보 제공</li>
                    <li>사용자 참여형 데이터 생성</li>
                </ul>
            </div>
            
            {/* (4) 핵심 기능 섹션 */}
            <div className="sidebar-section">
                <h3 className="section-header">
                    <span className="icon">🔍</span> 핵심 기능
                </h3>
                {/* 핵심 기능은 점 리스트 대신 들여쓰기 없는 스타일 적용 */}
                <ul className="key-feature-list"> 
                    <li>
                        <strong>뉴스 수집 & 분석</strong>
                        <span>키워드 기반 자동 수집</span>
                    </li>
                    <li>
                        <strong>프레임 분류</strong>
                        <span>정치, 경제, 사회 등 다각 분석</span>
                    </li>
                    <li onClick={() => handleNavClick('wordcloud')} style={{cursor: 'pointer'}}>
                        <strong>워드클라우드 시각화</strong>
                        <span>핵심 키워드 동적 표시</span>
                    </li>
                    <li onClick={() => handleNavClick('visualization')} style={{cursor: 'pointer'}}>
                        <strong>시각화</strong>
                        <span>분석 결과 시각화</span>
                    </li>
                </ul>
            </div>

            {/* (5) 목표 섹션 */}
            <div className="sidebar-section">
                <h3 className="section-header">
                    <span className="icon">🧩</span> 목표
                </h3>
                <p className="section-description">
                    단순한 뉴스 모음이 아닌, 서로의 관점을 이해하고 토론하는 공론장을 만드는 것입니다.
                </p>
                
                {/* 하단 분리된 텍스트 */}
                <p className="goal-subtext">
                    확증편향을 극복하고 균형 잡힌 정보 소비를 지향합니다.
                </p>
            </div>

        </nav>
    );
};

export default Introduce;