import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/WelcomeModal.css';

const WelcomeModal = () => {
    const [isVisible, setIsVisible] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // 이전에 방문한 적이 있는지 확인
        const hasVisited = localStorage.getItem('hasVisitedAlgoriverse');
        
        if (!hasVisited) {
            // 0.5초 후 모달 표시 (페이지 로드 후 자연스럽게)
            setTimeout(() => {
                setIsVisible(true);
            }, 500);
        }
    }, []);

    const handlePersonaSelect = (personaType) => {
        // 선택한 페르소나를 localStorage에 저장
        localStorage.setItem('userPersona', personaType);
        localStorage.setItem('hasVisitedAlgoriverse', 'true');
        
        // 모달 닫기
        setIsVisible(false);
        
        // 페르소나별 간단한 안내 메시지
        const messages = {
            professional: '💼 직장인을 위한 빠른 이슈 파악 기능을 강조합니다.',
            student: '📚 대학생/연구자를 위한 다양한 관점 비교 기능을 준비했습니다.',
            educator: '👨‍🏫 교육자를 위한 미디어 리터러시 자료를 제공합니다.',
            general: '🔍 균형잡힌 뉴스 소비를 도와드리겠습니다.'
        };
        
        // 간단한 알림 (선택사항)
        setTimeout(() => {
            alert(messages[personaType]);
        }, 300);
    };

    const handleSkip = () => {
        localStorage.setItem('hasVisitedAlgoriverse', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="welcome-modal-overlay" onClick={handleSkip}>
            <div className="welcome-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={handleSkip}>✕</button>
                
                <div className="modal-header">
                    <h2>알고리버스에 오신 것을 환영합니다!</h2>
                    <p className="modal-subtitle">당신은 어떤 목적으로 방문하셨나요?</p>
                    <p className="modal-description">
                        선택하시면 맞춤형 기능을 강조하여 보여드립니다.
                    </p>
                </div>

                <div className="persona-cards">
                    <div 
                        className="persona-card professional"
                        onClick={() => handlePersonaSelect('professional')}
                    >
                        <div className="card-icon">💼</div>
                        <h3>직장인</h3>
                        <p className="card-description">
                            빠른 이슈 파악, 트렌드 키워드
                        </p>
                        <ul className="card-features">
                            <li>✓ 5분 브리핑</li>
                            <li>✓ 핵심 이슈 요약</li>
                            <li>✓ 키워드 중심 탐색</li>
                        </ul>
                    </div>

                    <div 
                        className="persona-card student"
                        onClick={() => handlePersonaSelect('student')}
                    >
                        <div className="card-icon">📚</div>
                        <h3>대학생/연구자</h3>
                        <p className="card-description">
                            레포트 자료, 다양한 관점 탐색
                        </p>
                        <ul className="card-features">
                            <li>✓ 관점별 자료 수집</li>
                            <li>✓ 프레임 비교 분석</li>
                            <li>✓ 레퍼런스 추출</li>
                        </ul>
                    </div>

                    <div 
                        className="persona-card educator"
                        onClick={() => handlePersonaSelect('educator')}
                    >
                        <div className="card-icon">👨‍🏫</div>
                        <h3>교육자</h3>
                        <p className="card-description">
                            편향 교육, 비판적 사고 훈련
                        </p>
                        <ul className="card-features">
                            <li>✓ 미디어 리터러시</li>
                            <li>✓ 교육 자료</li>
                            <li>✓ 기술 로직 설명</li>
                        </ul>
                    </div>

                    <div 
                        className="persona-card general"
                        onClick={() => handlePersonaSelect('general')}
                    >
                        <div className="card-icon">🔍</div>
                        <h3>일반 이용자</h3>
                        <p className="card-description">
                            균형잡힌 뉴스 소비
                        </p>
                        <ul className="card-features">
                            <li>✓ 다양한 관점 접근</li>
                            <li>✓ 편향 인식 개선</li>
                            <li>✓ 비판적 읽기</li>
                        </ul>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="skip-btn" onClick={handleSkip}>
                        건너뛰기
                    </button>
                    <p className="footer-note">
                        * 언제든지 모든 기능을 이용하실 수 있습니다
                    </p>
                </div>
            </div>
        </div>
    );
};

export default WelcomeModal;
