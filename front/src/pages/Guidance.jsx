import React, { useState, useEffect } from 'react';
import axios from 'axios'; // axios import
import '../styles/Guidance.css';

const Guidance = () => {
    const [keyword, setKeyword] = useState('');
    const [progressiveNews, setProgressiveNews] = useState([]);
    const [conservativeNews, setConservativeNews] = useState([]);
    const [isLoading, setIsLoading] = useState(false); // 로딩 상태
    const [error, setError] = useState(null); // 에러 상태
    const [searched, setSearched] = useState(false); // 검색 여부 상태
    
    // 예시 키워드 목록
    const examples = ['의대 증원', '연금 개혁', '선거구제', '기본소득', '대북 정책', '부동산 세제', '통일교'];

    // HTML 엔티티 디코딩 함수
    const decodeHTMLEntities = (text) => {
        if (!text) return "";
        const title = text.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
        return title;
    };

    // 검색 로직
    const searchWithKeyword = async (term) => {
        if (!term.trim()) return;
        
        setIsLoading(true);
        setError(null);
        setSearched(true); // 검색 시작
        setProgressiveNews([]); // 이전 결과 초기화
        setConservativeNews([]); // 이전 결과 초기화

        try {
            const response = await axios.get('http://localhost:5000/api/guidance/search', {
                params: { keyword: term }
            });
            setProgressiveNews(response.data.progressiveNews || []);
            setConservativeNews(response.data.conservativeNews || []);
        } catch (err) {
            setError('뉴스 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            console.error("뉴스 검색 실패:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearchClick = () => {
        searchWithKeyword(keyword);
    };

    const handleClear = () => {
        setKeyword('');
        setProgressiveNews([]);
        setConservativeNews([]);
        setSearched(false); // 검색 상태 초기화
        setError(null);
    };

    const handleExampleClick = (tag) => {
        setKeyword(tag);
        searchWithKeyword(tag);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearchClick();
        }
    };

    // 기사 카드 렌더링 함수
    const renderArticleCard = (news, index) => (
        <a 
            key={index} 
            href={news.link} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="guidance-article-link"
        >
            <div className="guidance-article">
                <img 
                    src={news.image_url || news.imageUrl || "https://placehold.co/300x160?text=No+Image"} 
                    alt="뉴스 썸네일" 
                    onError={(e) => {
                        e.target.onerror = null; 
                        e.target.src = "https://placehold.co/300x160?text=Image+Load+Failed";
                    }}
                />
                <h4>{decodeHTMLEntities(news.title)}</h4>
                <p>{decodeHTMLEntities(news.description || '').substring(0, 100) + '...'}</p>
            </div>
        </a>
    );

    // 결과 표시 컴포넌트
    const renderResults = (newsList, side) => {
        if (isLoading) {
            return <div className="guidance-loading">"{keyword}" 검색 중...</div>;
        }
        if (error && newsList.length === 0) { // 에러는 한쪽에만 표시
            return <p className="guidance-message error">{error}</p>;
        }
        if (searched && newsList.length === 0) {
            return <p className="guidance-message">검색 결과가 없습니다.</p>;
        }
        return newsList.length > 0 ? newsList.map(renderArticleCard) : (
            <p className="guidance-message">키워드를 검색하면<br/>{side} 성향 기사가 표시됩니다.</p>
        );
    };

    return (
        <div className="guidance-container">
            <div className="guidance-header">
                <h2>🧭 뉴스 관점 지도</h2>
                <p>이슈 키워드를 기준으로 서로 다른 관점을 비교합니다.</p>
            </div>

            <div className="guidance-search-box">
                <input 
                    id="searchInput" 
                    placeholder="키워드로 기사 검색 (예: 의대 증원)" 
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyPress={handleKeyPress}
                />
                <button id="searchBtn" onClick={handleSearchClick} disabled={isLoading}>
                    {isLoading ? '검색 중...' : '검색'}
                </button>
                <button id="clearAll" onClick={handleClear}>초기화</button>
            </div>

            {/* 추천 키워드 자동 표시 */}
            <div className="guidance-example-box" id="exampleBox">
                {examples.map((tag, index) => (
                    <span 
                        key={index} 
                        className="guidance-example" 
                        onClick={() => handleExampleClick(tag)}
                    >
                        #{tag}
                    </span>
                ))}
            </div>

            <div className="guidance-map">
                <div className="guidance-column">
                    <h3>진보 (Progressive)</h3>
                    <div id="progressiveBox">
                        {renderResults(progressiveNews, '진보')}
                    </div>
                </div>

                <div className="guidance-vs">VS</div>

                <div className="guidance-column">
                    <h3>보수 (Conservative)</h3>
                    <div id="conservativeBox">
                        {renderResults(conservativeNews, '보수')}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Guidance;
