import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import FloatingGuide from '../common/FloatingGuide';
import Breadcrumb from '../common/Breadcrumb';
import WelcomeModal from '../common/WelcomeModal';
import '../../styles/Home.css';

// ─── 4차원 15유형 프레임 메타데이터 ───
const FRAME_DIMENSIONS = {
    functional: {
        label: '기능적 차원', desc: '이슈 흐름 파악', color: '#6366f1',
        types: {
            definition:  { label_kr: '정의/해석', icon: '🔎', color: '#6366f1', bg: '#eef2ff' },
            cause:       { label_kr: '원인',      icon: '🔗', color: '#8b5cf6', bg: '#f5f3ff' },
            consequence: { label_kr: '결과/영향', icon: '📉', color: '#a78bfa', bg: '#ede9fe' },
            remedy:      { label_kr: '대책',      icon: '🛠️', color: '#7c3aed', bg: '#f5f3ff' },
        },
    },
    perspective: {
        label: '특정관점 차원', desc: '보도 시각', color: '#10b981',
        types: {
            social:          { label_kr: '사회',       icon: '👥', color: '#10b981', bg: '#ecfdf5' },
            economic:        { label_kr: '경제',       icon: '💰', color: '#059669', bg: '#ecfdf5' },
            policy:          { label_kr: '정책',       icon: '📋', color: '#0d9488', bg: '#f0fdfa' },
            morality:        { label_kr: '도덕성',     icon: '⚖️', color: '#f59e0b', bg: '#fffbeb' },
            responsibility:  { label_kr: '책임',       icon: '🎯', color: '#d97706', bg: '#fffbeb' },
            democratic:      { label_kr: '민주합의',   icon: '🤝', color: '#0ea5e9', bg: '#f0f9ff' },
            human_interest:  { label_kr: '인간적흥미', icon: '💬', color: '#ec4899', bg: '#fdf2f8' },
        },
    },
    situation: {
        label: '상태/상황 차원', desc: '이슈 분위기', color: '#ef4444',
        types: {
            conflict: { label_kr: '갈등',     icon: '⚔️', color: '#ef4444', bg: '#fef2f2' },
            crisis:   { label_kr: '위기/위험', icon: '🚨', color: '#dc2626', bg: '#fef2f2' },
        },
    },
    delivery: {
        label: '전달방식 차원', desc: '보도 형식', color: '#78716c',
        types: {
            accusation:  { label_kr: '의혹/고발',   icon: '🔍', color: '#78716c', bg: '#f5f5f4' },
            informative: { label_kr: '단순정보전달', icon: '📰', color: '#9ca3af', bg: '#f9fafb' },
        },
    },
};

// 빠른 참조용 flat map
const FRAME_META = {};
for (const dim of Object.values(FRAME_DIMENSIONS)) {
    for (const [key, meta] of Object.entries(dim.types)) {
        FRAME_META[key] = meta;
    }
}

const Home = ({ onWordSelected }) => {
    const [isSidebarActive, setIsSidebarActive] = useState(false);
    const navigate = useNavigate();

    // ─── 이슈 상태 ───
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [totalArticles, setTotalArticles] = useState(0);
    const [updatedAt, setUpdatedAt] = useState(null);

    // ─── 트렌딩 키워드 ───
    const [trendingKeywords, setTrendingKeywords] = useState([]);
    const trendingScrollRef = useRef(null);

    useEffect(() => {
        const el = trendingScrollRef.current;
        if (!el) return;
        const handleWheel = (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        };
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [trendingKeywords]);

    // ─── 확장 상태 ───
    const [expandedIssue, setExpandedIssue] = useState(null);

    // ─── 기사 상세 팝업 ───
    const [popupArticle, setPopupArticle] = useState(null);

    // ─── 데이터 패칭 ───
    const fetchIssues = useCallback(async (forceRefresh = false) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                category: 'all',
                timeRange: '12h',
                limit: '15',
                forceRefresh: forceRefresh ? 'true' : 'false'
            });
            const res = await fetch(`http://localhost:5000/api/issues/realtime?${params}`);
            if (!res.ok) throw new Error('이슈 데이터를 불러올 수 없습니다.');
            const data = await res.json();
            setIssues(data.issues || []);
            setTotalArticles(data.totalArticles || 0);
            setUpdatedAt(data.updatedAt || null);
        } catch (err) {
            console.error('이슈 로드 실패:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchTrending = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:5000/api/issues/trending');
            if (res.ok) {
                const data = await res.json();
                setTrendingKeywords((data.keywords || []).slice(0, 20));
            }
        } catch { /* 무시 */ }
    }, []);

    useEffect(() => {
        fetchIssues();
        fetchTrending();
        const interval = setInterval(fetchIssues, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchIssues, fetchTrending]);

    // ─── 이슈 클릭 → Visualization 이동 ───
    const handleIssueClick = (keyword) => {
        sessionStorage.setItem('keyword', keyword);
        navigate(`/visualization?keyword=${encodeURIComponent(keyword)}&autoOpen=issue`);
        if (onWordSelected) onWordSelected(keyword);
    };

    const toggleExpand = (issueId) => {
        setExpandedIssue(expandedIssue === issueId ? null : issueId);
    };

    const formatUpdateTime = (isoStr) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        return d.toLocaleString('ko-KR', {
            month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="home-layout">
            <WelcomeModal />
            <Breadcrumb />
            <Sidebar isActive={isSidebarActive} />
            <div className={`main-content ${isSidebarActive ? 'sidebar-active' : ''}`}>

                {/* ═══ 히어로 섹션 ═══ */}
                <section className="hero-section">
                    <div className="hero-inner" style={{ position: 'relative' }}>
                        <h1 className="hero-title">오늘의 주요 이슈</h1>
                        <p className="hero-subtitle">
                            지금 가장 주목받는 전국·국제 뉴스 이슈를 클러스터별로 정리합니다
                        </p>
                        <div className="hero-stats">
                            <span className="stat-item">
                                <span className="stat-number">{totalArticles}</span>
                                <span className="stat-label">수집된 기사</span>
                            </span>
                            <span className="stat-divider">|</span>
                            <span className="stat-item">
                                <span className="stat-number">{issues.length}</span>
                                <span className="stat-label">이슈 클러스터</span>
                            </span>
                            {updatedAt && (
                                <>
                                    <span className="stat-divider">|</span>
                                    <span className="stat-item">
                                        <span className="stat-label">업데이트: {formatUpdateTime(updatedAt)}</span>
                                    </span>
                                </>
                            )}
                        </div>

                        {/* ═══ 트렌딩 키워드 ═══ */}
                        {trendingKeywords.length > 0 && (
                            <div className="trending-bar">
                                <span className="trending-label">Trending</span>
                                <div className="trending-scroll" ref={trendingScrollRef}>
                                    {trendingKeywords.map((kw, i) => (
                                        <span key={i} className="trending-chip" onClick={() => handleIssueClick(kw.text)}>
                                            #{kw.text}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <button 
                            className="refresh-btn hero-refresh-btn" 
                            onClick={() => fetchIssues(true)} 
                            disabled={loading}
                            style={{ 
                                position: 'absolute', top: '16px', right: '0', 
                                backgroundColor: 'rgba(255, 255, 255, 0.15)', 
                                color: 'white', border: '1px solid rgba(255, 255, 255, 0.3)', 
                                padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', 
                                display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600',
                                transition: 'all 0.2s ease', backdropFilter: 'blur(4px)'
                            }}
                            onMouseOver={(e) => { if(!loading) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)'; }}
                            onMouseOut={(e) => { if(!loading) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'; }}
                        >
                            {loading ? '⏳' : '🔄'} 새로고침
                        </button>
                    </div>
                </section>

                {/* ═══ 이슈 목록 ═══ */}
                <section className="issues-section">
                    {loading && issues.length === 0 ? (
                        <div className="loading-state">
                            <div className="loading-spinner" />
                            <p>실시간 이슈를 수집하고 있습니다...</p>
                            <p className="loading-hint">네이버 뉴스에서 다중 카테고리 기사를 분석 중입니다</p>
                        </div>
                    ) : error ? (
                        <div className="error-state">
                            <p className="error-icon">⚠️</p>
                            <p>{error}</p>
                            <button onClick={fetchIssues} className="retry-btn">다시 시도</button>
                        </div>
                    ) : issues.length === 0 ? (
                        <div className="empty-state">
                            <p className="empty-icon">📭</p>
                            <p>현재 조건에 맞는 이슈가 없습니다</p>
                        </div>
                    ) : (
                        <div className="issues-grid">
                            {issues.map((issue, idx) => (
                                <IssueCard
                                    key={issue.id || idx}
                                    issue={issue}
                                    rank={idx + 1}
                                    isExpanded={expandedIssue === issue.id}
                                    onToggle={() => toggleExpand(issue.id)}
                                    onClick={() => handleIssueClick(issue.keyword)}
                                    onArticleClick={setPopupArticle}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* ═══ 서비스 안내 섹션 ═══ */}
                <section className="info-section">
                    <div className="info-cards">
                        <div className="info-card">
                            <div className="info-icon">🔍</div>
                            <h4>이슈 클릭</h4>
                            <p>이슈를 클릭하면 관련 기사의 프레임 분석을 볼 수 있습니다</p>
                        </div>
                        <div className="info-card">
                            <div className="info-icon">📊</div>
                            <h4>프레임 분석</h4>
                            <p>같은 이슈를 다른 미디어가 어떤 관점으로 보도하는지 비교합니다</p>
                        </div>
                        <div className="info-card">
                            <div className="info-icon">⏱️</div>
                            <h4>반나절 주기 갱신</h4>
                            <p>다매체 보도 기반으로 전국·국제급 이슈만 선별합니다</p>
                        </div>
                        <div className="info-card" onClick={() => navigate('/methodology')}>
                            <div className="info-icon">📖</div>
                            <h4>분석 방법론</h4>
                            <p>알고리버스의 뉴스 분석 기술을 확인하세요</p>
                        </div>
                    </div>
                </section>
            </div>

            {/* ═══ 기사 상세 팝업 ═══ */}
            {popupArticle && (
                <ArticlePopup article={popupArticle} onClose={() => setPopupArticle(null)} />
            )}

            <FloatingGuide />
        </div>
    );
};

// ═══════════════════════════════════════════
//  기사 상세 팝업 컴포넌트
// ═══════════════════════════════════════════
const ArticlePopup = ({ article, onClose }) => {
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKey);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    const primaryMeta = FRAME_META[article.frame] || { label_kr: article.frame_kr, icon: '📄', color: '#6b7280', bg: '#f9fafb' };

    return (
        <div className="popup-overlay" onClick={onClose}>
            <div className="popup-content" onClick={(e) => e.stopPropagation()}>
                <button className="popup-close" onClick={onClose}>✕</button>

                {article.imageUrl && (
                    <div className="popup-image">
                        <img src={article.imageUrl} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                )}

                <div className="popup-body">
                    {/* 멀티라벨 프레임 배지 */}
                    <div className="popup-frame-badges">
                        {(article.frames || [{ type: article.frame, label_kr: article.frame_kr }]).map((f, i) => {
                            const meta = FRAME_META[f.type] || primaryMeta;
                            return (
                                <span key={i} className="popup-frame-badge" style={{ background: meta.bg, color: meta.color }}>
                                    {meta.icon} {meta.label_kr}
                                    {f.score && <span className="popup-frame-score">{Math.round(f.score * 100)}%</span>}
                                </span>
                            );
                        })}
                    </div>

                    <h2 className="popup-title">{article.title}</h2>
                    <div className="popup-meta">
                        <span className="popup-source">{article.source}</span>
                        {article.pubDate && (
                            <span className="popup-date">{new Date(article.pubDate).toLocaleString('ko-KR')}</span>
                        )}
                    </div>

                    {/* 본문 */}
                    <div className="popup-text">
                        {article.full_text ? (
                            article.full_text.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)
                        ) : article.description ? (
                            <p>{article.description}</p>
                        ) : (
                            <p className="popup-notext">본문을 불러올 수 없습니다.</p>
                        )}
                    </div>

                    {/* 프레임 분석 근거 */}
                    {article.evidence?.length > 0 && (
                        <div className="popup-evidence">
                            <h4>프레임 분석 근거</h4>
                            {article.evidence.map((ev, i) => (
                                <div key={i} className="evidence-item">
                                    <span className="evidence-type">{ev.label_kr}</span>
                                    <span className="evidence-text">
                                        "{ev.evidence}"
                                        {ev.matched_cues?.length > 0 && (
                                            <span className="evidence-cues"> — 매칭: {ev.matched_cues.join(', ')}</span>
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <a href={article.link} target="_blank" rel="noopener noreferrer" className="popup-original-link">
                        원문 보기 →
                    </a>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════
//  이슈 카드 컴포넌트
// ═══════════════════════════════════════════
const IssueCard = ({ issue, rank, isExpanded, onToggle, onClick, onArticleClick }) => {
    const [activeDim, setActiveDim] = useState(null);
    const [activeType, setActiveType] = useState(null);
    const [showAllArticles, setShowAllArticles] = useState(false);
    const hasFrameData = !!issue.frameData;

    // 활성 유형의 기사 목록
    const activeArticles = activeType && hasFrameData
        ? issue.frameData.byFrame[activeType] || []
        : [];

    return (
        <article className={`issue-card ${isExpanded ? 'expanded' : ''}`}>
            {/* 카드 헤더 */}
            <div className="issue-card-header" onClick={onToggle}>
                <div className="issue-rank">
                    <span className={`rank-number ${rank <= 3 ? 'top' : ''}`}>{rank}</span>
                </div>
                <div className="issue-main-info">
                    <div className="issue-meta">
                        <span className="issue-time">{issue.timeAgo}</span>
                        <span className="issue-article-count">{issue.articleCount}건</span>
                        {hasFrameData && <span className="frame-badge-mini">프레임 분석</span>}
                    </div>
                    <h3 className="issue-title">{issue.title}</h3>
                    {issue.relatedKeywords?.length > 0 && (
                        <div className="issue-keywords">
                            {issue.relatedKeywords.slice(0, 5).map(kw => (
                                <span key={kw.word} className="keyword-tag">#{kw.word}</span>
                            ))}
                        </div>
                    )}
                </div>
                {issue.thumbnailUrl && (
                    <div className="issue-thumbnail">
                        <img src={issue.thumbnailUrl} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                )}
                <div className="expand-icon">{isExpanded ? '▲' : '▼'}</div>
            </div>

            {/* 확장 영역 */}
            {isExpanded && (
                <div className="issue-card-body">
                    {/* 요약 카드 (지금 상황 + 주목 포인트) */}
                    <div className="summary-cards">
                        {issue.summary?.current && (
                            <div className="summary-item current">
                                <div className="summary-label">📍 지금 상황은?</div>
                                <p>{issue.summary.current}</p>
                            </div>
                        )}
                        {issue.summary?.highlight && (
                            <div className="summary-item highlight">
                                <div className="summary-label">⭐ 주목 포인트</div>
                                <p>{issue.summary.highlight}</p>
                            </div>
                        )}
                    </div>

                    {/* 프레임 분류 (4차원 15유형 — 상위 5개 클러스터) */}
                    {hasFrameData ? (
                        <div className="frame-section">
                            <h4 className="section-title">프레임 분석 (4차원 15유형)</h4>

                            {/* 차원 탭 */}
                            <div className="dimension-tabs">
                                {Object.entries(FRAME_DIMENSIONS).map(([dimKey, dim]) => {
                                    const dimData = issue.frameData.dimensionSummary?.[dimKey];
                                    if (!dimData) return null;
                                    const totalInDim = Object.values(dimData.typeCounts).reduce((a, b) => a + b, 0);
                                    return (
                                        <button
                                            key={dimKey}
                                            className={`dimension-tab ${activeDim === dimKey ? 'active' : ''}`}
                                            style={activeDim === dimKey
                                                ? { background: dim.color, color: '#fff', borderColor: dim.color }
                                                : { borderColor: dim.color, color: dim.color }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (activeDim === dimKey) { setActiveDim(null); setActiveType(null); }
                                                else { setActiveDim(dimKey); setActiveType(null); }
                                            }}
                                        >
                                            {dim.label} ({totalInDim})
                                        </button>
                                    );
                                })}
                            </div>

                            {/* 선택된 차원의 유형 탭 */}
                            {activeDim && issue.frameData.dimensionSummary?.[activeDim] && (
                                <div className="frame-type-area">
                                    <div className="frame-tabs">
                                        {Object.entries(issue.frameData.dimensionSummary[activeDim].typeCounts).map(([typeKey, count]) => {
                                            const meta = FRAME_META[typeKey];
                                            if (!meta) return null;
                                            return (
                                                <button
                                                    key={typeKey}
                                                    className={`frame-tab ${activeType === typeKey ? 'active' : ''}`}
                                                    style={activeType === typeKey
                                                        ? { background: meta.color, color: '#fff', borderColor: meta.color }
                                                        : { borderColor: meta.color, color: meta.color }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveType(activeType === typeKey ? null : typeKey);
                                                    }}
                                                >
                                                    {meta.icon} {meta.label_kr} ({count})
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* 선택된 유형의 기사 목록 */}
                                    {activeType && activeArticles.length > 0 && (
                                        <div className="frame-articles">
                                            {activeArticles.map((art, i) => (
                                                <div
                                                    key={i}
                                                    className="frame-article-item"
                                                    onClick={(e) => { e.stopPropagation(); onArticleClick(art); }}
                                                >
                                                    <span className="frame-article-source">{art.source}</span>
                                                    <span className="frame-article-title">{art.title}</span>
                                                    {/* 멀티라벨 서브 배지 */}
                                                    {art.frames?.length > 1 && (
                                                        <span className="multi-label-badges">
                                                            {art.frames.slice(1).map((f, j) => {
                                                                const m = FRAME_META[f.type];
                                                                return m ? (
                                                                    <span key={j} className="mini-frame-badge" style={{ color: m.color, background: m.bg }}>
                                                                        {m.icon}{m.label_kr}
                                                                    </span>
                                                                ) : null;
                                                            })}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* 프레임 없는 이슈: 기사 목록 */
                        issue.allArticles?.length > 0 && (
                            <div className="preview-articles-wrapper">
                                <h4 className="section-title">전체 뉴스 모아보기 ({issue.allArticles.length}건)</h4>
                                <div className={`preview-articles ${showAllArticles ? 'show-all' : ''}`}>
                                    {(showAllArticles ? issue.allArticles : issue.previewArticles).map((article, i) => (
                                        <a key={i} href={article.link} target="_blank" rel="noopener noreferrer" className="preview-article-item">
                                            <span className="preview-index">{i + 1}</span>
                                            <span className="preview-source">{article.source}</span>
                                            <span className="preview-article-title">{article.title}</span>
                                        </a>
                                    ))}
                                </div>
                                {issue.allArticles.length > issue.previewArticles.length && (
                                    <button 
                                        className="toggle-articles-btn" 
                                        onClick={(e) => { e.stopPropagation(); setShowAllArticles(!showAllArticles); }}
                                    >
                                        {showAllArticles ? '▲ 접기' : `▼ 전체 기사 보기 (${issue.allArticles.length}건)`}
                                    </button>
                                )}
                            </div>
                        )
                    )}

                    {/* 타임라인 미니 (커스텀 5건) */}
                    {issue.timeline?.length > 0 && (
                        <div className="mini-timeline">
                            <h4 className="section-title">타임라인</h4>
                            <div className="timeline-track">
                                {issue.timeline.map((ev, i) => (
                                    <a key={i} href={ev.link} target="_blank" rel="noopener noreferrer" className="timeline-node">
                                        <span className="timeline-dot" />
                                        <span className="timeline-time">{ev.timeAgo}</span>
                                        <span className="timeline-text">{ev.title}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 출처 */}
                    {issue.sources?.length > 0 && (
                        <div className="source-list">
                            <span className="source-label">출처:</span>
                            {issue.sources.map((src, i) => (
                                <span key={i} className="source-tag">{src}</span>
                            ))}
                        </div>
                    )}

                    <button className="analyze-btn" onClick={onClick}>
                        📊 프레임 분석 보기
                        <span className="btn-arrow">→</span>
                    </button>
                </div>
            )}
        </article>
    );
};

export default Home;