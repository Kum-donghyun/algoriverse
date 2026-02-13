import React, { useState, useEffect } from 'react';
import '../../styles/PersonaSelector.css';

const PersonaSelector = ({ onClose, onSelect }) => {
    const [selectedPersona, setSelectedPersona] = useState(null);

    useEffect(() => {
        const savedPersona = localStorage.getItem('selectedPersona');
        setSelectedPersona(savedPersona || 'general');
    }, []);

    const personas = [
        {
            id: 'professional',
            icon: '👔',
            name: '전문가',
            description: '심층 분석과 데이터 중심',
            features: ['고급 통계', '비교 분석', '데이터 내보내기']
        },
        {
            id: 'student',
            icon: '🎓',
            name: '학습자',
            description: '미디어 리터러시 학습',
            features: ['학습 진행도', '퀴즈', '성취도 배지']
        },
        {
            id: 'educator',
            icon: '👨‍🏫',
            name: '교육자',
            description: '교육 자료 제작 및 관리',
            features: ['수업 자료', '템플릿', '학생 관리']
        },
        {
            id: 'general',
            icon: '🔍',
            name: '일반 사용자',
            description: '균형잡힌 뉴스 소비',
            features: ['다양한 관점', '편향 인식', '비판적 읽기']
        }
    ];

    const handleSelect = (personaId) => {
        setSelectedPersona(personaId);
    };

    const handleConfirm = () => {
        localStorage.setItem('selectedPersona', selectedPersona);
        if (onSelect) {
            onSelect(selectedPersona);
        }
        if (onClose) {
            onClose();
        }
    };

    return (
        <div className="persona-selector-overlay">
            <div className="persona-selector-modal">
                <div className="modal-header">
                    <h2>👤 페르소나 선택</h2>
                    <p>사용 목적에 맞는 페르소나를 선택하세요</p>
                    {onClose && (
                        <button className="close-btn" onClick={onClose}>✕</button>
                    )}
                </div>

                <div className="persona-grid">
                    {personas.map(persona => (
                        <div
                            key={persona.id}
                            className={`persona-option ${selectedPersona === persona.id ? 'selected' : ''}`}
                            onClick={() => handleSelect(persona.id)}
                        >
                            <div className="persona-icon">{persona.icon}</div>
                            <h3>{persona.name}</h3>
                            <p className="persona-desc">{persona.description}</p>
                            <ul className="persona-features">
                                {persona.features.map((feature, idx) => (
                                    <li key={idx}>✓ {feature}</li>
                                ))}
                            </ul>
                            {selectedPersona === persona.id && (
                                <div className="selected-badge">선택됨</div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="modal-footer">
                    <button className="confirm-btn" onClick={handleConfirm}>
                        확인
                    </button>
                    <p className="footer-note">
                        * 언제든지 변경 가능합니다
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PersonaSelector;
