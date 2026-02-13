import React from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '../components/common/Breadcrumb';
import FloatingGuide from '../components/common/FloatingGuide';
import '../styles/Methodology.css';

const Methodology = () => {
    const navigate = useNavigate();
    
    return (
        <div className="methodology-container">
            <Breadcrumb />
            
            <div className="methodology-hero">
                <h1>🔬 알고리버스 기술 투명성 보고서</h1>
                <p className="hero-subtitle">우리는 어떻게 뉴스를 분석할까요?</p>
                <p className="update-date">마지막 업데이트: 2025년 12월</p>
            </div>

            <div className="methodology-content">
                {/* 1. 진보/보수 분류 로직 */}
                <section className="method-section">
                    <h2 className="section-title">📌 1. 진보/보수 분류 로직</h2>
                    
                    <div className="logic-flow">
                        <div className="flow-step">
                            <div className="step-number">①</div>
                            <div className="step-content">
                                <h3>데이터 수집</h3>
                                <ul>
                                    <li><strong>출처:</strong> 네이버 뉴스 API (정치 카테고리)</li>
                                    <li><strong>범위:</strong> 제목 + 본문 전문 (스크래핑)</li>
                                    <li><strong>갱신:</strong> 실시간 (API 호출 시마다)</li>
                                </ul>
                            </div>
                        </div>

                        <div className="flow-step">
                            <div className="step-number">②</div>
                            <div className="step-content">
                                <h3>텍스트 전처리</h3>
                                <ul>
                                    <li>HTML 태그 제거</li>
                                    <li>광고/저작권 문구 정제</li>
                                    <li>문장 단위 분할</li>
                                </ul>
                                <div className="code-preview">
                                    <code>function cleanContent(text) &#123;<br/>
                                    &nbsp;&nbsp;text = removeAdsAndNoise(text);<br/>
                                    &nbsp;&nbsp;return decodeHTMLEntities(text);<br/>
                                    &#125;</code>
                                </div>
                            </div>
                        </div>

                        <div className="flow-step">
                            <div className="step-number">③</div>
                            <div className="step-content">
                                <h3>다차원 점수 산출</h3>
                                <div className="sub-step">
                                    <strong>🔍 키워드 분석</strong>
                                    <ul>
                                        <li>진보 키워드: 복지, 노동권, 공공성, 규제 강화, 참여...</li>
                                        <li>보수 키워드: 시장, 안보, 감세, 규제완화, 성장...</li>
                                        <li>가중치: 단순 빈도가 아닌 문맥 내 중요도 반영</li>
                                    </ul>
                                </div>
                                <div className="sub-step">
                                    <strong>📊 프레임 분석</strong>
                                    <ul>
                                        <li>Semetko & Valkenburg 5대 프레임</li>
                                        <li>갈등/책임/경제/도덕/인간흥미</li>
                                        <li>각 프레임별 정치 성향 상관관계 적용</li>
                                    </ul>
                                </div>
                                <div className="sub-step">
                                    <strong>🤖 문맥 모델 (선택적 사용)</strong>
                                    <ul>
                                        <li>Transformer 기반 문맥 분류</li>
                                        <li>사전 학습된 정치 성향 데이터셋 미세조정</li>
                                        <li>규칙 기반과 앙상블</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="flow-step">
                            <div className="step-number">④</div>
                            <div className="step-content">
                                <h3>최종 분류</h3>
                                <div className="formula-box">
                                    <strong>종합점수 = </strong>키워드점수(40%) + 프레임점수(30%) + 모델점수(30%)
                                </div>
                                <div className="threshold-box">
                                    <p><strong>분류 임계값:</strong></p>
                                    <ul>
                                        <li>진보: 종합점수 &gt; +0.3</li>
                                        <li>보수: 종합점수 &lt; -0.3</li>
                                        <li>중립: -0.3 ≤ 점수 ≤ +0.3</li>
                                    </ul>
                                </div>
                                <div className="note-box">
                                    ⚠️ 임계값은 주기적으로 재평가됩니다.<br/>
                                    선거 기간 등 민감 시기에는 보수적 판단 적용.
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. 한계와 윤리적 고려 */}
                <section className="method-section">
                    <h2 className="section-title">📌 2. 한계와 윤리적 고려</h2>
                    
                    <div className="limitations-list">
                        <div className="limitation-item">
                            <div className="limit-icon">⚠️</div>
                            <div className="limit-content">
                                <h4>풍자·반어 인식 한계</h4>
                                <p>아이러니나 풍자적 표현은 오분류 가능성이 높습니다. 현재 문맥 모델로 일부 보완 중이나 완벽하지 않습니다.</p>
                            </div>
                        </div>
                        
                        <div className="limitation-item">
                            <div className="limit-icon">⚠️</div>
                            <div className="limit-content">
                                <h4>시간적 변화 반영 지연</h4>
                                <p>정치 지형 변화(예: 정당 재편)에 따른 키워드 재조정은 주기적 수동 업데이트가 필요합니다.</p>
                            </div>
                        </div>
                        
                        <div className="limitation-item">
                            <div className="limit-icon">⚠️</div>
                            <div className="limit-content">
                                <h4>개별 매체 편향 미반영</h4>
                                <p>"조선일보는 보수" 같은 매체 레이블을 사용하지 않고 기사 내용만으로 판단하므로, 동일 매체라도 기사별로 다른 분류가 가능합니다.</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="ethics-statement">
                        <h3>🤝 윤리적 원칙</h3>
                        <div className="principle-box">
                            <p>1. 특정 정당·인물을 일괄적으로 긍정/부정하지 않습니다.</p>
                            <p>2. 분류 결과는 "참고 자료"이며 절대적 판단이 아닙니다.</p>
                            <p>3. 사용자는 항상 원문을 직접 읽고 판단해야 합니다.</p>
                            <p>4. 피드백을 통해 지속적으로 개선합니다.</p>
                        </div>
                    </div>
                </section>

                {/* 3. 문제 제보 및 피드백 */}
                <section className="method-section feedback-section">
                    <h2 className="section-title">📌 3. 문제 제보 및 피드백</h2>
                    <p className="feedback-desc">
                        알고리버스의 분류가 잘못되었다고 생각하시나요?<br/>
                        구체적인 사례를 제보해주시면 개선에 반영하겠습니다.
                    </p>
                    <button 
                        className="feedback-btn"
                        onClick={() => alert('피드백 기능은 곧 추가됩니다!')}
                    >
                        📝 피드백 제출하기
                    </button>
                </section>
            </div>

            <div className="back-footer">
                <button onClick={() => navigate(-1)} className="back-button">
                    ← 돌아가기
                </button>
            </div>
            
            <FloatingGuide />
        </div>
    );
};

export default Methodology;
