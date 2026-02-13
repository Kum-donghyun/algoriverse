const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { spawn } = require('child_process');
const OpenAI = require('openai');
const naverConfig = require('../config/newsApiConfig');

// =============================================
// Frame classification helpers (Semetko & Valkenburg inspired)
// =============================================
const EMPHASIS_FRAMES = {
    conflict: {
        label: '갈등 프레임',
        keywords: ['충돌', '갈등', '대립', '논쟁', '격돌', '반대', '파열', '공방', '논란', '맞불', '격화'],
        semetko: [
            '이 사안을 둘러싸고 대립하는 당사자는 누구인가?',
            '서로의 주장을 비교·대조하여 보도했는가?'
        ]
    },
    responsibility: {
        label: '책임 프레임',
        keywords: ['책임', '잘못', '과실', '사과', '징계', '조치', '처벌', '문책', '배상', '책임져야', '국정조사'],
        semetko: [
            '원인과 결과를 특정 행위자에게 귀속시켰는가?',
            '해결책이나 정책 대안을 제시했는가?'
        ]
    },
    economic: {
        label: '경제 프레임',
        keywords: ['경제', '예산', '비용', '수익', '고용', '실업', '성장률', '물가', '투자', '시장', '재정', '세금'],
        semetko: [
            '경제적 이득 또는 손실을 강조했는가?',
            '비용-편익 관점으로 문제를 설명했는가?'
        ]
    },
    morality: {
        label: '도덕 프레임',
        keywords: ['도덕', '윤리', '정의', '공정', '양심', '부패', '비리', '원칙', '가치', '명분', '책임감'],
        semetko: [
            '도덕적·윤리적 판단을 내렸는가?',
            '선/악 또는 옳고 그름의 관점으로 서술했는가?'
        ]
    },
    human_interest: {
        label: '인간흥미 프레임',
        keywords: ['눈물', '사연', '가족', '피해자', '고통', '희망', '감동', '도움', '현장', '삶', '인물'],
        semetko: [
            '개인의 경험이나 감정에 초점을 맞췄는가?',
            '사건의 인간적 측면(고통/희망 등)을 강조했는가?'
        ]
    }
};

const FRAME_KEYS = Object.keys(EMPHASIS_FRAMES);

function splitSentences(text) {
    if (!text) return [];
    return text
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?\u3002\uFF01\uFF1F])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function detectFrame(article) {
    const body = `${article.title || ''} ${article.description_full || article.description || article.full_text || ''}`;
    const lower = body.toLowerCase();
    const scores = {};

    for (const key of FRAME_KEYS) {
        const { keywords } = EMPHASIS_FRAMES[key];
        scores[key] = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
    }

    // pick best frame (fallback to 'other')
    let bestKey = 'other';
    let bestScore = 0;
    for (const key of FRAME_KEYS) {
        if (scores[key] > bestScore) {
            bestScore = scores[key];
            bestKey = key;
        }
    }

    // evidence sentences: top 2 sentences containing any keyword of best frame
    const evidence = [];
    if (bestKey !== 'other') {
        const { keywords } = EMPHASIS_FRAMES[bestKey];
        const sentences = splitSentences(body);
        for (const s of sentences) {
            if (keywords.some((kw) => s.toLowerCase().includes(kw.toLowerCase()))) {
                evidence.push(s.trim());
            }
            if (evidence.length >= 2) break;
        }
    }

    return {
        frame_key: bestKey,
        frame_label: EMPHASIS_FRAMES[bestKey]?.label || '기타',
        frame_score: bestScore,
        evidence_sentences: evidence
    };
}

async function buildFrameSet(articles = []) {
    const frameMap = {};
    for (const a of articles) {
        const result = detectFrame(a);
        const enriched = {
            ...a,
            frame_key: result.frame_key,
            frame_label: result.frame_label,
            frame_score: result.frame_score,
            semetko_features: EMPHASIS_FRAMES[result.frame_key]?.semetko || [],
            evidence_sentences: result.evidence_sentences,
        };

        if (!frameMap[result.frame_key]) frameMap[result.frame_key] = [];
        frameMap[result.frame_key].push(enriched);
    }

    // 총합을 위해 전체 키 추가
    return frameMap;
}

// =============================================
// 공통: 분석 파일 로더
// =============================================
async function loadAnalyzedData(keyword) {
    const filePrefixes = ['news_data_', 'news_500_', 'frame_set_'];
    for (const prefix of filePrefixes) {
        const filename = `${prefix}${keyword}.json`;
        const filePath = path.join(__dirname, '..', 'data', filename);
        try {
            await fs.promises.access(filePath);
            const data = await fs.promises.readFile(filePath, 'utf8');
            const json = JSON.parse(data);
            
            // 배열이면 바로 반환
            if (Array.isArray(json)) return json;
            
            // 객체인 경우 다양한 키 확인
            if (json && typeof json === 'object') {
                // articles, political_nouns, economic, morality 등 다양한 키 지원
                if (Array.isArray(json.articles)) return json.articles;
                if (Array.isArray(json.political_nouns)) return json.political_nouns;
                if (Array.isArray(json.economic)) return json.economic;
                if (Array.isArray(json.morality)) return json.morality;
                if (Array.isArray(json.human_interest)) return json.human_interest;
                if (Array.isArray(json.conflict)) return json.conflict;
                if (Array.isArray(json.responsibility)) return json.responsibility;
                
                // 첫 번째 배열 값 찾기
                const firstArrayValue = Object.values(json).find(v => Array.isArray(v));
                if (firstArrayValue) return firstArrayValue;
            }
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error(`Error reading ${filePath}:`, err.message);
            }
        }
    }
    return [];
}

// ============================================================
// Helper Functions from navernews_all.js
// ============================================================

/**
 * HTML 태그를 제거하고 텍스트만 추출
 */
function stripHtmlTags(text) {
    if (!text) return '';
    return text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .trim();
}

/**
 * 광고 및 불필요한 텍스트 패턴 제거
 */
function removeAdsAndNoise(content) {
    // 백엔드에서는 최소한의 정제만 수행
    // 프론트엔드에서 더 정밀하게 정제하므로 여기서는 명백한 광고/스크립트만 제거
    const noisePatterns = [
        /\[기자정보\][\s\S]*?(?=\n|$)/gi,
        /\[기자\][\s\S]*?(?=\n|$)/gi,
        /\(기자\)[\s\S]*?(?=\n|$)/gi,
        /무단.*?전재.*?재배포.*?금지/gi,
        /ⓒ\s*\d{4}\s*[\w\s]+뉴스통신/gi,
        /저작권자[\s\S]*?(?=\n|$)/gi,
        /Copyright[\s\S]*?(?=\n|$)/gi,
        /관련\s*기사/gi,
        /댓글\s*\d*/gi,
        /좋아요\s*\d*/gi,
        /공유하기/gi,
        /페이스북|트위터|카카오톡/gi,
        /프린트/gi,
        /URL\s*복사/gi,
        /이\s*기사를\s*공유합니다/gi,
        /googletag\.cmd\.push/g,
        /window\.\w+/g,
        /document\.\w+/g
    ];

    let cleaned = content;
    noisePatterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, "");
    });

    return cleaned.replace(/\s+/g, " ").trim();
}

/**
 * 네이버 본문 스크래핑 결과와 description 중 더 안정적인 텍스트를 선택
 * ✅ 중요: 스크래핑이 충분히 되었으면 항상 스크래핑 본문을 우선 사용
 */
function chooseBestText(naverBodyText, descriptionText) {
    const body = removeAdsAndNoise(stripHtmlTags(naverBodyText || '')).trim();
    const desc = stripHtmlTags(descriptionText || '').replace(/\s+/g, ' ').trim();

    if (!body && !desc) {
        return { text: '', usedDescription: false, notice: '' };
    }

    // ✅ 스크래핑된 본문이 충분히 길면 무조건 본문 사용
    if (body && body.length >= 500) {
        return { text: body, usedDescription: false, notice: '' };
    }

    // 본문이 없거나 매우 짧으면 description 사용
    if (!body || body.length < 200) {
        if (desc && desc.length > body.length) {
            return {
                text: desc,
                usedDescription: true,
                notice: '⚠️ 본문 스크래핑이 불충분하여 요약(description)을 사용했습니다.'
            };
        }
        // description도 별로 도움이 안 되면 본문 반환
        return { text: body || desc, usedDescription: !body, notice: '' };
    }

    // 200~500자 사이: 본문을 사용하되 description이 훨씬 길면 고려
    if (desc && desc.length > body.length * 1.5) {
        return {
            text: desc,
            usedDescription: true,
            notice: '⚠️ 본문이 요약(description)보다 훨씬 짧아 요약을 사용했습니다.'
        };
    }

    // 그 외는 본문 사용
    return { text: body, usedDescription: false, notice: '' };
}

/**
 * 네이버 뉴스 전용 본문 추출 함수
 * 네이버 뉴스의 HTML 구조에 맞게 본문 추출
 */
function extractNaverNewsBody($) {
    try {
        let content = "";
        
        // 1. 신형 네이버 뉴스 구조 (#articleBodyContents)
        content = $("#articleBodyContents").text() || "";
        
        // 2. 구형 네이버 뉴스 구조 (div.article_body)
        if (!content || content.trim().length < 100) {
            content = $("div.article_body").text() || "";
        }
        
        // 3. 더 신형 뉴스 구조 (section)
        if (!content || content.trim().length < 100) {
            content = $("section.na_article_content").text() || 
                      $("section.newsct_article").text() || "";
        }
        
        // 4. 일반 article 태그
        if (!content || content.trim().length < 100) {
            content = $("article").text() || "";
        }
        
        // 5. 광고/관련기사 제거
        if (content) {
            // 일반적인 제거 패턴
            content = content.replace(/[\n\r]\s*\[기자정보\][\s\S]*$/i, '');
            content = content.replace(/[\n\r]\s*무단.*?전재[\s\S]*$/i, '');
            content = content.replace(/[\n\r]\s*저작권[\s\S]*$/i, '');
            content = content.replace(/[\n\r]\s*Copyright[\s\S]*$/i, '');
            content = content.replace(/[\n\r]\s*관련기사[\s\S]*$/i, '');
        }
        
        return content ? content.replace(/\s+/g, " ").trim() : "";
    } catch (e) {
        console.error("네이버 본문 추출 중 오류:", e.message);
        return "";
    }
}

/**
 * 대표 이미지 URL 추출
 */
function extractRepresentativeImage($) {
    try {
        // 1. 메타 데이터 확인 (가장 정확)
        let img = $('meta[property="og:image"]').attr('content') || 
                  $('meta[name="twitter:image"]').attr('content');

        // 2. 메타 데이터가 없다면 본문 주요 이미지 ID/클래스 확인
        if (!img) {
            img = $('#img1').attr('src') || 
                  $('.end_photo_org img').attr('src') || 
                  $('#articleBodyContents img').first().attr('src') ||
                  $('.newsct_article img').first().attr('src');
        }

        const v = String(img || '').trim();
        if (v) {
            // //주소로 시작할 경우 https: 붙여주기
            return v.startsWith('//') ? 'https:' + v : v;
        }
        return '';
    } catch (e) {
        return '';
    }
}

/**
 * 네이버 뉴스 전용 본문 추출 함수
 */
function extractRepresentativeImage($) {
    try {
        // 1. 메타 데이터 (og:image) - 가장 표준적이고 정확함
        let img = $('meta[property="og:image"]').attr('content') || 
                  $('meta[name="twitter:image"]').attr('content');

        // 2. 메타 데이터가 없을 경우 실물 이미지 태그 확인
        if (!img) {
            img = $('#img1').attr('src') || // 네이버 본문 주요 이미지 ID
                  $('.end_photo_org img').attr('src') || // 포토 뉴스 클래스
                  $('#articleBodyContents img').first().attr('src') || // 구형 본문 태그
                  $('.newsct_article img').first().attr('src'); // 신형 본문 태그
        }

        if (img) {
            // 주소가 //로 시작하는 상대 경로일 경우 https: 추가
            const finalUrl = img.startsWith('//') ? 'https:' + img : img;
            
            // 네이버 이미지 서버(pstatic) 주소라면 정상적으로 리턴
            if (finalUrl.includes('pstatic.net') || finalUrl.startsWith('http')) {
                return finalUrl;
            }
        }
        return '';
    } catch (e) {
        console.error("이미지 추출 중 오류:", e.message);
        return '';
    }
}

/**
 * URL에서 기사 본문 추출 시도
 */
async function attemptScrape(url) {
    try {
        const response = await axios.get(url, {
            timeout: 5000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        });

        const $ = cheerio.load(response.data);
        let content = "";
        const imageUrl = extractRepresentativeImage($);

        if (url.includes("news.naver.com")) {
            content = extractNaverNewsBody($);
            
            if (!content || content.length < 100) {
                $("script, style, iframe, noscript").remove();
                content = $("#articleBodyContents").text() || $("article").text();
                content = content.replace(/\s+/g, " ").trim();
            }
            
            if (content.length >= 500) {
                return { content, imageUrl };
            }
        } else if (url.includes("news.chosun.com") || url.includes("joins.com")) {
            $("script, style, iframe, .ad, .advertisement").remove();
            content = $("div.article_body").text() || $("article").text() || $("div[id*='content']").text();
        } else if (url.includes("hani.co.kr") || url.includes("khan.co.kr")) {
            $("script, style, iframe, .ad-area, .relation-box").remove();
            content = $("div.article-body").text() || $("article").text() || $("div.article_txt").text();
        } else if (url.includes("donga.com")) {
            $("script, style, iframe, .ad_google").remove();
            content = $("div.article_txt").text() || $("div.article-body").text() || $("article").text();
        } else {
            $("script, style, iframe, noscript, .ad, .advertisement, .comment").remove();
            
            const candidates = [
                $("article").text(),
                $("div.article-body").text(),
                $("div[class*='content']").text(),
                $("div[class*='article']").text(),
                $("main").text()
            ];

            for (const candidate of candidates) {
                if (candidate && candidate.trim().length > 100) {
                    content = candidate.trim();
                    break;
                }
            }
        }

        content = stripHtmlTags(content);
        content = content.replace(/\s+/g, " ").trim();

        return { content, imageUrl };
    } catch (error) {
        console.error(`⚠️ 스크래핑 실패 (${url.substring(0, 50)}...): ${error.message}`);
        return { content: "", imageUrl: "" };
    }
}

/**
 * 개별 뉴스 링크에서 기사 전문을 스크래핑
 */
async function scrapeArticleContent(url) {
    const { content, imageUrl } = await attemptScrape(url);
    return {
        content: removeAdsAndNoise(content),
        imageUrl: imageUrl || ''
    };
}

// ============================================================
// Main Controller Function
// ============================================================

const getNews = async (req, res) => {
    // --- Keyword Lists ---
    const PROGRESSIVE_SEEDS = [
        '민주당', '진보', '개혁', '평등', '복지', '노동', '환경', '인권',
        '여성', '소수자', '참여', '민주주의', '분배', '정의', '공정'
    ];
    const CONSERVATIVE_SEEDS = [
        '국민의힘', '보수', '안보', '자유', '시장', '경제', '성장', '질서',
        '전통', '국가', '법치', '책임', '효율', '경쟁', '개인'
    ];

    // --- API Configuration Check ---
    if (!naverConfig.clientID || !naverConfig.clientSecret) {
        console.error("오류: Naver API Client ID 또는 Secret이 설정되지 않았습니다.");
        return res.status(500).json({ 
            error: 'API 설정 오류: 백엔드 환경 설정 파일(newsApiConfig)을 확인해 주세요.' 
        });
    }

    // --- Query Parameters ---
    const { categories: categoriesQuery, filter } = req.query;
    const { display = 10, page = 1 } = req.query;
    const categories = categoriesQuery 
        ? categoriesQuery.split(',').map(c => c.trim()).filter(c => c) 
        : ['정치'];

    if (categories.length === 0) {
        return res.status(400).json({ error: '유효한 검색 카테고리가 제공되지 않았습니다.' });
    }

    // --- 파일 캐시 확인 (10분 유효) ---
    const blueFile = path.join(__dirname, '..', '..', 'front', 'public', 'blue_news_set.json');
    const redFile = path.join(__dirname, '..', '..', 'front', 'public', 'red_news_set.json');
    const CACHE_DURATION = 10 * 60 * 1000; // 10분

    try {
        // 파일 존재 및 수정 시간 확인
        const blueStats = await fs.promises.stat(blueFile).catch(() => null);
        const redStats = await fs.promises.stat(redFile).catch(() => null);
        
        if (blueStats && redStats) {
            const now = Date.now();
            const blueAge = now - blueStats.mtimeMs;
            const redAge = now - redStats.mtimeMs;
            
            // 파일이 10분 이내로 생성되었으면 캐시 사용
            if (blueAge < CACHE_DURATION && redAge < CACHE_DURATION) {
                console.log(`📦 캐시된 파일 사용 (생성된 지 ${Math.floor(blueAge / 1000)}초)`);
                
                const blueNews = JSON.parse(await fs.promises.readFile(blueFile, 'utf-8'));
                const redNews = JSON.parse(await fs.promises.readFile(redFile, 'utf-8'));
                
                if (filter === 'progressive') {
                    return res.json(blueNews);
                } else if (filter === 'conservative') {
                    return res.json(redNews);
                } else {
                    return res.json([...blueNews, ...redNews].sort((a, b) => 
                        new Date(b.pubDate) - new Date(a.pubDate)
                    ));
                }
            } else {
                console.log(`🔄 캐시 만료 (${Math.floor(blueAge / 1000)}초 경과), 새로운 뉴스 수집 시작`);
            }
        }
    } catch (cacheError) {
        console.log('⚠️ 캐시 확인 중 오류, 새로운 뉴스 수집:', cacheError.message);
    }

    const apiHeaders = {
        'X-Naver-Client-Id': naverConfig.clientID,
        'X-Naver-Client-Secret': naverConfig.clientSecret,
    };

    let enrichedArticles = [];

    try {
        console.log(`🔍 뉴스 수집 시작: categories=[${categories.join(', ')}], filter=${filter || 'none'}`);

        // --- Step 1: Fetch news from Naver API ---
        for (const category of categories) {
            const start = (parseInt(page, 10) - 1) * parseInt(display, 10) + 1;
            const naverApiUrl = `${naverConfig.newsSearchUrl}?query=${encodeURIComponent(category)}&display=${display}&sort=date&start=${start}`;
            
            try {
                const response = await axios.get(naverApiUrl, { headers: apiHeaders });
                
                if (response.data.items.length === 0) {
                    console.log(`⚠️ 카테고리 '${category}'에 대한 뉴스가 없습니다.`);
                    continue;
                }

                console.log(`📌 카테고리 '${category}': ${response.data.items.length}개 수집`);

                // --- Step 2: Scrape full content for each article ---
                for (let i = 0; i < response.data.items.length; i++) {
                    const article = response.data.items[i];
                    
                    // ✅ 네이버 뉴스 링크(article.link)를 최우선으로 사용
                    // 정형화된 네이버 뉴스 틀에서 본문 스크래핑이 더 안정적
                    const naverLink = article.link;

                    // 기사 본문 스크래핑 (네이버 뉴스 링크 사용)
                    const scraped = await scrapeArticleContent(naverLink);
                    const pick = chooseBestText(scraped.content, article.description);
                    const fullText = pick.text;

                    if (pick.usedDescription) {
                        console.log(`   ℹ️ [${i + 1}/${response.data.items.length}] ${pick.notice}`);
                    }

                    // 스크래핑 결과와 메타데이터 병합
                    enrichedArticles.push({
                        category: category,
                        title: stripHtmlTags(article.title),
                        description: stripHtmlTags(article.description),
                        full_text: fullText || stripHtmlTags(article.description),
                        link: article.link,  // ✅ 네이버 뉴스 링크 (최우선)
                        originallink: article.originallink || article.link,  // 참고용 원본 링크
                        pubDate: article.pubDate,
                        imageUrl: scraped.imageUrl || '',
                        image_url: scraped.imageUrl || '',
                        source: 'naver_api_scraped',
                        used_description_fallback: Boolean(pick.usedDescription)
                    });

                    // API 요청 제한 회피
                    if ((i + 1) % 5 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }

            } catch (error) {
                console.error(`❌ Error fetching news for category ${category}:`, error.message);
                if (error.response) {
                    console.error('API Error Response Data:', error.response.data);
                }
            }

            // 카테고리 간 딜레이
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`✅ 총 ${enrichedArticles.length}개 기사 수집 및 스크래핑 완료`);

        // --- Step 3: Apply filtering (if requested) ---
        if (filter) {
            let filterKeywords;
            if (filter === 'progressive') {
                filterKeywords = PROGRESSIVE_SEEDS;
            } else if (filter === 'conservative') {
                filterKeywords = CONSERVATIVE_SEEDS;
            }

            if (filterKeywords) {
                enrichedArticles = enrichedArticles.filter(news => {
                    const title = (news.title || '').toLowerCase();
                    const description = (news.description || '').toLowerCase();
                    const fullText = (news.full_text || '').toLowerCase();
                    return filterKeywords.some(keyword => 
                        title.includes(keyword) || 
                        description.includes(keyword) || 
                        fullText.includes(keyword)
                    );
                });
                console.log(`🔍 필터 '${filter}' 적용 후: ${enrichedArticles.length}개 기사`);
            }
        }

        // --- Step 4: Sort by date ---
        enrichedArticles.sort((a, b) => {
            if (a.pubDate && b.pubDate) {
                return new Date(b.pubDate) - new Date(a.pubDate);
            }
            return a.pubDate ? -1 : 1;
        });

        // --- Step 5: Save and Classify ---
        if (enrichedArticles.length > 0) {
            try {
                // 임시 파일로 저장
                const tempFile = path.join(__dirname, '..', 'data', 'temp_collected_news.json');
                await fs.promises.writeFile(tempFile, JSON.stringify(enrichedArticles, null, 2), 'utf-8');
                console.log(`📁 임시 파일 저장 완료: ${tempFile}`);

                // 키워드 기반 분류 (즉시 실행)
                const { blueNews, redNews } = classifyNewsByKeywords(enrichedArticles);
                console.log(`✅ 키워드 분류 완료: 진보 ${blueNews.length}개, 보수 ${redNews.length}개`);
                
                // AI 상세 분석 적용 (환경변수로 제어)
                let finalBlueNews = blueNews;
                let finalRedNews = redNews;
                
                const enableAIAnalysis = process.env.ENABLE_AI_ANALYSIS === '1';
                console.log(`🔍 환경변수 확인: ENABLE_AI_ANALYSIS="${process.env.ENABLE_AI_ANALYSIS}", enableAIAnalysis=${enableAIAnalysis}`);
                if (enableAIAnalysis && (blueNews.length > 0 || redNews.length > 0)) {
                    console.log('🤖 AI 상세 분석 시작...');
                    
                    // 진보/보수 기사 각각 분석
                    if (blueNews.length > 0) {
                        finalBlueNews = await batchAnalyzeArticles(blueNews);
                    }
                    if (redNews.length > 0) {
                        finalRedNews = await batchAnalyzeArticles(redNews);
                    }
                    
                    console.log('✅ AI 상세 분석 완료!');
                } else {
                    console.log('ℹ️ AI 분석 비활성화 (ENABLE_AI_ANALYSIS=1로 설정하여 활성화)');
                }
                
                // 파일 저장
                const blueFile = path.join(__dirname, '..', '..', 'front', 'public', 'blue_news_set.json');
                const redFile = path.join(__dirname, '..', '..', 'front', 'public', 'red_news_set.json');
                
                await fs.promises.writeFile(blueFile, JSON.stringify(finalBlueNews, null, 2), 'utf-8');
                await fs.promises.writeFile(redFile, JSON.stringify(finalRedNews, null, 2), 'utf-8');
                
                console.log(`📁 최종 파일 저장 완료`);
                console.log(`   📘 진보: ${finalBlueNews.length}개 → ${blueFile}`);
                console.log(`   📕 보수: ${finalRedNews.length}개 → ${redFile}`);

                // 기존 분류 파일 응답
                if (filter === 'progressive') {
                    return res.json(finalBlueNews);
                } else if (filter === 'conservative') {
                    return res.json(finalRedNews);
                } else {
                    return res.json([...finalBlueNews, ...finalRedNews].sort((a, b) => 
                        new Date(b.pubDate) - new Date(a.pubDate)
                    ));
                }
            } catch (saveError) {
                console.error('⚠️ 파일 저장/로드 실패:', saveError.message);
            }
        }

        // --- Step 6: Send response (fallback) ---
        res.json(enrichedArticles);

    } catch (error) {
        console.error('❌ API 호출 또는 스크래핑 실패:', error.message);
        if (error.response) {
            console.error('API Error Response:', error.response.data);
            return res.status(error.response.status).json({ 
                error: '네이버 API 호출 오류', 
                details: error.response.data 
            });
        }
        res.status(500).json({ error: '뉴스 데이터를 가져오는 데 실패했습니다. 서버 로그를 확인하세요.' });
    }
};

/**
 * 키워드 기반 뉴스 분류 (폴백 방식)
 */
function classifyNewsByKeywords(articles) {
    const PROGRESSIVE_SEEDS = [
        '민주당', '진보', '개혁', '평등', '복지', '노동', '환경', '인권',
        '여성', '소수자', '참여', '민주주의', '분배', '정의', '공정', '이재명'
    ];
    const CONSERVATIVE_SEEDS = [
        '국민의힘', '보수', '안보', '자유', '시장', '경제', '성장', '질서',
        '전통', '국가', '법치', '책임', '효율', '경쟁', '개인', '윤석열', '한동훈'
    ];

    const blueNews = [];
    const redNews = [];

    for (const article of articles) {
        const text = `${article.title} ${article.description} ${article.full_text || ''}`.toLowerCase();
        
        let progressiveScore = 0;
        let conservativeScore = 0;

        PROGRESSIVE_SEEDS.forEach(keyword => {
            if (text.includes(keyword)) progressiveScore++;
        });

        CONSERVATIVE_SEEDS.forEach(keyword => {
            if (text.includes(keyword)) conservativeScore++;
        });

        // 점수가 높은 쪽으로 분류 (동점이면 중립으로 처리하여 양쪽에 추가)
        if (progressiveScore > conservativeScore) {
            blueNews.push(article);
        } else if (conservativeScore > progressiveScore) {
            redNews.push(article);
        } else if (progressiveScore > 0 || conservativeScore > 0) {
            // 동점이면 양쪽에 모두 추가
            blueNews.push(article);
            redNews.push(article);
        }
    }

    return { blueNews, redNews };
}

/**
 * GPT API를 이용하여 뉴스를 진보/보수로 분류 (선택적 사용)
 */
async function classifyNewsWithGPT(inputFile) {
    return new Promise((resolve, reject) => {
        const pythonScript = path.join(__dirname, '..', 'data', 'Algoriverse_news_gpt.py');
        const outputFile = path.join(__dirname, '..', 'data', 'analyzed_articles.json');

        console.log('🤖 GPT 분류 시작...');

        // 가상환경의 Python 사용
        const pythonCommand = process.platform === 'win32' 
            ? path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe')
            : path.join(__dirname, '..', '..', '.venv', 'bin', 'python3');

        // Python 스크립트 실행
        const pythonProcess = spawn(pythonCommand, [
            pythonScript,
            '--mode', 'batch',
            '--input', inputFile,
            '--output', outputFile
        ]);

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            stderrData += msg;
            console.log(msg.trim()); // 실시간 로그 출력
        });

        pythonProcess.on('close', async (code) => {
            if (code !== 0) {
                console.error(`❌ Python 스크립트 종료 코드: ${code}`);
                console.error('stderr:', stderrData);
                return reject(new Error(`Python script failed with code ${code}`));
            }

            try {
                // 분류 결과 읽기
                const analyzedData = JSON.parse(await fs.promises.readFile(outputFile, 'utf-8'));
                
                // 진보/보수로 분리
                const blueNews = analyzedData.filter(article => article.bias_label === 'progressive');
                const redNews = analyzedData.filter(article => article.bias_label === 'conservative');
                
                // 프론트엔드 public 폴더에 저장
                const blueFile = path.join(__dirname, '..', '..', 'front', 'public', 'blue_news_set.json');
                const redFile = path.join(__dirname, '..', '..', 'front', 'public', 'red_news_set.json');
                
                await fs.promises.writeFile(blueFile, JSON.stringify(blueNews, null, 2), 'utf-8');
                await fs.promises.writeFile(redFile, JSON.stringify(redNews, null, 2), 'utf-8');
                
                console.log(`✅ GPT 분류 완료!`);
                console.log(`   📘 진보: ${blueNews.length}개 → ${blueFile}`);
                console.log(`   📕 보수: ${redNews.length}개 → ${redFile}`);
                
                resolve({ blue: blueNews.length, red: redNews.length });
            } catch (err) {
                console.error('❌ 분류 결과 처리 실패:', err);
                reject(err);
            }
        });

        pythonProcess.on('error', (err) => {
            console.error('❌ Python 프로세스 실행 실패:', err);
            reject(err);
        });
    });
}

/**
 * OpenAI GPT를 사용하여 개별 기사를 상세 분석
 * @param {Object} article - 분석할 기사 객체
 * @returns {Object} - { rationale, evidence_phrases, ideology_score }
 */
async function analyzeArticleWithGPT(article) {
    try {
        const apiKey = process.env.SITEAI_API_KEY;
        if (!apiKey) {
            console.warn('⚠️ SITEAI_API_KEY가 없어 AI 분석을 건너뜁니다.');
            return { rationale: '', evidence_phrases: [], ideology_score: 0 };
        }

        const openai = new OpenAI({ apiKey });

        const systemPrompt = `당신은 한국 정치 뉴스의 이념 성향을 분석하는 전문가입니다.
주어진 기사를 분석하고 다음 정보를 JSON 형식으로 제공하세요:

{
  "rationale": "기사가 진보/보수 성향인 이유를 2-3문장으로 설명",
  "evidence_phrases": ["근거가 되는 핵심 표현 1", "핵심 표현 2", "핵심 표현 3"],
  "ideology_score": -1.0에서 1.0 사이의 점수 (-1.0: 강한 진보, 0: 중립, 1.0: 강한 보수)
}

**분석 기준**:
- 제목과 본문에서 사용된 용어와 프레임
- 인용된 발언의 비중과 선택
- 사건을 서술하는 관점과 강조점
- 정치인/정당에 대한 묘사 방식`;

        const userPrompt = `다음 기사를 분석해주세요:

제목: ${article.title}
본문: ${article.full_text || article.description || ''}

위 JSON 형식으로만 답변해주세요.`;

        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.2,
            max_tokens: 500
        });

        const response = completion.choices[0].message.content;
        
        // JSON 추출 (```json ... ``` 포맷 처리)
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const jsonText = jsonMatch[1] || jsonMatch[0];
            const analysis = JSON.parse(jsonText);
            return {
                rationale: analysis.rationale || '',
                evidence_phrases: analysis.evidence_phrases || [],
                ideology_score: analysis.ideology_score || 0
            };
        }

        return { rationale: '', evidence_phrases: [], ideology_score: 0 };
    } catch (error) {
        console.error(`⚠️ GPT 분석 실패 (${article.title}):`, error.message);
        return { rationale: '', evidence_phrases: [], ideology_score: 0 };
    }
}

/**
 * 배치로 여러 기사를 AI 분석 (rate limit 고려)
 * @param {Array} articles - 분석할 기사 배열
 * @returns {Array} - AI 분석 결과가 추가된 기사 배열
 */
async function batchAnalyzeArticles(articles) {
    console.log(`🤖 ${articles.length}개 기사에 대한 AI 상세 분석 시작...`);
    
    const analyzedArticles = [];
    const batchSize = 5; // 한 번에 5개씩 처리
    const delayBetweenBatches = 2000; // 2초 대기

    for (let i = 0; i < articles.length; i += batchSize) {
        const batch = articles.slice(i, i + batchSize);
        
        console.log(`   배치 ${Math.floor(i / batchSize) + 1}/${Math.ceil(articles.length / batchSize)} 처리 중...`);
        
        const batchResults = await Promise.all(
            batch.map(async (article) => {
                const analysis = await analyzeArticleWithGPT(article);
                return {
                    ...article,
                    gpt_analysis: {
                        rationale: analysis.rationale,
                        evidence_phrases: analysis.evidence_phrases,
                        ideology_score: analysis.ideology_score,
                        analyzed_at: new Date().toISOString()
                    }
                };
            })
        );

        analyzedArticles.push(...batchResults);

        // Rate limit 회피를 위한 딜레이
        if (i + batchSize < articles.length) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
    }

    console.log(`✅ AI 상세 분석 완료: ${analyzedArticles.length}개 기사`);
    return analyzedArticles;
}

/**
 * 'data' 폴더에 저장된 분석 완료된 뉴스 데이터를 읽어오는 컨트롤러
 * 로드된 데이터에 이미지 URL이 없는 경우, 즉석에서 스크래핑하여 추가합니다.
 */
const getAnalyzedNews = async (req, res) => {
    const { keyword } = req.params;
    if (!keyword) {
        return res.status(400).json({ error: "keyword 파라미터가 필요합니다." });
    }

    const filePrefixes = ['news_data_', 'news_500_', 'frame_set_'];
    let foundFile = false;

    for (const prefix of filePrefixes) {
        const filename = `${prefix}${keyword}.json`;
        const filePath = path.join(__dirname, '..', 'data', filename);

        try {
            await fs.promises.access(filePath); 

            const data = await fs.promises.readFile(filePath, 'utf8');
            try {
                let jsonData = JSON.parse(data);

                // --- Image Enrichment Step ---
                if (Array.isArray(jsonData) && jsonData.length > 0 && !jsonData[0].imageUrl && !jsonData[0].image_url) {
                    console.log(`⚠️ Image URLs not found in ${filePath}. Fetching images on-the-fly...`);
                    
                    jsonData = await Promise.all(jsonData.map(async (item) => {
                        let imageUrl = '';
                        if (item.link && item.link.startsWith('https://n.news.naver.com')) {
                            try {
                                const pageRes = await axios.get(item.link, { timeout: 2500 });
                                const $ = cheerio.load(pageRes.data);
                                imageUrl = $('meta[property="og:image"]').attr('content') || '';
                            } catch (e) {
                                // Ignore error for single article to not fail the whole request
                            }
                        }
                        return {
                            ...item,
                            imageUrl: imageUrl,
                            image_url: imageUrl
                        };
                    }));
                    console.log('✅ Image enrichment complete.');
                }
                
                if (Array.isArray(jsonData)) {
                    jsonData = jsonData.map(item => ({
                        ...item,
                        category: keyword 
                    }));
                }
                
                res.json(jsonData);
                foundFile = true;
                return; 
            } catch (parseErr) {
                console.error(`Error parsing JSON from file [${filePath}]:`, parseErr);
                return res.status(500).json({ error: "데이터 파일의 형식이 올바르지 않습니다." });
            }

        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error(`Error accessing file [${filePath}]:`, err);
                return res.status(500).json({ error: "데이터 파일을 읽는 중 오류가 발생했습니다." });
            }
        }
    }

    if (!foundFile) {
        return res.status(404).json({ 
            error: "분석된 뉴스 데이터를 찾을 수 없습니다.",
            message: `[${keyword}]에 대한 분석 데이터 파일(news_data, news_500, frame_set)이 존재하지 않습니다.`
        });
    }
};

// =============================================
// 추가: 프레임 세트/뉴스 세트 API
// =============================================
const getFrameSet = async (req, res) => {
    const { keyword } = req.params;
    if (!keyword) {
        return res.status(400).json({ error: 'keyword 파라미터가 필요합니다.' });
    }

    try {
        const articles = await loadAnalyzedData(keyword);
        if (!articles.length) {
            return res.status(404).json({ error: '분석된 뉴스 데이터를 찾을 수 없습니다.' });
        }

        const frameSet = await buildFrameSet(articles);
        return res.json(frameSet);
    } catch (err) {
        console.error('프레임 세트 생성 실패:', err.message);
        return res.status(500).json({ error: '프레임 세트 생성 중 오류가 발생했습니다.' });
    }
};

const getNewsSet = async (req, res) => {
    const { keyword } = req.params;
    if (!keyword) {
        return res.status(400).json({ error: 'keyword 파라미터가 필요합니다.' });
    }

    try {
        const articles = await loadAnalyzedData(keyword);
        if (!articles.length) {
            return res.status(404).json({ error: '뉴스 데이터를 찾을 수 없습니다.' });
        }
        return res.json(articles);
    } catch (err) {
        console.error('뉴스 세트 로드 실패:', err.message);
        return res.status(500).json({ error: '뉴스 세트 로드 중 오류가 발생했습니다.' });
    }
};

// 기사 데이터에서 실시간 이슈 클러스터 추출
const extractIssueClusters = async (req, res) => {
    try {
        const { articles, keyword } = req.body;
        
        if (!Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({ error: '기사 데이터가 필요합니다.' });
        }

        // 기사 제목과 본문에서 명사 추출 (빈도 기반)
        const wordFrequency = {};
        const stopWords = new Set(['것', '등', '및', '또', '더', '수', '때', '곳', '중', '등이', '이', '그', '저', '것이', '수가', '일', '년', '월', '일이']);

        articles.forEach(article => {
            const text = `${article.title || ''} ${article.description || ''} ${article.full_text || ''}`;
            // 간단한 한글 단어 추출 (2-4글자)
            const words = text.match(/[가-힣]{2,4}/g) || [];
            
            words.forEach(word => {
                if (!stopWords.has(word)) {
                    wordFrequency[word] = (wordFrequency[word] || 0) + 1;
                }
            });
        });

        // 빈도순 정렬하여 상위 이슈 추출
        const sortedWords = Object.entries(wordFrequency)
            .sort((a, b) => b[1] - a[1])
            .filter(([word, freq]) => freq >= 3) // 최소 3회 이상 언급
            .slice(0, 20); // 상위 20개

        // 클러스터 생성
        const clusters = [
            { 
                key: '전체', 
                label: '전체', 
                keywords: [], 
                count: articles.length,
                articleLinks: articles.map(a => a.link || a.originallink).filter(Boolean)
            }
        ];

        sortedWords.forEach(([word, count]) => {
            const relatedArticles = articles.filter(article => {
                const text = `${article.title || ''} ${article.description || ''} ${article.full_text || ''}`;
                return text.includes(word);
            });

            const articleLinks = relatedArticles.map(a => a.link || a.originallink).filter(Boolean);

            clusters.push({
                key: word,
                label: word,
                keywords: [word],
                count: relatedArticles.length,
                articleLinks
            });
        });

        return res.json({ 
            clusters,
            totalArticles: articles.length,
            extractedAt: new Date().toISOString()
        });

    } catch (err) {
        console.error('이슈 클러스터 추출 실패:', err.message);
        return res.status(500).json({ error: '이슈 클러스터 추출 중 오류가 발생했습니다.' });
    }
};

module.exports = { getNews, getAnalyzedNews, getFrameSet, getNewsSet, extractIssueClusters };