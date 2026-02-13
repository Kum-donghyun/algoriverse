/**
 * 신뢰도 점수 계산 유틸리티
 * 
 * 분석 결과의 품질을 평가하여 신뢰도 점수를 산출합니다.
 */

/**
 * 키워드 일치도 계산
 * @param {string} content - 기사 본문
 * @param {string} keyword - 검색 키워드
 * @param {Object} analysis - 분석 결과 객체
 * @returns {number} 0-100 사이의 점수
 */
export const calculateKeywordMatch = (content, keyword, analysis) => {
    if (!content || !keyword) return 50;
    
    let score = 50; // 기본 점수
    
    // 1. 키워드 출현 빈도 (최대 30점)
    const normalizedContent = content.toLowerCase();
    const normalizedKeyword = keyword.toLowerCase();
    const occurrences = (normalizedContent.match(new RegExp(normalizedKeyword, 'g')) || []).length;
    const wordCount = content.split(/\s+/).length;
    const keywordDensity = (occurrences / wordCount) * 100;
    
    if (keywordDensity > 2) score += 30;
    else if (keywordDensity > 1) score += 20;
    else if (keywordDensity > 0.5) score += 10;
    else if (keywordDensity > 0) score += 5;
    
    // 2. 제목에 키워드 포함 여부 (최대 20점)
    if (analysis?.article?.title && analysis.article.title.toLowerCase().includes(normalizedKeyword)) {
        score += 20;
    }
    
    return Math.min(100, score);
};

/**
 * 프레임 일관성 계산
 * @param {Object} gptAnalysis - GPT 분석 결과
 * @param {Object} modelResult - 모델 예측 결과
 * @returns {number} 0-100 사이의 점수
 */
export const calculateFrameConsistency = (gptAnalysis, modelResult) => {
    if (!gptAnalysis || !modelResult) return 60;
    
    let score = 60; // 기본 점수
    
    // 1. 프레임 분석 완성도 (최대 20점)
    if (gptAnalysis.frame) score += 10;
    if (gptAnalysis.keywords && gptAnalysis.keywords.length > 0) score += 10;
    
    // 2. 모델 신뢰도 (최대 20점)
    if (modelResult.confidence) {
        const confidence = parseFloat(modelResult.confidence);
        if (confidence > 0.8) score += 20;
        else if (confidence > 0.6) score += 15;
        else if (confidence > 0.4) score += 10;
        else score += 5;
    }
    
    return Math.min(100, score);
};

/**
 * 문맥 신뢰도 계산
 * @param {Object} article - 기사 객체
 * @param {Object} analysis - 분석 결과
 * @returns {number} 0-100 사이의 점수
 */
export const calculateContextScore = (article, analysis) => {
    if (!article) return 50;
    
    let score = 50; // 기본 점수
    
    // 1. 기사 길이 (최대 15점)
    const content = article.content || article.description || '';
    const wordCount = content.split(/\s+/).length;
    
    if (wordCount > 500) score += 15;
    else if (wordCount > 300) score += 10;
    else if (wordCount > 100) score += 5;
    
    // 2. 메타데이터 완성도 (최대 15점)
    if (article.title) score += 5;
    if (article.pubDate) score += 5;
    if (article.press) score += 5;
    
    // 3. GPT 분석 상세도 (최대 20점)
    if (analysis?.gpt_analysis) {
        const gpt = analysis.gpt_analysis;
        if (gpt.sentiment) score += 5;
        if (gpt.frame) score += 5;
        if (gpt.keywords && gpt.keywords.length > 0) score += 5;
        if (gpt.rationale) score += 5;
    }
    
    return Math.min(100, score);
};

/**
 * 종합 신뢰도 계산
 * @param {Object} params - 계산에 필요한 모든 매개변수
 * @returns {Object} 신뢰도 점수 객체
 */
export const calculateTrustScore = ({ article, analysis, keyword }) => {
    const content = article?.content || article?.description || '';
    
    const keywordMatch = calculateKeywordMatch(content, keyword, analysis);
    const frameConsistency = calculateFrameConsistency(
        analysis?.gpt_analysis,
        analysis?.model_result
    );
    const contextScore = calculateContextScore(article, analysis);
    
    // 가중 평균 (키워드 35%, 프레임 35%, 문맥 30%)
    const trustScore = Math.round(
        keywordMatch * 0.35 + 
        frameConsistency * 0.35 + 
        contextScore * 0.30
    );
    
    return {
        trustScore,
        keywordMatch,
        frameConsistency,
        contextScore
    };
};

/**
 * Visualization 페이지용 신뢰도 계산 (여러 기사 종합)
 * @param {Array} articles - 기사 배열
 * @param {string} keyword - 검색 키워드
 * @returns {Object} 신뢰도 점수 객체
 */
export const calculateVisualizationTrustScore = (articles, keyword) => {
    if (!articles || articles.length === 0) {
        return {
            trustScore: 70,
            keywordMatch: 75,
            frameConsistency: 70,
            contextScore: 65
        };
    }
    
    let totalKeyword = 0;
    let totalFrame = 0;
    let totalContext = 0;
    
    articles.forEach(article => {
        const scores = calculateTrustScore({ 
            article, 
            analysis: article, 
            keyword 
        });
        totalKeyword += scores.keywordMatch;
        totalFrame += scores.frameConsistency;
        totalContext += scores.contextScore;
    });
    
    const count = articles.length;
    const keywordMatch = Math.round(totalKeyword / count);
    const frameConsistency = Math.round(totalFrame / count);
    const contextScore = Math.round(totalContext / count);
    
    const trustScore = Math.round(
        keywordMatch * 0.35 + 
        frameConsistency * 0.35 + 
        contextScore * 0.30
    );
    
    return {
        trustScore,
        keywordMatch,
        frameConsistency,
        contextScore
    };
};
