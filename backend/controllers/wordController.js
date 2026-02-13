const axios = require('axios');
const naverConfig = require('../config/newsApiConfig');

// newsController에 있던 함수 그대로 복사해도 됨
const cleanHtmlText = (rawText) => {
    if (!rawText) return '';
    let decodedText = rawText
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    return decodedText.replace(/<[^>]*>?/gm, '');
};

// GET /api/wordcloud/today
const getTodayWordCloud = async (req, res) => {
    if (!naverConfig.clientID || !naverConfig.clientSecret) {
        return res.status(500).json({ error: '네이버 API 설정 오류' });
    }

    try {
        const headers = {
            'X-Naver-Client-Id': naverConfig.clientID,
            'X-Naver-Client-Secret': naverConfig.clientSecret,
        };

        // 1️⃣ 오늘 뉴스 충분히 수집 (최신순)
        const display = 100;
        const pages = 3; // 300개
        let items = [];

        for (let i = 0; i < pages; i++) {
            const start = i * display + 1;
            const url = `${naverConfig.newsSearchUrl}?query=정치&display=${display}&sort=date&start=${start}`;
            const response = await axios.get(url, { headers });
            items.push(...response.data.items);
        }

        // 2️⃣ 오늘 날짜 필터링
        const today = new Date().toISOString().slice(0, 10);

        const todayItems = items.filter(item => {
            const pubDate = new Date(item.pubDate).toISOString().slice(0, 10);
            return pubDate === today;
        });

        // 3️⃣ 텍스트 합치기
        const combinedText = todayItems
            .map(item => cleanHtmlText(item.title + ' ' + item.description))
            .join(' ');

        // 4️⃣ 단어 추출
        const words = combinedText
            .replace(/[^\uAC00-\uD7A3a-zA-Z\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 1);

        // 5️⃣ 불용어 제거
        const stopwords = ['기자', '오늘', '관련', '대한', '있다', '위해'];
        const filteredWords = words.filter(w => !stopwords.includes(w));

        // 6️⃣ 빈도 계산
        const frequency = {};
        filteredWords.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });

        // 7️⃣ 상위 50개 반환
        const result = Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .map(([text, value]) => ({ text, value }));

        res.json(result);

    } catch (error) {
        console.error('워드클라우드 생성 실패:', error.message);
        res.status(500).json({ error: '오늘 워드클라우드 생성 실패' });
    }
};

module.exports = {
    getTodayWordCloud
};
