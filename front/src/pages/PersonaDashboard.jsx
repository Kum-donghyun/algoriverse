import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, PieChart, Pie, LineChart, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import FloatingGuide from '../components/common/FloatingGuide';
import Breadcrumb from '../components/common/Breadcrumb';
import PersonaSelector from '../components/common/PersonaSelector';
import '../styles/PersonaDashboard.css';

const PersonaDashboard = () => {
    const navigate = useNavigate();
    const [persona, setPersona] = useState(null);
    const [showPersonaModal, setShowPersonaModal] = useState(false);
    const [recentSearches, setRecentSearches] = useState([]);
    const [stats, setStats] = useState({
        totalSearches: 0,
        articlesAnalyzed: 0,
        avgTrustScore: 0,
        biasBalance: { progressive: 0, conservative: 0 }
    });

    useEffect(() => {
        // localStorage에서 페르소나 가져오기
        const savedPersona = localStorage.getItem('selectedPersona');
        setPersona(savedPersona || 'general');

        // 최근 검색 기록 가져오기
        const searches = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        setRecentSearches(searches.slice(0, 5));

        // 통계 계산
        calculateStats(searches);
    }, []);

    const calculateStats = (searches) => {
        if (searches.length === 0) return;

        const totalSearches = searches.length;
        let articlesAnalyzed = 0;
        let totalTrust = 0;
        let progressive = 0;
        let conservative = 0;

        searches.forEach(search => {
            if (search.articleCount) articlesAnalyzed += search.articleCount;
            if (search.trustScore) totalTrust += search.trustScore;
            if (search.biasDistribution) {
                progressive += search.biasDistribution.progressive || 0;
                conservative += search.biasDistribution.conservative || 0;
            }
        });

        setStats({
            totalSearches,
            articlesAnalyzed,
            avgTrustScore: totalSearches > 0 ? Math.round(totalTrust / totalSearches) : 75,
            biasBalance: { progressive, conservative }
        });
    };

    // 페르소나별 맞춤 콘텐츠
    const getPersonaContent = () => {
        switch (persona) {
            case 'professional':
                return {
                    title: '전문가 대시보드',
                    subtitle: '심층 분석과 트렌드를 한눈에',
                    features: [
                        { icon: '📊', title: '고급 통계', desc: '정량적 분석 결과' },
                        { icon: '🔍', title: '비교 분석', desc: '언론사별 편향성 비교' },
                        { icon: '📈', title: '트렌드', desc: '시계열 변화 추적' },
                        { icon: '💾', title: '데이터 내보내기', desc: 'CSV/PDF 저장' }
                    ],
                    quickLinks: [
                        { label: '방법론 상세', path: '/methodology' },
                        { label: '통계 리포트', path: '/dashboard?view=stats' },
                        { label: '비교 분석', path: '/dashboard?view=compare' }
                    ]
                };
            case 'student':
                return {
                    title: '학습자 대시보드',
                    subtitle: '미디어 리터러시 학습 공간',
                    features: [
                        { icon: '🎯', title: '학습 진행도', desc: '학습 활동 트래킹' },
                        { icon: '🎮', title: '퀴즈', desc: '편향성 판별 연습' },
                        { icon: '📚', title: '학습 자료', desc: '이해하기 쉬운 설명' },
                        { icon: '🏆', title: '성취도', desc: '학습 배지 획득' }
                    ],
                    quickLinks: [
                        { label: '편향성 퀴즈', path: '/quiz' },
                        { label: '학습 자료', path: '/education-template' },
                        { label: '내 진행도', path: '/dashboard?view=progress' }
                    ]
                };
            case 'educator':
                return {
                    title: '교육자 대시보드',
                    subtitle: '수업 자료 제작 및 관리',
                    features: [
                        { icon: '📋', title: '수업 자료', desc: '템플릿 다운로드' },
                        { icon: '👥', title: '학생 관리', desc: '학습 현황 모니터링' },
                        { icon: '📊', title: '시각 자료', desc: '차트/그래프 생성' },
                        { icon: '🎓', title: '커리큘럼', desc: '교안 생성 도구' }
                    ],
                    quickLinks: [
                        { label: '교육 템플릿', path: '/education-template' },
                        { label: '수업 자료 생성', path: '/create-material' },
                        { label: '학생 퀴즈 만들기', path: '/create-quiz' }
                    ]
                };
            default:
                return {
                    title: '마이 대시보드',
                    subtitle: '나의 뉴스 분석 활동',
                    features: [
                        { icon: '🔍', title: '검색 기록', desc: '최근 분석 내역' },
                        { icon: '📰', title: '관심 키워드', desc: '자주 찾는 주제' },
                        { icon: '💡', title: '인사이트', desc: '나의 뉴스 소비 패턴' },
                        { icon: '⚙️', title: '설정', desc: '개인화 옵션' }
                    ],
                    quickLinks: [
                        { label: '새 검색 시작', path: '/' },
                        { label: '분석 방법', path: '/methodology' },
                        { label: '설정', path: '/settings' }
                    ]
                };
        }
    };

    const content = getPersonaContent();

    // 최근 검색 데이터 시각화
    const searchTrendData = useMemo(() => {
        return recentSearches.map((search, idx) => ({
            name: `검색 ${idx + 1}`,
            articles: search.articleCount || 0,
            trust: search.trustScore || 75
        }));
    }, [recentSearches]);

    // 편향성 분포 데이터
    const biasDistributionData = [
        { name: '진보', value: stats.biasBalance.progressive, color: '#2196F3' },
        { name: '보수', value: stats.biasBalance.conservative, color: '#F44336' }
    ];

    return (
        <div className="persona-dashboard-page">
            <Breadcrumb />
            <FloatingGuide />

            <div className="dashboard-container">
                <header className="dashboard-header">
                    <div className="header-content">
                        <h1>{content.title}</h1>
                        <p className="subtitle">{content.subtitle}</p>
                        <div className="persona-badge-row">
                            <div className="current-persona">
                                <span className="icon">
                                    {persona === 'professional' && '👔'}
                                    {persona === 'student' && '🎓'}
                                    {persona === 'educator' && '👨‍🏫'}
                                    {persona === 'general' && '👤'}
                                </span>
                                <span className="persona-name">
                                    {persona === 'professional' && '전문가 모드'}
                                    {persona === 'student' && '학습자 모드'}
                                    {persona === 'educator' && '교육자 모드'}
                                    {persona === 'general' && '일반 사용자 모드'}
                                </span>
                            </div>
                            <button 
                                onClick={() => setShowPersonaModal(true)}
                            >
                                🔄 페르소나 변경
                            </button>
                        </div>
                    </div>
                </header>

                {/* 통계 요약 */}
                <section className="stats-summary">
                    <div className="stat-card">
                        <div className="stat-icon">🔍</div>
                        <div className="stat-value">{stats.totalSearches}</div>
                        <div className="stat-label">총 검색 횟수</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📰</div>
                        <div className="stat-value">{stats.articlesAnalyzed}</div>
                        <div className="stat-label">분석한 기사</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">💯</div>
                        <div className="stat-value">{stats.avgTrustScore}%</div>
                        <div className="stat-label">평균 신뢰도</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">⚖️</div>
                        <div className="stat-value">
                            {stats.biasBalance.progressive + stats.biasBalance.conservative > 0
                                ? `${Math.round((stats.biasBalance.progressive / (stats.biasBalance.progressive + stats.biasBalance.conservative)) * 100)}%`
                                : '50%'}
                        </div>
                        <div className="stat-label">진보 비율</div>
                    </div>
                </section>

                {/* 시각화 섹션 */}
                <section className="visualization-section">
                    <div className="chart-container">
                        <h3>최근 검색 활동</h3>
                        {searchTrendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={searchTrendData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="articles" fill="#667eea" name="분석 기사 수" />
                                    <Bar dataKey="trust" fill="#764ba2" name="신뢰도 점수" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-state">
                                <p>아직 검색 기록이 없습니다</p>
                                <button onClick={() => navigate('/')}>첫 검색 시작하기</button>
                            </div>
                        )}
                    </div>

                    <div className="chart-container">
                        <h3>편향성 분포</h3>
                        {biasDistributionData.some(d => d.value > 0) ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={biasDistributionData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={(entry) => `${entry.name}: ${entry.value}`}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {biasDistributionData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-state">
                                <p>분석 데이터가 충분하지 않습니다</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* 페르소나별 기능 */}
                <section className="features-section">
                    <h2>주요 기능</h2>                    {persona && (
                        <div className="persona-description">
                            {persona === 'professional' && (
                                <p>📊 전문가님을 위한 고급 분석 도구와 상세 통계를 제공합니다. 언론사별 편향성 비교, 시계열 트렌드 분석, 데이터 내보내기 등의 기능을 활용하세요.</p>
                            )}
                            {persona === 'student' && (
                                <p>🎓 학습자님을 위한 인터랙티브 학습 도구를 준비했습니다. 퀴즈를 풀면서 미디어 리터러시를 키우고, 학습 진행도를 확인하세요.</p>
                            )}
                            {persona === 'educator' && (
                                <p>👨‍🏫 교육자님을 위한 수업 자료 제작 도구입니다. 템플릿을 다운로드하고, 시각 자료를 생성하여 효과적인 수업을 진행하세요.</p>
                            )}
                            {persona === 'general' && (
                                <p>👤 나의 뉴스 소비 패턴을 분석하고 더 균형잡힌 정보를 탐색하세요. 검색 기록과 관심 키워드를 관리할 수 있습니다.</p>
                            )}
                        </div>
                    )}                    <div className="feature-grid">
                        {content.features.map((feature, idx) => (
                            <div key={idx} className="feature-card">
                                <div className="feature-icon">{feature.icon}</div>
                                <h4>{feature.title}</h4>
                                <p>{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 빠른 링크 */}
                <section className="quick-links-section">
                    <h2>빠른 이동</h2>
                    <div className="quick-links">
                        {content.quickLinks.map((link, idx) => (
                            <button
                                key={idx}
                                className="quick-link-btn"
                                onClick={() => navigate(link.path)}
                            >
                                {link.label} →
                            </button>
                        ))}
                    </div>
                </section>

                {/* 최근 검색 기록 */}
                {recentSearches.length > 0 && (
                    <section className="recent-searches-section">
                        <h2>최근 검색</h2>
                        <div className="searches-list">
                            {recentSearches.map((search, idx) => (
                                <div key={idx} className="search-item">
                                    <div className="search-keyword">"{search.keyword}"</div>
                                    <div className="search-meta">
                                        <span>{search.articleCount || 0}개 기사</span>
                                        <span>•</span>
                                        <span>{new Date(search.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <button
                                        className="reanalyze-btn"
                                        onClick={() => navigate(`/visualization?keyword=${search.keyword}`)}
                                    >
                                        다시 분석
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
            
            {showPersonaModal && (
                <PersonaSelector 
                    onClose={() => setShowPersonaModal(false)}
                    onSelect={(newPersona) => {
                        setPersona(newPersona);
                        window.location.reload();
                    }}
                />
            )}
        </div>
    );
};

export default PersonaDashboard;
