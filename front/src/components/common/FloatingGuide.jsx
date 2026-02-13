import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../../styles/FloatingGuide.css';

const FloatingGuide = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    const getCurrentStep = () => {
        const path = location.pathname;
        if (path === '/' || path === '/wordcloud') return 1;
        if (path === '/visualization') return 2;
        if (path.startsWith('/bias')) return 3;
        return 0;
    };
    
    const currentStep = getCurrentStep();
    
    return (
        <div className="floating-guide">
            <div className="progress-indicator">
                <div className={`progress-step ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}>
                    <div className="step-number">1</div>
                    <div className="step-label">이슈 파악</div>
                </div>
                <div className="progress-connector"></div>
                <div className={`progress-step ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}>
                    <div className="step-number">2</div>
                    <div className="step-label">관점 분석</div>
                </div>
                <div className="progress-connector"></div>
                <div className={`progress-step ${currentStep === 3 ? 'active' : ''}`}>
                    <div className="step-number">3</div>
                    <div className="step-label">심층 탐구</div>
                </div>
            </div>
            
            <div className="quick-nav">
                <button 
                    className={`nav-button ${currentStep === 1 ? 'active' : ''}`}
                    onClick={() => navigate('/')}
                    title="이슈 현황"
                >
                    🏠 이슈 현황
                </button>
                <button 
                    className={`nav-button ${currentStep === 2 ? 'active' : ''}`}
                    onClick={() => navigate('/visualization')}
                    title="프레임 분석"
                >
                    📊 프레임 분석
                </button>
                <button 
                    className="nav-button help-button"
                    onClick={() => navigate('/methodology')}
                    title="기술 설명"
                >
                    💡 기술 설명
                </button>
            </div>
        </div>
    );
};

export default FloatingGuide;
