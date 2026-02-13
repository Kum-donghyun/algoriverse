import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/TrustBadge.css';

const TrustBadge = ({ 
    trustScore = 75, 
    keywordMatch = 80, 
    frameConsistency = 75, 
    contextScore = 70 
}) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const navigate = useNavigate();
    
    const getScoreColor = (score) => {
        if (score >= 80) return '#4CAF50'; // 높음 - 초록
        if (score >= 60) return '#FFA726'; // 중간 - 주황
        return '#F44336'; // 낮음 - 빨강
    };
    
    const getScoreLabel = (score) => {
        if (score >= 80) return '높음';
        if (score >= 60) return '중간';
        return '낮음';
    };
    
    return (
        <div 
            className="trust-badge-container"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <div className="trust-badge">
                <span className="trust-icon">🔒</span>
                <span className="trust-label">신뢰도</span>
                <span 
                    className="trust-score"
                    style={{ color: getScoreColor(trustScore) }}
                >
                    {trustScore}%
                </span>
            </div>
            
            {showTooltip && (
                <div className="trust-tooltip">
                    <div className="tooltip-header">
                        <h4>신뢰도 산출 근거</h4>
                    </div>
                    
                    <div className="tooltip-content">
                        <div className="metric-item">
                            <div className="metric-label">키워드 일치도</div>
                            <div className="metric-bar-container">
                                <div 
                                    className="metric-bar"
                                    style={{ 
                                        width: `${keywordMatch}%`,
                                        backgroundColor: getScoreColor(keywordMatch)
                                    }}
                                />
                            </div>
                            <div className="metric-value">{keywordMatch}%</div>
                        </div>
                        
                        <div className="metric-item">
                            <div className="metric-label">프레임 일관성</div>
                            <div className="metric-bar-container">
                                <div 
                                    className="metric-bar"
                                    style={{ 
                                        width: `${frameConsistency}%`,
                                        backgroundColor: getScoreColor(frameConsistency)
                                    }}
                                />
                            </div>
                            <div className="metric-value">{frameConsistency}%</div>
                        </div>
                        
                        <div className="metric-item">
                            <div className="metric-label">문맥 신뢰도</div>
                            <div className="metric-bar-container">
                                <div 
                                    className="metric-bar"
                                    style={{ 
                                        width: `${contextScore}%`,
                                        backgroundColor: getScoreColor(contextScore)
                                    }}
                                />
                            </div>
                            <div className="metric-value">{contextScore}%</div>
                        </div>
                        
                        <div className="total-score-row">
                            <strong>종합 신뢰도:</strong>
                            <span 
                                className="total-score"
                                style={{ color: getScoreColor(trustScore) }}
                            >
                                {trustScore}% ({getScoreLabel(trustScore)})
                            </span>
                        </div>
                    </div>
                    
                    <div className="tooltip-footer">
                        <button 
                            className="methodology-link"
                            onClick={() => navigate('/methodology#confidence')}
                        >
                            자세히 알아보기 →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrustBadge;
