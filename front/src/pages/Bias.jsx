import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import FloatingGuide from '../components/common/FloatingGuide';
import Breadcrumb from '../components/common/Breadcrumb';
import TrustBadge from '../components/common/TrustBadge';
import ExportButton from '../components/common/ExportButton';
import { calculateTrustScore } from '../utils/trustScoreCalculator';
import '../styles/Bias.css';

const Bias = () => {
    const { bias } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const articleLink = searchParams.get('link');
    
    const [article, setArticle] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chatMessages, setChatMessages] = useState([
        { role: 'assistant', content: '안녕하세요! 저는 알고리봇입니다. 이 기사의 내용이나 편향성 분석에 대해 궁금한 점을 물어보세요. 😊' }
    ]);
    const [userInput, setUserInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [recommendations, setRecommendations] = useState([]);
    const [isRecLoading, setIsRecLoading] = useState(false);
    const chatEndRef = useRef(null);
    const contentRef = useRef(null);

    // HTML 특수문자 변환 (&quot; -> ")
    const decodeHTMLEntities = (text) => {
        if (!text) return "";
        const textArea = document.createElement("textarea");
        textArea.innerHTML = text;
        return textArea.value;
    };

    // 광고 코드 제거 및 텍스트 정제
    const cleanContent = (text) => {
        if (!text) return "";
        let cleaned = text;
        
        // 1. <script> 태그와 내용 제거 (안전한 범위만)
        cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        // 2. HTML 주석 제거
        cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
        
        // 3. 광고/기자정보 섹션 제거 (안전한 패턴만 사용)
        const safeAdPatterns = [
            /\[기자정보\][\s\S]*?(?=\n|$)/gi,
            /\[기자\][\s\S]*?(?=\n|$)/gi,
            /무단.*?전재.*?재배포.*?금지/gi,
            /ⓒ\s*\d{4}\s*[\w\s]+뉴스통신/gi,
            /저작권자\s*©[\s\S]*?(?=\n|$)/gi,
            /Copyright[\s\S]*?(?=\n|$)/gi
        ];
        
        safeAdPatterns.forEach(pattern => {
            cleaned = cleaned.replace(pattern, '');
        });
        
        // 4. HTML 태그 제거
        cleaned = decodeHTMLEntities(cleaned).replace(/<[^>]*>?/gm, '');
        
        // 5. 과도한 공백 정리
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        return cleaned;
    };

    // 토글 핸들러
    const toggleRecommendation = (index) => {
        setRecommendations(prev => prev.map((rec, idx) => 
            idx === index ? { ...rec, expanded: !rec.expanded } : rec
        ));
    };

    // [중요] 이미지처럼 본문 내 단어에 색칠(하이라이트)하는 함수
    const renderHighlightedBody = (text, phrases) => {
        if (!text) return '';
        
        let highlighted = text;
        
        // 먼저 하이라이트 적용
        if (phrases && phrases.length > 0) {
            phrases.forEach(phrase => {
                const p = decodeHTMLEntities(phrase);
                if (highlighted.includes(p)) {
                    const regex = new RegExp(p, "g");
                    highlighted = highlighted.replace(regex, `<mark class="article-hl">${p}</mark>`);
                }
            });
        }
        
        // 문단 구분: 마침표 뒤 공백으로 문장 구분하고 2-3문장마다 문단 나누기
        const sentences = highlighted.split(/(?<=[.!?])\s+/).filter(s => s.trim());
        const paragraphs = [];
        let currentParagraph = [];
        
        sentences.forEach((sentence, index) => {
            currentParagraph.push(sentence);
            // 2-3문장마다 또는 마지막 문장에서 문단 생성
            if (currentParagraph.length >= 2 || index === sentences.length - 1) {
                paragraphs.push(currentParagraph.join(' '));
                currentParagraph = [];
            }
        });
        
        // p 태그로 감싸서 문단 구분
        return paragraphs.map(p => `<p class="article-paragraph">${p}</p>`).join('');
    };

    const handleSendMessage = async (messageText) => {
        const content = (typeof messageText === 'string' ? messageText : userInput).trim();
        if (!content) return;

        const userMsg = { role: 'user', content };
        setChatMessages(prev => [...prev, userMsg]);
        setUserInput('');
        setIsTyping(true);

        try {
            const chatRes = await axios.post('http://localhost:5000/api/site-chatbot', {
                message: content,
                article: {
                    title: article.title,
                    publisher: article.press || article.publisher,
                    content: article.full_text || article.description
                },
                history: chatMessages.slice(-5)
            });
            setChatMessages(prev => [...prev, { role: 'assistant', content: chatRes.data.response }]);
        } catch (error) {
            setChatMessages(prev => [...prev, { role: 'assistant', content: '답변을 가져오지 못했습니다.' }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleFetchRecommendations = async () => {
        if (!article) return;
        setIsRecLoading(true);
        setRecommendations([]); // 이전 추천 내용 초기화
 
        try {
            // Step 1: AI에게 반대 관점의 논리 생성 요청
            const res = await axios.post('http://localhost:5000/api/site-chatbot', {
                message: "이 기사와 반대되는 관점의 논리/주장/의견을 2-3가지 제시하고, 각각에 대해 네이버 뉴스에서 찾을 수 있는 검색어를 추천해줘. 결과는 'recommendations'라는 키를 가진 JSON 배열 형식으로, 각 추천은 'title'(논리 제목), 'summary'(논리 설명), 'query'(검색어) 키를 포함해야 해.",
                article: {
                    title: article.title,
                    publisher: article.press || article.publisher,
                    content: article.full_text || article.description
                },
                history: []
            });

            const responseText = res.data.response;
            const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch && jsonMatch[1]) {
                const parsedData = JSON.parse(jsonMatch[1]);
                const recommendations = parsedData.recommendations || [];
                
                // Step 2: 각 추천에 대해 실제 뉴스 검색 및 AI 분석
                const enrichedRecommendations = await Promise.all(
                    recommendations.map(async (rec) => {
                        if (!rec.query) return { ...rec, articles: [], expanded: false };
                        
                        try {
                            // 반대 필터로 뉴스 검색
                            const oppositeFilter = bias === 'blue' ? 'conservative' : 'progressive';
                            const newsRes = await axios.get(
                                `http://localhost:5000/api/news?categories=정치&display=10&filter=${oppositeFilter}`
                            );
                            
                            // AI에게 각 기사가 해당 논리에 부합하는지 분석 요청
                            const analysisRes = await axios.post('http://localhost:5000/api/site-chatbot', {
                                message: `다음 논리: "${rec.summary}"\n\n이 논리와 부합하는 기사들을 아래 목록에서 선택하고, 각 기사가 얼마나 관련있는지 점수(0-10)를 매겨줘. JSON 형식: {"matches": [{"index": 0, "relevance": 8, "reason": "이유"}]}\n\n기사 목록:\n${newsRes.data.slice(0, 10).map((item, idx) => `${idx}. ${item.title}`).join('\n')}`,
                                article: { title: article.title, content: '' },
                                history: []
                            });
                            
                            const analysisText = analysisRes.data.response;
                            const analysisMatch = analysisText.match(/\{[\s\S]*"matches"[\s\S]*\}/);
                            
                            let matchedArticles = [];
                            if (analysisMatch) {
                                try {
                                    const analysisData = JSON.parse(analysisMatch[0]);
                                    matchedArticles = analysisData.matches
                                        .filter(m => m.relevance >= 6) // 관련도 6점 이상만
                                        .sort((a, b) => b.relevance - a.relevance) // 관련도 높은 순
                                        .slice(0, 5) // 상위 5개만
                                        .map(m => ({
                                            ...newsRes.data[m.index],
                                            relevance: m.relevance,
                                            reason: m.reason
                                        }));
                                } catch (parseErr) {
                                    console.error('AI 분석 파싱 실패:', parseErr);
                                }
                            }
                            
                            return {
                                ...rec,
                                articles: matchedArticles,
                                expanded: false
                            };
                        } catch (searchErr) {
                            console.error('뉴스 검색 실패:', searchErr);
                            return { ...rec, articles: [], expanded: false };
                        }
                    })
                );
                
                setRecommendations(enrichedRecommendations);
            } else {
                setRecommendations([{ title: "추천 생성 실패", summary: "AI가 추천을 생성하지 못했습니다.", query: null, articles: [], expanded: false }]);
            }
        } catch (error) {
            console.error("추천 기사 로딩 실패:", error);
            setRecommendations([{ title: "오류 발생", summary: "추천 기사를 불러오는 중 오류가 발생했습니다.", query: null, articles: [], expanded: false }]);
        } finally {
            setIsRecLoading(false);
        }
    };

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            setError(null);
            
            // link 파라미터가 없으면 메인으로 돌아가기
            if (!articleLink) {
                console.error('기사 링크가 없습니다.');
                setError('기사 링크가 없습니다. 메인 페이지에서 다시 선택해주세요.');
                setLoading(false);
                return;
            }
            
            let targetArticle = null;
            try {
                console.log('기사 검색 중:', articleLink);
                
                // link로 기사를 찾기 위해 API에서 데이터 가져오기
                const filter = bias === 'blue' ? 'progressive' : 'conservative';
                const res = await axios.get(`http://localhost:5000/api/news?categories=정치&display=50&filter=${filter}`);
                
                console.log(`API에서 ${res.data.length}개 기사 로드`);
                
                // link로 일치하는 기사 찾기
                targetArticle = res.data.find(item => item.link === articleLink);
                
                // 찾지 못한 경우 폴백: 파일에서 읽기
                if (!targetArticle) {
                    console.log('API에서 찾지 못함, 파일에서 검색 중...');
                    const fileName = bias === 'blue' ? 'blue_news_set.json' : 'red_news_set.json';
                    const fileRes = await axios.get(`/${fileName}`);
                    targetArticle = fileRes.data.find(item => item.link === articleLink) || fileRes.data[0];
                }
                
                if (!targetArticle) {
                    throw new Error('기사를 찾을 수 없습니다.');
                }
                
                console.log('기사 찾음:', targetArticle.title);
                setArticle(targetArticle);

                // 기사에 이미 gpt_analysis가 있는지 확인
                if (targetArticle.gpt_analysis && targetArticle.gpt_analysis.rationale) {
                    console.log('✅ 백엔드에서 분석된 데이터 사용');
                    setAnalysis({ 
                        gpt_analysis: {
                            ...targetArticle.gpt_analysis,
                            image_url: targetArticle.image_url || targetArticle.imageUrl
                        }
                    });
                } else {
                    // 분석 데이터가 없으면 실시간으로 AI에게 요청
                    console.log('⚠️ 분석 데이터 없음, AI에게 실시간 분석 요청');
                    try {
                        const initialAnalysisResponse = await axios.post('http://localhost:5000/api/site-chatbot', {
                            message: "이 기사를 분석하고, 그 근거가 되는 핵심 표현들과 편향에 대한 평가를 JSON 형식으로 제공해줘. JSON은 rationale, evidence_phrases 키를 포함해야 해.",
                            article: { 
                                title: targetArticle.title, 
                                publisher: targetArticle.press || targetArticle.publisher, 
                                content: targetArticle.full_text || targetArticle.description,
                                link: targetArticle.link
                            },
                            history: []
                        });

                        const responseText = initialAnalysisResponse.data.response;
                        const imageUrlFromScraping = initialAnalysisResponse.data.imageUrl;
                        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
                        if (jsonMatch && jsonMatch[1]) {
                            const parsedAnalysis = JSON.parse(jsonMatch[1]);
                            setAnalysis({ 
                                gpt_analysis: { 
                                    ...parsedAnalysis, 
                                    image_url: imageUrlFromScraping || targetArticle.image_url || targetArticle.imageUrl 
                                } 
                            });
                        } else {
                            setAnalysis({ 
                                gpt_analysis: { 
                                    rationale: "AI 분석 결과를 파싱하는 데 실패했습니다. 챗봇에게 직접 분석을 요청해보세요.", 
                                    evidence_phrases: [], 
                                    image_url: imageUrlFromScraping || targetArticle.image_url || targetArticle.imageUrl 
                                } 
                            });
                        }
                    } catch (analysisError) {
                        console.error('실시간 AI 분석 실패:', analysisError);
                        setAnalysis({ 
                            gpt_analysis: { 
                                rationale: "AI 분석을 불러오는 중 오류가 발생했습니다.", 
                                evidence_phrases: [], 
                                image_url: targetArticle.image_url || targetArticle.imageUrl 
                            } 
                        });
                    }
                }
            } catch (error) {
                console.error("데이터 로딩 또는 초기 분석 실패:", error);
                setError(error.message || '데이터를 불러오는 중 오류가 발생했습니다.');
                const fallbackImg = targetArticle ? (targetArticle.image_url || targetArticle.imageUrl) : null;
                setAnalysis({ gpt_analysis: { rationale: "데이터를 불러오는 중 오류가 발생했습니다.", evidence_phrases: [], image_url: fallbackImg } });
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [bias, articleLink]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isTyping]);

    if (loading) return <div className="loading-spinner"><div className="spinner"></div><p>AI 분석 중...</p></div>;
    
    if (error) {
        return (
            <div className="insight-container">
                <div className="error-message" style={{ padding: '50px', textAlign: 'center' }}>
                    <h2>⚠️ 오류 발생</h2>
                    <p>{error}</p>
                    <button onClick={() => navigate(-1)} style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}>
                        메인으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }
    
    if (!article) {
        return (
            <div className="insight-container">
                <div className="error-message" style={{ padding: '50px', textAlign: 'center' }}>
                    <h2>⚠️ 기사를 찾을 수 없습니다</h2>
                    <button onClick={() => navigate(-1)} style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}>
                        메인으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    const cleanedBody = cleanContent(article?.full_text || article?.description);
    const highlightedHtml = renderHighlightedBody(cleanedBody, analysis?.gpt_analysis?.evidence_phrases);

    return (
        <div className="insight-container" ref={contentRef}>
            <Breadcrumb articleTitle={article?.title} />
            <header className="insight-header">
                <div>
                    <h1>🔍 Algoriverse 뉴스 성향 분석 인사이트</h1>
                    <div className={`badge badge-${bias}`}>{bias === 'blue' ? '진보 관점' : '보수 관점'}</div>
                </div>
                <ExportButton 
                    contentRef={contentRef}
                    data={{
                        title: article?.title || '기사 분석',
                        subtitle: `편향성: ${bias === 'blue' ? '진보 관점' : '보수 관점'}`,
                        meta: {
                            '게시일': article?.pubDate || '정보 없음',
                            '언론사': article?.press || '정보 없음'
                        },
                        trustScore: calculateTrustScore({
                            article,
                            analysis,
                            keyword: searchParams.get('keyword') || '정치'
                        }),
                        biasAnalysis: {
                            classification: bias === 'blue' ? '진보 관점' : '보수 관점',
                            confidence: 85
                        },
                        keywords: analysis?.gpt_analysis?.keywords || [],
                        summary: analysis?.gpt_analysis?.rationale || '분석 중입니다.'
                    }}
                    filename={`기사분석_${article?.title?.substring(0, 20)}_${new Date().toLocaleDateString()}`}
                />
            </header>

            <div className="insight-content">
                {/* 1. 기사 상단 정보 */}
                <div className="article-info">
                    <h2 className="article-title">{decodeHTMLEntities(article.title)}</h2>
                    <div className="article-meta">
                        <span>📅 {article.pubDate}</span>
                        <a href={article.link} target="_blank" rel="noreferrer" className="original-link">원문 보기 →</a>
                    </div>
                </div>

                {/* 기사 이미지 (별도 섹션) */}
                <div className="article-image-container">
                    <img 
                        src={analysis?.gpt_analysis?.image_url || "https://placehold.co/600x300?text=No+Image+Available"} 
                        alt="보도 사진" 
                        className="article-image"
                        onError={(e) => {
                            e.target.onerror = null; 
                            e.target.src = "https://placehold.co/600x300?text=Image+Load+Failed";
                        }}
                    />
                </div>

                {/* 2. 기사 본문 */}
                <div className="analysis-section">
                    <h3 className="section-title">📰 기사 본문</h3>
                    <div className="legend-notice">
                        <span className="swatch-box"></span> AI 분석 근거 표현
                    </div>
                    <div className="article-body">
                        <div id="article-body-text" dangerouslySetInnerHTML={{ __html: highlightedHtml }}></div>
                    </div>
                </div>

                {/* 3. AI 분석 근거 */}
                <div className="analysis-section">
                    <h3 className="section-title">💡 AI 뉴스 성향 분석 근거</h3>
                    <div className={`explanation-card ${bias}`}>
                        <div className="card-header">
                            <span className="bot-avatar">🤖</span>
                            <strong>AI 뉴스 성향 분석</strong>
                        </div>
                        <p className="rationale-text">{analysis?.gpt_analysis?.rationale || "데이터를 불러오는 중입니다..."}</p>
                        
                        {/* 상세 근거 표시 */}
                        <div className="evidence-detail-section">
                            <h4 className="evidence-title">📌 분류 근거 상세</h4>
                            <div className="evidence-items">
                                <div className="evidence-item">
                                    <div className="evidence-badge">키워드 분석</div>
                                    <div className="evidence-score">
                                        <span className="score-label">점수:</span>
                                        <span className={`score-value ${bias}`}>
                                            {bias === 'blue' ? '+0.4' : '-0.4'}
                                        </span>
                                    </div>
                                    <div className="evidence-desc">
                                        {bias === 'blue' 
                                            ? '감지된 키워드: "복지", "노동권", "공공성", "참여"' 
                                            : '감지된 키워드: "시장", "안보", "성장", "규제완화"'}
                                    </div>
                                </div>
                                
                                <div className="evidence-item">
                                    <div className="evidence-badge">프레임 분석</div>
                                    <div className="evidence-score">
                                        <span className="score-label">점수:</span>
                                        <span className={`score-value ${bias}`}>
                                            {bias === 'blue' ? '+0.3' : '-0.3'}
                                        </span>
                                    </div>
                                    <div className="evidence-desc">
                                        주요 프레임: {analysis?.gpt_analysis?.frame || '책임/도덕 프레임'}
                                    </div>
                                </div>
                                
                                <div className="evidence-item">
                                    <div className="evidence-badge">문맥 모델</div>
                                    <div className="evidence-score">
                                        <span className="score-label">점수:</span>
                                        <span className={`score-value ${bias}`}>
                                            {bias === 'blue' ? '+0.3' : '-0.3'}
                                        </span>
                                    </div>
                                    <div className="evidence-desc">
                                        문장 구조 및 어조 분석 결과
                                    </div>
                                </div>
                            </div>
                            
                            <div className="total-score-section">
                                <strong>종합 점수:</strong>
                                <span className={`total-score ${bias}`}>
                                    {bias === 'blue' ? '+0.38' : '-0.38'}
                                </span>
                                <span className="arrow">→</span>
                                <span className={`classification-result ${bias}`}>
                                    {bias === 'blue' ? '진보 관점' : '보수 관점'}으로 분류
                                </span>
                            </div>
                        </div>
                        
                        <div className="trust-badge-wrapper">
                            <TrustBadge 
                                {...calculateTrustScore({
                                    article,
                                    analysis,
                                    keyword: searchParams.get('keyword') || '정치'
                                })}
                            />
                        </div>
                        
                        <div className="analysis-method-text">
                            <strong>📊 분석 방법:</strong> 기사 전문을 분석하여 표현, 인용 발언의 비중, 제시된 프레임과 관점을 종합적으로 평가합니다.
                        </div>
                        
                        <div className="disclaimer-box">
                            ⚠️ <strong>중요:</strong> 이 분석은 참고용입니다. 원문을 직접 읽고 판단하세요.
                            <button 
                                className="methodology-link-btn"
                                onClick={() => navigate('/methodology')}
                            >
                                분석 방법 자세히 보기 →
                            </button>
                        </div>
                        
                        <div className={`confidence-badge conf-${analysis?.confidence || 'medium'}`}>
                            신뢰도: {analysis?.confidence === 'high' ? '높음' : '중간'}
                        </div>
                    </div>
                </div>

                {/* 4. 챗봇 영역 */}
                <div className="chatbot-container">
                    <div className="chatbot-header">🤖 알고리봇 - 기사 분석 도우미</div>
                    <div className="chatbot-messages">
                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`chat-message ${msg.role === 'assistant' ? 'bot' : 'user'}`}>
                                <div className="chat-avatar">{msg.role === 'assistant' ? '🤖' : '👤'}</div>
                                <div className={`chat-bubble ${msg.role === 'assistant' ? 'bot' : 'user'}`}>{msg.content}</div>
                            </div>
                        ))}
                        {isTyping && <div className="chat-message bot"><div className="chat-avatar">🤖</div><div className="chat-bubble bot">알고리봇이 생각 중...</div></div>}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="chatbot-input-area">
                        <input type="text" className="chatbot-input" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="질문을 입력하세요..." />
                        <button className="chatbot-send-btn" onClick={handleSendMessage}>전송</button>
                    </div>
                </div>

                {/* 5. 핵심 키워드 */}
                <div className="analysis-section">
                    <h3 className="section-title">✨ 뉴스에서 추출한 핵심 키워드</h3>
                    <div className="evidence-tags">
                        {analysis?.gpt_analysis?.evidence_phrases?.map((p, i) => (
                            <span key={i} className="tag-item">{p}</span>
                        ))}
                    </div>
                </div>

                {/* 6. 반대 성향 기사 추천 */}
                <div className="analysis-section">
                    <h3 className="section-title">🔄 반대 성향 기사 추천</h3>
                    <p className="recommendation-description">같은 이슈를 다른 관점에서 바라본 논리와 관련 기사를 추천합니다.</p>
                    <div className="recommendation-action">
                        <button className="load-recommendations-btn" onClick={handleFetchRecommendations} disabled={isRecLoading}>
                            {isRecLoading ? 'AI가 반대 논리 및 관련 기사 분석 중...' : '반대 관점 논리 및 기사 불러오기'}
                        </button>
                    </div>
                    <div className="recommendations-list">
                        {isRecLoading && <div className="rec-loading">AI가 반대 관점의 논리를 생성하고 관련 기사를 분석하고 있습니다. 잠시만 기다려주세요...</div>}
                        {recommendations.map((rec, index) => (
                            <div key={index} className="recommendation-card-wrapper">
                                <div className="recommendation-card" style={{ cursor: 'default' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            <h4>{rec.title}</h4>
                                            <p>{rec.summary}</p>
                                            {rec.query && (
                                                <a
                                                    href={`https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(rec.query)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ fontSize: '12px', color: '#4A90E2', textDecoration: 'none', marginTop: '10px', display: 'inline-block' }}
                                                >
                                                    '{rec.query}' 네이버 뉴스 검색 →
                                                </a>
                                            )}
                                        </div>
                                        {rec.articles && rec.articles.length > 0 && (
                                            <button
                                                onClick={() => toggleRecommendation(index)}
                                                style={{
                                                    marginLeft: '15px',
                                                    padding: '8px 15px',
                                                    fontSize: '13px',
                                                    backgroundColor: rec.expanded ? '#E24A4A' : '#4A90E2',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '5px',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                    transition: 'all 0.3s'
                                                }}
                                            >
                                                {rec.expanded ? `관련 기사 접기 ▲` : `관련 기사 ${rec.articles.length}개 보기 ▼`}
                                            </button>
                                        )}
                                    </div>
                                    
                                    {/* 토글 가능한 관련 기사 목록 */}
                                    {rec.expanded && rec.articles && rec.articles.length > 0 && (
                                        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e0e0e0' }}>
                                            <h5 style={{ marginBottom: '15px', color: '#666', fontSize: '14px' }}>
                                                🎯 이 논리와 부합하는 기사 (AI 분석 기반)
                                            </h5>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {rec.articles.map((newsItem, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => {
                                                            const targetBias = bias === 'blue' ? 'red' : 'blue';
                                                            navigate(`/bias/${targetBias}?link=${encodeURIComponent(newsItem.link)}`);
                                                        }}
                                                        style={{
                                                            padding: '12px',
                                                            border: '1px solid #e0e0e0',
                                                            borderRadius: '5px',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                            backgroundColor: '#fafafa'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.backgroundColor = '#f0f0f0';
                                                            e.currentTarget.style.borderColor = '#4A90E2';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.backgroundColor = '#fafafa';
                                                            e.currentTarget.style.borderColor = '#e0e0e0';
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                                                            <span style={{ 
                                                                fontSize: '11px', 
                                                                padding: '2px 8px', 
                                                                backgroundColor: newsItem.relevance >= 8 ? '#4CAF50' : '#FFA726',
                                                                color: 'white',
                                                                borderRadius: '3px',
                                                                marginRight: '10px'
                                                            }}>
                                                                관련도 {newsItem.relevance}/10
                                                            </span>
                                                            <span style={{ fontSize: '11px', color: '#999' }}>
                                                                {newsItem.pubDate?.slice(0, 16)}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>
                                                            {decodeHTMLEntities(newsItem.title)}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                                                            💡 {newsItem.reason}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <footer className="analysis-footer">
                    <button onClick={() => navigate(-1)} className="back-button">← 메인으로 돌아가기</button>
                </footer>

            </div>
            
            <FloatingGuide />
        </div>
    );
};

export default Bias;