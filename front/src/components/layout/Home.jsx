import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar'; 
import WordCloud from '../../pages/WordCloud';
import FloatingGuide from '../common/FloatingGuide';
import Breadcrumb from '../common/Breadcrumb';
import WelcomeModal from '../common/WelcomeModal';
import '../../styles/Home.css'; 

const Home = ({ onWordSelected }) => {
    const [isSidebarActive, setIsSidebarActive] = useState(false);
    const [loading, setLoading] = useState(true); 
    const [blueNews, setBlueNews] = useState([]);
    const [redNews, setRedNews] = useState([]);
    const [showAllBlue, setShowAllBlue] = useState(false);
    const [showAllRed, setShowAllRed] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchNews = async () => {
            // 세션 스토리지에서 캐시된 데이터 확인
            const cachedBlue = sessionStorage.getItem('cachedBlueNews');
            const cachedRed = sessionStorage.getItem('cachedRedNews');
            const cacheTime = sessionStorage.getItem('newsCacheTime');
            const now = Date.now();
            const CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시

            // 캐시가 유효하면 사용
            if (cachedBlue && cachedRed && cacheTime && (now - parseInt(cacheTime) < CACHE_DURATION)) {
                console.log('📦 캐시된 뉴스 데이터 사용');
                setBlueNews(JSON.parse(cachedBlue));
                setRedNews(JSON.parse(cachedRed));
                setLoading(false);
                return;
            }

            // 캐시가 없거나 만료되면 새로 가져오기
            console.log('🔄 새 뉴스 데이터 요청');
            setLoading(true);
            try {
                // Fetch progressive news (정치 카테고리, 최신순 30개)
                const blueRes = await fetch('http://localhost:5000/api/news?categories=정치&display=30&filter=progressive');
                const progressiveNews = await blueRes.json();
                setBlueNews(progressiveNews);

                // Create a set of links from the progressive news for efficient lookup
                const progressiveLinks = new Set(progressiveNews.map(news => news.link));

                // Fetch conservative news (정치 카테고리, 최신순 30개, 중복 제거)
                const redRes = await fetch('http://localhost:5000/api/news?categories=정치&display=30&filter=conservative');
                let conservativeNews = await redRes.json();

                // Filter out news that already exist in the progressive list
                conservativeNews = conservativeNews.filter(news => !progressiveLinks.has(news.link));
                setRedNews(conservativeNews);

                // 세션 스토리지에 캐시 저장
                sessionStorage.setItem('cachedBlueNews', JSON.stringify(progressiveNews));
                sessionStorage.setItem('cachedRedNews', JSON.stringify(conservativeNews));
                sessionStorage.setItem('newsCacheTime', now.toString());
                console.log('💾 뉴스 데이터 캐시 저장 완료');

            } catch (error) {
                console.error("API로부터 뉴스 데이터 로드 실패:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchNews();
    }, []);

    // handleWordClick: 워드 클라우드 클릭 시 자동으로 Visualization으로 이동
    const handleWordClick = (word) => {
        const cleanWord = typeof word === 'object' ? (word.text || word.word) : word;
        const keyword = cleanWord?.trim();
        
        if (!keyword) return;
        
        // 키워드를 세션에 저장
        sessionStorage.setItem('keyword', keyword);
        
        // 로딩 안내 표시
        console.log(`"${keyword}" 키워드로 프레임 분석 페이지로 이동합니다...`);
        
        // Visualization 페이지로 자동 이동 (이슈 탭 활성화)
        navigate(`/visualization?keyword=${encodeURIComponent(keyword)}&autoOpen=issue`);
        
        // 부모 컴포넌트에도 알림 (기존 동작 유지)
        if (onWordSelected) {
            onWordSelected(keyword);
        }
    };

    const cleanTitle = (title) => {
        if (!title) return '제목 없음';
        return title.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    };

    const renderNewsList = (list, title, isProgressive) => {
        const listColorClass = isProgressive ? 'blue-list' : 'red-list';
        const showAll = isProgressive ? showAllBlue : showAllRed;
        const setShowAll = isProgressive ? setShowAllBlue : setShowAllRed;
        
        if (loading) return <div className="loading-list">로딩 중...</div>;
        
        const displayCount = showAll ? list.length : 6;
        const displayList = (list || []).slice(0, displayCount);
        
        return (
            <div className={`news-list-container ${isProgressive ? 'progressive-list' : 'conservative-list'}`}>
                <h3 className={`list-title ${listColorClass}`}>
                    {title} 
                    <span style={{ fontSize: '14px', fontWeight: 'normal', marginLeft: '10px', color: '#666' }}>
                        (총 {list?.length || 0}개)
                    </span>
                </h3>
                <div className="list-content">
                    {displayList.map((item, index) => (
                        <div key={index} 
                            className="news-item" 
                            style={{ 
                                border: '1px solid #e0e0e0', 
                                padding: '15px', 
                                marginBottom: '15px', 
                                position: 'relative' 
                            }}
                        >
                            <div className="item-title" style={{ marginBottom: '10px' }}>
                                <a href={item.link || '#'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                                    {cleanTitle(item.title)}
                                </a>
                            </div>
                            <div className="item-date" style={{ fontFamily: 'Gungsuh, serif', fontWeight: 'bold' }}>{item.pubDate?.slice(0, 16)}</div>
                            <Link 
                                to={`/bias/${isProgressive ? 'blue' : 'red'}?link=${encodeURIComponent(item.link)}`}
                                style={{
                                    position: 'absolute',
                                    right: '15px',
                                    bottom: '15px',
                                    fontSize: '12px',
                                    color: 'blue',
                                    textDecoration: 'none',
                                    padding: '5px 10px',
                                    border: '1px solid blue',
                                    borderRadius: '5px'
                                }}
                            >
                                자세히 보기
                            </Link>
                        </div>
                    ))}
                </div>
                {list && list.length > 6 && (
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <button 
                            onClick={() => setShowAll(!showAll)}
                            style={{
                                padding: '10px 30px',
                                fontSize: '14px',
                                backgroundColor: isProgressive ? '#4A90E2' : '#E24A4A',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                transition: 'all 0.3s'
                            }}
                            onMouseOver={(e) => e.target.style.opacity = '0.8'}
                            onMouseOut={(e) => e.target.style.opacity = '1'}
                        >
                            {showAll ? '접기 ▲' : `더 보기 (${list.length - 6}개 더) ▼`}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="home-layout">
            <WelcomeModal />
            <Breadcrumb />
            <Sidebar isActive={isSidebarActive} />
            <div className={`main-content ${isSidebarActive ? 'sidebar-active' : ''}`}>
                {/* STEP 1: 현황 파악 영역 */}
                <section className="main-section overview-section">
                    <div className="section-header">
                        <span className="step-badge">STEP 1</span>
                        <h2 className="section-title">지금 무슨 일이 일어나고 있나요?</h2>
                        <p className="section-subtitle">실시간 정치 이슈를 한눈에 파악하세요</p>
                    </div>
                    
                    <div className="wordcloud-with-hints">
                        <div className="wordcloud-container-main">
                            <h3 className="wordcloud-title">오늘의 뉴스 워드클라우드</h3>
                            <WordCloud onWordClick={handleWordClick} />
                            <div className="tooltip-hint">
                                💡 <strong>단어를 클릭</strong>하면 관련 기사가 자동으로 분류됩니다
                            </div>
                        </div>
                    </div>
                    
                    <div className="quick-actions-main">
                        <button 
                            className="cta-button primary"
                            onClick={() => navigate('/visualization')}
                        >
                            📊 이슈별 상세 분석 보기
                            <span className="arrow">→</span>
                        </button>
                    </div>
                </section>

                {/* STEP 2: 관점 탐색 유도 */}
                <section className="main-section perspective-section">
                    <div className="section-header">
                        <span className="step-badge">STEP 2</span>
                        <h2 className="section-title">다양한 관점에서 살펴보기</h2>
                        <p className="section-subtitle">같은 이슈, 다른 시각 - 진보와 보수 관점 비교</p>
                    </div>
                    
                    <div className="perspective-preview">
                        <div className="perspective-card progressive">
                            <div className="card-header">
                                <h3>진보적 관점</h3>
                                <span className="count-badge">{blueNews.length}건</span>
                            </div>
                            <div className="card-description">
                                복지, 노동권, 공공성을 강조하는 프레임
                            </div>
                        </div>
                        
                        <div className="perspective-divider">⚖️</div>
                        
                        <div className="perspective-card conservative">
                            <div className="card-header">
                                <h3>보수적 관점</h3>
                                <span className="count-badge">{redNews.length}건</span>
                            </div>
                            <div className="card-description">
                                시장, 안보, 성장을 강조하는 프레임
                            </div>
                        </div>
                    </div>
                    
                    <div className="data-columns">
                        {renderNewsList(blueNews, '진보적 관점 뉴스', true)}
                        {renderNewsList(redNews, '보수적 관점 뉴스', false)}
                    </div>
                </section>

                {/* STEP 3: 개별 기사 심층 분석 안내 */}
                <section className="main-section deep-dive-section">
                    <div className="section-header">
                        <span className="step-badge">STEP 3</span>
                        <h2 className="section-title">관심 기사를 깊이 분석하기</h2>
                        <p className="section-subtitle">AI가 분석한 편향성과 근거를 확인하세요</p>
                    </div>
                    
                    <div className="analysis-example">
                        <div className="example-card">
                            <div className="example-icon">🔍</div>
                            <h4>상세 분석 기능</h4>
                            <ul className="feature-list">
                                <li>✓ 기사 본문 전체 표시</li>
                                <li>✓ 편향성 분류 근거 하이라이트</li>
                                <li>✓ 프레임 분석 (갈등/책임/경제/도덕/인간흥미)</li>
                                <li>✓ 반대 관점 기사 추천</li>
                                <li>✓ AI 챗봇 대화형 분석</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div className="quick-actions-main">
                        <button 
                            className="cta-button secondary"
                            onClick={() => {
                                if (blueNews.length > 0) {
                                    navigate(`/bias/blue?link=${encodeURIComponent(blueNews[0].link)}`);
                                }
                            }}
                        >
                            기사 분석 체험하기
                            <span className="arrow">→</span>
                        </button>
                    </div>
                </section>

                {/* 신뢰성 섹션 */}
                <section className="main-section trust-section">
                    <div className="section-header">
                        <span className="step-badge">🔒</span>
                        <h2 className="section-title">알고리버스는 어떻게 작동하나요?</h2>
                        <p className="section-subtitle">투명한 기술 설명과 분석 방법론</p>
                    </div>
                    
                    <div className="trust-cards">
                        <div className="trust-card" onClick={() => navigate('/methodology')}>
                            <div className="trust-icon">📊</div>
                            <h4>분석 방법론</h4>
                            <p>AI 모델 + 규칙 기반 하이브리드</p>
                        </div>
                        
                        <div className="trust-card" onClick={() => navigate('/methodology')}>
                            <div className="trust-icon">📰</div>
                            <h4>데이터 출처</h4>
                            <p>네이버 뉴스 API, 원문 스크래핑</p>
                        </div>
                        
                        <div className="trust-card" onClick={() => navigate('/methodology')}>
                            <div className="trust-icon">⚖️</div>
                            <h4>편향 분류 기준</h4>
                            <p>키워드+문맥+프레임 종합 분석</p>
                        </div>
                        
                        <div className="trust-card" onClick={() => navigate('/methodology')}>
                            <div className="trust-icon">⚠️</div>
                            <h4>한계와 유의사항</h4>
                            <p>참고 자료로 활용, 원문 확인 필수</p>
                        </div>
                    </div>
                    
                    <div className="quick-actions-main">
                        <button 
                            className="cta-button outline"
                            onClick={() => navigate('/methodology')}
                        >
                            🔬 기술 설명 자세히 보기
                            <span className="arrow">→</span>
                        </button>
                    </div>
                </section>
            </div>
            
            <FloatingGuide />
        </div>
    );
};

export default Home;