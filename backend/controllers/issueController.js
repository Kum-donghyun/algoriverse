/**
 * issueController.js
 * ─────────────────────────────────────────────
 * 실시간 이슈 추적 및 요약 서비스 컨트롤러
 * - 다중 카테고리 뉴스 수집 (네이버 뉴스 API)
 * - 알고리슈 클러스터링 (한국어 문장 임베딩 + HDBSCAN 기반 ML 클러스터링)
 * - 이슈 요약 카드 생성 (지금 상황? / 주목 포인트?)
 * - 상위 5개 클러스터 프레임 분류 (강조/등가 프레이밍)
 * - 레거시 동시출현 클러스터링 (ML 서비스 불가 시 폴백)
 * ─────────────────────────────────────────────
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const naverConfig = require('../config/newsApiConfig');

// ─── 설정 상수 ───
// 대안 A: 범용 키워드로 뉴스를 수집하되, 이번에는 '관련도(sim)' 기반으로 
// 너무 가벼운 단어(기자, 오늘 등) 대신 주류 뉴스에 집중될 만한 키워드를 사용합니다.
const FETCH_KEYWORDS = ['대통령', '정부', '국회', '미국', '경제', '경찰', '의혹', '전쟁'];
const CACHE_FILE = path.join(__dirname, '..', 'data', 'realtime_issues_cache.json');
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6시간 캐시 (반나절 주기)

// ─── 알고리슈 ML 클러스터링 서비스 ───
const ALGORISSUE_URL = process.env.ALGORISSUE_URL || 'http://localhost:8100';

// ─── 지역 뉴스 필터용 지역명 ───
// const LOCAL_KEYWORDS = new Set([
//     '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
//     '대전', '대구', '광주', '울산', '세종', '인천', '수원', '청주',
//     '전주', '포항', '창원', '목포', '여수', '순천', '안동', '춘천',
//     '원주', '강릉', '속초', '평택', '김해', '진주', '군산', '익산',
//     '경산', '구미', '천안', '아산', '서산', '당진', '논산', '공주',
//     '영주', '영천', '경주', '거제', '통영', '사천', '양산', '밀양',
// ]);

// ─── 전국/국제급 이슈 시그널 키워드 ───
// const MACRO_SIGNALS = new Set([
//     '대통령', '국회', '정부', '총리', '장관', '대법원', '헌법', '탄핵', '선거',
//     '여당', '야당', '민주당', '국민의힘', '조국', '이재명', '한동훈',
//     '코스피', '환율', '금리', '물가', '수출', '무역', '증시', '유가',
//     '미국', '중국', '일본', '러시아', '트럼프', '바이든', '전쟁', '외교',
//     '북한', '미사일', '안보', 'NATO', '유럽', '중동', '이란', '이스라엘',
//     'AI', '반도체', '삼성', '현대', 'SK', 'LG', '카카오', '네이버',
//     '교육', '의료', '범죄', '사고', '재난', '인구', '출산', '고령화',
// ]);

// ═══════════════════════════════════════════════════════════════════
//  뉴스 프레임 분류 시스템 (4차원 15유형, 논문 기반 계층적 멀티라벨)
//
//  차원 구조:
//    ① 기능적 차원   — 정의/해석, 원인, 결과/영향, 대책
//    ② 특정관점 차원  — 사회, 경제, 정책, 도덕성, 책임, 민주합의, 인간적흥미
//    ③ 상태/상황 차원 — 갈등, 위기/위험
//    ④ 전달방식 차원  — 의혹/고발, 단순정보전달
//
//  한국 언론 특성 반영:
//    - 갈등(50.4%), 사회(43.6%), 대책(41.0%) 프레임 비중 높음
//    - 정책·민주합의 프레임이 한국 고유 특징
//    - 가중치: 한국 언론에서 빈번한 프레임에 보정 계수 적용
// ═══════════════════════════════════════════════════════════════════

// ─── 4차원 15유형 프레임 정의 ───
const FRAME_DIMENSIONS = {
    functional: {
        label: '기능적 차원',
        desc: '이슈 흐름 파악',
        types: {
            definition:  { label_kr: '정의/해석', icon: '🔎', color: '#6366f1' },
            cause:       { label_kr: '원인',      icon: '🔗', color: '#8b5cf6' },
            consequence: { label_kr: '결과/영향', icon: '📉', color: '#a78bfa' },
            remedy:      { label_kr: '대책',      icon: '🛠️', color: '#7c3aed' },
        },
    },
    perspective: {
        label: '특정관점 차원',
        desc: '보도 시각',
        types: {
            social:          { label_kr: '사회',       icon: '👥', color: '#10b981' },
            economic:        { label_kr: '경제',       icon: '💰', color: '#059669' },
            policy:          { label_kr: '정책',       icon: '📋', color: '#0d9488' },
            morality:        { label_kr: '도덕성',     icon: '⚖️', color: '#f59e0b' },
            responsibility:  { label_kr: '책임',       icon: '🎯', color: '#d97706' },
            democratic:      { label_kr: '민주합의',   icon: '🤝', color: '#0ea5e9' },
            human_interest:  { label_kr: '인간적흥미', icon: '💬', color: '#ec4899' },
        },
    },
    situation: {
        label: '상태/상황 차원',
        desc: '이슈 분위기',
        types: {
            conflict: { label_kr: '갈등',     icon: '⚔️', color: '#ef4444' },
            crisis:   { label_kr: '위기/위험', icon: '🚨', color: '#dc2626' },
        },
    },
    delivery: {
        label: '전달방식 차원',
        desc: '보도 형식',
        types: {
            accusation: { label_kr: '의혹/고발',   icon: '🔍', color: '#78716c' },
            informative:{ label_kr: '단순정보전달', icon: '📰', color: '#9ca3af' },
        },
    },
};

// ─── 유형별 키워드 사전 (확장) ───
const FRAME_CUES = {
    // ── ① 기능적 차원 ──
    definition:  ['규정', '정의', '해석', '의미', '성격', '본질', '개념', '판단', '평가', '분석', '진단', '기존', '변화', '양상'],
    cause:       ['원인', '배경', '발단', '기인', '근원', '요인', '때문', '비롯', '촉발', '발생', '유발', '근본', '연유'],
    consequence: ['결과', '영향', '파장', '여파', '후폭풍', '타격', '충격', '확산', '파급', '전망', '우려', '예상', '이어질', '미칠'],
    remedy:      ['대책', '해결', '방안', '예방', '개선', '조치', '지원', '제도', '법안', '정책', '마련', '추진', '계획', '발표', '시행', '보완', '복구', '대응'],

    // ── ② 특정관점 차원 ──
    social:          ['시민', '사회', '국민', '주민', '공동체', '여론', '시위', '집회', '청년', '노인', '인구', '소외', '불평등', '복지', '교육', '안전', '환경', '도시'],
    economic:        ['경제', '예산', '세금', '물가', '금리', '고용', '투자', '시장', '성장', '부담', '손실', '수출', '무역', '주가', '증시', '부동산', '환율', '재정', '실업'],
    policy:          ['정책', '법안', '규제', '제도', '입법', '시행령', '조례', '국정', '국회', '의결', '통과', '발의', '공청회', '개정', '행정', '거버넌스', '계획'],
    morality:        ['도덕', '윤리', '정의', '공정', '부패', '비리', '특혜', '명분', '가치', '인권', '양심', '비윤리', '부정', '청렴', '도의'],
    responsibility:  ['책임', '책임론', '사과', '규명', '처벌', '관리', '책무', '감사', '문책', '사퇴', '해임', '탄핵', '진상', '소환', '기소', '추궁'],
    democratic:      ['합의', '협의', '타협', '조정', '대화', '협력', '소통', '토론', '숙의', '참여', '공론', '여야', '초당적', '협상', '중재'],
    human_interest:  ['눈물', '가족', '아이', '사연', '인터뷰', '사망', '부상', '피해자', '유족', '생존', '고통', '감동', '희망', '일상', '현장', '이웃'],

    // ── ③ 상태/상황 차원 ──
    conflict:  ['갈등', '대립', '충돌', '비판', '반발', '논쟁', '맞서', '공격', '설전', '파행', '장외', '공방', '반대', '비난', '극렬', '분열', '대결', '항의'],
    crisis:    ['위기', '위험', '긴급', '재난', '심각', '경보', '비상', '공포', '붕괴', '폭발', '참사', '사고', '파산', '마비', '악화', '최악'],

    // ── ④ 전달방식 차원 ──
    accusation:  ['의혹', '고발', '폭로', '특종', '단독', '제보', '취재', '확인', '입수', '의문', '포착', '드러나', '밝혀', '적발', '의심'],
    informative: ['전했다', '밝혔다', '발표했다', '알려졌다', '보도했다', '말했다', '설명했다', '보고했다', '공개했다', '소식', '일정'],
};

// ─── 한국 언론 특성 가중치 (논문 기반, 빈도 비례 보정) ───
const FRAME_WEIGHTS = {
    definition: 1.0, cause: 1.0, consequence: 1.0, remedy: 1.3,       // 대책 41.0% → 보정
    social: 1.3, economic: 1.0, policy: 1.2, morality: 1.0,           // 사회 43.6%, 정책 한국 특유
    responsibility: 1.0, democratic: 1.2, human_interest: 1.0,        // 민주합의 한국 특유
    conflict: 1.4, crisis: 1.0,                                       // 갈등 50.4%
    accusation: 1.0, informative: 0.7,                                // 단순정보전달 하향 보정
};

// ─── FRAME_LABEL_KR (빠른 참조용) ───
const FRAME_LABEL_KR = {};
for (const dim of Object.values(FRAME_DIMENSIONS)) {
    for (const [key, meta] of Object.entries(dim.types)) {
        FRAME_LABEL_KR[key] = meta.label_kr;
    }
}

// ─── 문장 분리 유틸 ───
function splitSentences(text) {
    if (!text) return [];
    return text.split(/[.!?。？！]\s+|(?<=다)\s+(?=[가-힣])/).filter(s => s.length > 8);
}

// ─── 제목 가중치 (제목에 등장하면 ×2 스코어) ───
const TITLE_BOOST = 2.0;

// ─── 멀티라벨 프레임 분류 (계층적 4차원 → 15유형) ───
function classifyFrames(title, body) {
    const titleText = (title || '').trim();
    const bodyText = (body || '').trim();
    if (!titleText && !bodyText) {
        return { primary: 'informative', dimension: 'delivery', frames: [{ type: 'informative', dimension: 'delivery', label_kr: '단순정보전달', score: 1.0 }] };
    }

    // 1) 유형별 raw score 계산 (키워드 매칭 × 가중치)
    const scores = {};
    for (const [frameType, cues] of Object.entries(FRAME_CUES)) {
        let score = 0;
        for (const cue of cues) {
            // 제목 매칭 — 높은 가중치
            if (titleText.includes(cue)) score += TITLE_BOOST;
            // 본문 매칭 — 등장 횟수 반영 (최대 5회까지)
            const bodyMatches = (bodyText.match(new RegExp(cue, 'g')) || []).length;
            score += Math.min(bodyMatches, 5);
        }
        // 한국 언론 특성 가중치 적용
        score *= (FRAME_WEIGHTS[frameType] || 1.0);
        if (score > 0) scores[frameType] = score;
    }

    // 2) 차원별로 최고 유형 선발 → 이 차원이 활성인지 판단
    const dimBests = {};
    for (const [dimKey, dim] of Object.entries(FRAME_DIMENSIONS)) {
        let best = null, bestScore = 0;
        for (const typeKey of Object.keys(dim.types)) {
            if ((scores[typeKey] || 0) > bestScore) {
                bestScore = scores[typeKey];
                best = typeKey;
            }
        }
        if (best) dimBests[dimKey] = { type: best, score: bestScore };
    }

    // 3) 전체 스코어 합산 → 정규화 → 상위 2~3개 멀티라벨 추출
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
    const normalized = Object.entries(scores)
        .map(([type, raw]) => {
            // 해당 type이 어느 차원인지 찾기
            let dimension = 'delivery';
            for (const [dimKey, dim] of Object.entries(FRAME_DIMENSIONS)) {
                if (dim.types[type]) { dimension = dimKey; break; }
            }
            return { type, dimension, label_kr: FRAME_LABEL_KR[type] || type, score: raw / totalScore, raw };
        })
        .sort((a, b) => b.score - a.score);

    // 상위 N개 (score ≥ 0.08 이거나 최소 1개, 최대 3개)
    const frames = [];
    for (const item of normalized) {
        if (frames.length >= 3) break;
        if (frames.length >= 1 && item.score < 0.08) break;
        frames.push({ type: item.type, dimension: item.dimension, label_kr: item.label_kr, score: Math.round(item.score * 1000) / 1000 });
    }

    // 아무 매칭도 없으면 단순정보전달
    if (frames.length === 0) {
        frames.push({ type: 'informative', dimension: 'delivery', label_kr: '단순정보전달', score: 1.0 });
    }

    return {
        primary: frames[0].type,
        dimension: frames[0].dimension,
        frames,
    };
}

// ─── 프레임별 근거 문장 추출 ───
function extractFrameEvidence(text, frameTypes) {
    const sentences = splitSentences(text);
    const evidence = [];
    for (const ft of frameTypes) {
        const cues = FRAME_CUES[ft] || [];
        for (const s of sentences) {
            const matched = cues.filter(c => s.includes(c));
            if (matched.length > 0) {
                evidence.push({
                    frame: ft,
                    label_kr: FRAME_LABEL_KR[ft] || ft,
                    evidence: s.substring(0, 160),
                    matched_cues: matched.slice(0, 3),
                });
                break; // 유형당 1문장
            }
        }
    }
    return evidence;
}

// ─── 기사 프레임 분석 (통합) ───
function classifyArticleFrame(article) {
    const title = article.title || '';
    const body = article.full_text || article.description || '';
    const result = classifyFrames(title, body);
    const evidenceList = extractFrameEvidence(title + ' ' + body, result.frames.map(f => f.type));
    return {
        frame: result.primary,
        label_kr: FRAME_LABEL_KR[result.primary] || result.primary,
        dimension: result.dimension,
        frames: result.frames,
        evidence: evidenceList,
    };
}

// ─── 불용어 목록 ───
// 주의: 클러스터링에 유용한 단어(의원,대통령,정부 등)는 불용어에 넣지 않는다.
//       대신 시드 키워드 선정 시 별도 블랙리스트로 관리한다.
const STOP_WORDS = new Set([
    // 일반 불용어 (문법·기능어)
    '것', '등', '및', '또', '더', '수', '때', '곳', '중', '등이',
    '이', '그', '저', '것이', '수가', '일', '년', '월', '일이',
    '위해', '대한', '통해', '대해', '관련', '이후', '이번', '지난',
    '올해', '내년', '최근', '현재', '앞서', '이날', '오늘', '내일',
    '한편', '또한', '하지만', '그러나', '따라서', '한다', '됐다',
    '했다', '있다', '없다', '말했다', '밝혔다', '전했다',
    // 뉴스 메타 표현
    '보도', '기자', '뉴스', '속보', '특종', '단독', '종합',
    '대해서', '에서는', '라며', '라고', '했습니다', '입니다',
    '것으로', '것이다', '위한', '때문', '가운데', '하고',
    // 시간·장소 일반어
    '오전', '오후', '전국', '우리',
]);

// ─── 시드 키워드 블랙리스트 ───
// 명사 추출에는 포함되지만, 시드(대표 키워드)로는 너무 범용적인 단어
// const SEED_BLACKLIST = new Set([
//     '정치', '경제', '사회', '문화', '세계', '과학',
//     '국내', '해외', '국제', '글로벌',
//     '상황', '문제', '결과', '의견', '방안', '나라', '사람',
// ]);

// ─── HTML 태그 제거 ───
function stripHtml(text) {
    if (!text) return '';
    return text
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

// ─── 네이버 뉴스 본문 스크래핑 (경량 버전) ───
async function scrapeNaverArticle(url) {
    try {
        const res = await axios.get(url, {
            timeout: 4000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const $ = cheerio.load(res.data);

        // 문단 구분을 위해 br 태그와 p 태그를 공백/줄바꿈으로 변환
        $('br').replaceWith('\n');
        $('p, div').each(function() { $(this).append('\n'); });

        // 본문 추출
        let content = $('#articleBodyContents').text()
            || $('article#dic_area').text()
            || $('div.newsct_article').text()
            || $('div.article_body').text()
            || '';
            
        // 여러 번 겹치는 줄바꿈은 두 번으로, 일반 공백은 하나로 정제
        content = content.replace(/[ \t\r]+/g, ' ')
                         .replace(/\n\s*\n/g, '\n\n')
                         .trim();

        // 이미지 추출
        const imageUrl = $('meta[property="og:image"]').attr('content') || '';

        return { content, imageUrl };
    } catch {
        return { content: '', imageUrl: '' };
    }
}

// ─── 한글 명사 추출 (2~5글자) ───
function extractKoreanNouns(text) {
    if (!text) return [];
    const matches = text.match(/[가-힣]{2,5}/g) || [];
    return matches.filter(w => !STOP_WORDS.has(w));
}

// ─── 날짜 파싱 유틸 ───
function parseDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

// ─── 시간 경과 표시 ───
function getTimeAgo(date) {
    if (!date) return '';
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}일 전`;
}

// ─── 카테고리 자동 분류 ─── (더 이상 카테고리로 나누지 않음)
/*
const CATEGORY_KEYWORDS = {
    '정치': ['국회', '대통령', '정당', '민주당', '국민의힘', '의원', '선거', '정부', '법안', '청문회', '탄핵', '내란'],
    '경제': ['경제', '주가', '코스피', '금리', '물가', '부동산', '투자', '수출', '무역', '기업', '증시', '환율'],
    '사회': ['교육', '범죄', '사고', '복지', '인구', '노동', '환경', '재난', '안전', '의료', '건강'],
    '문화': ['문화', '영화', '드라마', '공연', '예술', '축제', '스포츠', '연예', 'K-POP'],
    '세계': ['미국', '중국', '일본', '유럽', '러시아', '외교', '국제', '트럼프', '바이든', 'NATO'],
    '과학': ['AI', '인공지능', '기술', '반도체', '삼성', 'IT', '우주', '로봇', '과학', '디지털']
};

function classifyCategory(text) {
    const scores = {};
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        scores[cat] = keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
    }
    let best = '기타';
    let bestScore = 0;
    for (const [cat, score] of Object.entries(scores)) {
        if (score > bestScore) {
            bestScore = score;
            best = cat;
        }
    }
    return bestScore > 0 ? best : '기타';
}
*/

// ─── 이슈 요약 생성 (지금 상황 / 주목 포인트) ───
function generateIssueSummary(articles, issueKeyword) {
    if (!articles || articles.length === 0) {
        return { current: '', highlight: '' };
    }

    // 대표 기사 선택: 최신 기사 중 키워드 포함 제목 (generateIssueTitle과 동일 로직)
    const sorted = [...articles].sort((a, b) => {
        const da = parseDate(a.pubDate);
        const db = parseDate(b.pubDate);
        if (!da || !db) return 0;
        return db - da; // 최신순
    });

    let representative = sorted[0];
    for (const article of sorted) {
        const title = stripHtml(article.title);
        if (title.includes(issueKeyword) && title.length <= 60) {
            representative = article;
            break;
        }
    }

    // 지금 상황: 대표 기사의 description 첫 문장
    const descText = stripHtml(representative.description || representative.full_text || '');
    const sentences = descText.split(/[.!?]\s+/).filter(s => s.length > 15);
    const current = sentences.length > 0
        ? sentences[0].trim().substring(0, 150) + (sentences[0].length > 150 ? '...' : '')
        : descText.substring(0, 150);

    // 주목 포인트 - 가장 많이 언급되는 부가 키워드
    const allText = articles.map(a => a.title + ' ' + (a.description || '')).join(' ');
    const nouns = extractKoreanNouns(allText);
    const freq = {};
    nouns.forEach(n => {
        if (n !== issueKeyword) {
            freq[n] = (freq[n] || 0) + 1;
        }
    });
    const topNouns = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w);
    const highlight = topNouns.length > 0
        ? `핵심 키워드: ${topNouns.join(', ')}`
        : '';

    return { current, highlight };
}

// ─── 이슈 타임라인 생성 ───
function buildTimeline(articles) {
    const sorted = [...articles].sort((a, b) => {
        const da = parseDate(a.pubDate);
        const db = parseDate(b.pubDate);
        if (!da || !db) return 0;
        return da - db;
    });

    return sorted.map(a => ({
        time: a.pubDate,
        timeAgo: getTimeAgo(a.pubDate),
        title: stripHtml(a.title),
        link: a.link,
        source: extractSource(a.link),
    }));
}

// ─── 출처 추출 ───
function extractSource(url) {
    if (!url) return '알 수 없음';
    try {
        const hostname = new URL(url).hostname;
        if (hostname.includes('chosun')) return '조선일보';
        if (hostname.includes('joins') || hostname.includes('joongang')) return '중앙일보';
        if (hostname.includes('donga')) return '동아일보';
        if (hostname.includes('hani')) return '한겨레';
        if (hostname.includes('khan')) return '경향신문';
        if (hostname.includes('sbs')) return 'SBS';
        if (hostname.includes('kbs')) return 'KBS';
        if (hostname.includes('mbc')) return 'MBC';
        if (hostname.includes('yna') || hostname.includes('yonhap')) return '연합뉴스';
        if (hostname.includes('mk')) return '매일경제';
        if (hostname.includes('hankyung')) return '한국경제';
        if (hostname.includes('naver')) return '네이버뉴스';
        return hostname.replace('www.', '').replace('.co.kr', '').replace('.com', '');
    } catch {
        return '알 수 없음';
    }
}

// ═══════════════════════════════════════════
//  메인 API: 실시간 이슈 목록 가져오기
// ═══════════════════════════════════════════
const getRealtimeIssues = async (req, res) => {
    try {
        const {
            category = 'all',        // 카테고리 필터 (all, 정치, 경제, 사회 등)
            timeRange = '24h',       // 시간 범위 (1h, 6h, 24h, 3d, 7d)
            limit = 10,              // 이슈 개수 제한
            forceRefresh = 'false'   // 강제 새로고침 여부 (캐시 무시)
        } = req.query;

        // ── 캐시 확인 ──
        try {
            const stats = await fs.promises.stat(CACHE_FILE);
            const isCacheValid = Date.now() - stats.mtimeMs < CACHE_DURATION;
            
            // forceRefresh가 'true'가 아닐 때만 캐시를 반환
            if (forceRefresh !== 'true' && isCacheValid) {
                console.log('📦 실시간 이슈 캐시 사용');
                const cached = JSON.parse(await fs.promises.readFile(CACHE_FILE, 'utf-8'));
                const filtered = applyFilters(cached, category, timeRange, parseInt(limit));
                return res.json(filtered);
            }
        } catch { /* 캐시 없음 - 새로 수집 */ }

        console.log('🔄 실시간 이슈 수집 시작...');

        // ── Step 1: 다중 카테고리에서 뉴스 수집 ──
        const allArticles = await collectNewsFromCategories();
        console.log(`📌 총 ${allArticles.length}개 기사 수집`);

        if (allArticles.length === 0) {
            return res.json({ issues: [], totalArticles: 0, updatedAt: new Date().toISOString() });
        }

        // ── Step 2: 알고리슈 ML 클러스터링 (폴백: 레거시 동시출현) ──
        let clusters;
        try {
            clusters = await clusterWithAlgorissue(allArticles);
            console.log(`🧠 알고리슈 ML 클러스터링: ${clusters.length}개 이슈 클러스터 생성`);
        } catch (mlError) {
            console.warn('⚠️ 알고리슈 ML 서비스 불가, 레거시 클러스터링으로 폴백:', mlError.message);
            clusters = clusterIntoIssues(allArticles);
            console.log(`🏷️ 레거시 클러스터링: ${clusters.length}개 이슈 클러스터 생성`);
        }

        // ── Step 2.5: 대표 기사 이미지 스크래핑 (클러스터당 상위 3개만) ──
        for (const cluster of clusters.slice(0, 15)) {
            for (const art of cluster.articles.slice(0, 3)) {
                if (art.imageUrl) continue;
                try {
                    const scraped = await scrapeNaverArticle(art.link);
                    art.imageUrl = scraped.imageUrl || '';
                    art.image_url = scraped.imageUrl || '';
                    if (scraped.content && scraped.content.length > 200) {
                        art.full_text = scraped.content;
                    }
                } catch { /* 스크래핑 실패 무시 */ }
                await new Promise(r => setTimeout(r, 80));
            }
        }

        // ── Step 2.7: 상위 5개 클러스터 전체 기사 스크래핑 + 프레임 분류 ──
        const frameDataMap = {}; // clusterIndex → { byFrame, articles }
        for (let ci = 0; ci < Math.min(5, clusters.length); ci++) {
            const cluster = clusters[ci];
            // 기사 본문 스크래핑 (아직 full_text가 없는 기사만)
            for (const art of cluster.articles) {
                if (art.full_text && art.full_text.length > 200) continue;
                try {
                    const scraped = await scrapeNaverArticle(art.link);
                    if (scraped.content && scraped.content.length > 100) {
                        art.full_text = scraped.content;
                    }
                    if (!art.imageUrl && scraped.imageUrl) {
                        art.imageUrl = scraped.imageUrl;
                        art.image_url = scraped.imageUrl;
                    }
                } catch { /* 무시 */ }
                await new Promise(r => setTimeout(r, 60));
            }

            // 프레임 분류 (4차원 15유형 멀티라벨)
            const allFrameTypes = [];
            for (const dim of Object.values(FRAME_DIMENSIONS)) {
                for (const typeKey of Object.keys(dim.types)) allFrameTypes.push(typeKey);
            }
            const byFrame = {};
            for (const t of allFrameTypes) byFrame[t] = [];

            // 차원별 집계
            const byDimension = { functional: [], perspective: [], situation: [], delivery: [] };

            const framedArticles = cluster.articles.map(art => {
                const frameInfo = classifyArticleFrame(art);
                const item = {
                    title: stripHtml(art.title),
                    link: art.link,
                    source: extractSource(art.originallink || art.link),
                    pubDate: art.pubDate,
                    imageUrl: art.imageUrl || art.image_url || '',
                    description: stripHtml(art.description || ''),
                    full_text: art.full_text || '',
                    frame: frameInfo.frame,
                    frame_kr: frameInfo.label_kr,
                    dimension: frameInfo.dimension,
                    frames: frameInfo.frames,        // 멀티라벨 top 2~3
                    evidence: frameInfo.evidence,    // 근거 문장
                };
                // primary frame으로 byFrame 분류
                if (byFrame[frameInfo.frame]) {
                    byFrame[frameInfo.frame].push(item);
                }
                // 차원별 분류
                if (byDimension[frameInfo.dimension]) {
                    byDimension[frameInfo.dimension].push(item);
                }
                return item;
            });

            // 차원별 요약 통계
            const dimensionSummary = {};
            for (const [dimKey, dim] of Object.entries(FRAME_DIMENSIONS)) {
                const typeCounts = {};
                for (const typeKey of Object.keys(dim.types)) {
                    if (byFrame[typeKey].length > 0) typeCounts[typeKey] = byFrame[typeKey].length;
                }
                if (Object.keys(typeCounts).length > 0) {
                    dimensionSummary[dimKey] = { label: dim.label, typeCounts };
                }
            }

            frameDataMap[ci] = { byFrame, byDimension, dimensionSummary, articles: framedArticles };
            const topFrames = Object.entries(byFrame).filter(([, v]) => v.length > 0).sort((a, b) => b[1].length - a[1].length).slice(0, 4);
            console.log(`  🎯 클러스터 #${ci + 1} 프레임 분류: ${topFrames.map(([k, v]) => `${FRAME_LABEL_KR[k]}(${v.length})`).join(', ')}`);
        }

        // ── Step 3: 이슈별 요약 및 메타데이터 생성 ──
        const issues = clusters.map((cluster, index) => {
            const summary = generateIssueSummary(cluster.articles, cluster.keyword);
            const timeline = buildTimeline(cluster.articles);
            // 메인화면 카테고리 제거로 인해 '기타' 혹은 빈 배열로 처리
            // const categories = [...new Set(cluster.articles.map(a => a.category || classifyCategory(a.title + ' ' + (a.description || ''))))];
            const categories = [];
            const sources = [...new Set(cluster.articles.map(a => extractSource(a.originallink || a.link)))];

            // 타임라인 커스텀 정렬: 1~3번 오래된 순 3개, 4~5번 최신 기사 2개
            let customTimeline = timeline;
            if (timeline.length >= 5) {
                const oldest3 = timeline.slice(0, 3);
                // 최신순 2개 (가장 최신 기사가 위로 오게 하려면 reverse, 아니면 그대로 slice(-2))
                const newest2 = timeline.slice(-2).reverse(); 
                customTimeline = [...oldest3, ...newest2];
            } else if (timeline.length > 3) {
                // 기사가 4개인 경우
                const oldest3 = timeline.slice(0, 3);
                const newest1 = timeline.slice(-1).reverse();
                customTimeline = [...oldest3, ...newest1];
            }

            // 최신 기사 시간
            const latestDate = cluster.articles.reduce((latest, a) => {
                const d = parseDate(a.pubDate);
                return d && (!latest || d > latest) ? d : latest;
            }, null);

            return {
                id: index + 1,
                rank: index + 1,
                keyword: cluster.keyword,
                title: generateIssueTitle(cluster.keyword, cluster.articles),
                articleCount: cluster.articles.length,
                categories: categories,
                primaryCategory: '전체',
                summary,
                timeline: customTimeline,
                relatedKeywords: cluster.relatedKeywords,
                sources: sources.slice(0, 5),
                latestDate: latestDate?.toISOString() || null,
                timeAgo: getTimeAgo(latestDate),
                // 대표 이미지 (첫 번째 이미지가 있는 기사에서)
                thumbnailUrl: cluster.articles.find(a => a.imageUrl || a.image_url)?.imageUrl
                    || cluster.articles.find(a => a.imageUrl || a.image_url)?.image_url
                    || '',
                // 대표 기사 3개 (미리보기용)
                previewArticles: cluster.articles.slice(0, 3).map(a => ({
                    title: stripHtml(a.title),
                    link: a.link,
                    pubDate: a.pubDate,
                    source: extractSource(a.originallink || a.link),
                    imageUrl: a.imageUrl || a.image_url || ''
                })),
                // 전체 기사 목록 (클러스터 평가용)
                allArticles: cluster.articles.map(a => ({
                    title: stripHtml(a.title),
                    link: a.link,
                    pubDate: a.pubDate,
                    source: extractSource(a.originallink || a.link),
                })),
                // 프레임 분류 데이터 (상위 5개만)
                frameData: frameDataMap[index] || null,
            };
        });

        // ── Step 4: 캐시 저장 ──
        const result = {
            issues,
            totalArticles: allArticles.length,
            updatedAt: new Date().toISOString()
        };

        try {
            await fs.promises.writeFile(CACHE_FILE, JSON.stringify(result, null, 2), 'utf-8');
            console.log('💾 캐시 저장 완료');
        } catch (e) {
            console.error('⚠️ 캐시 저장 실패:', e.message);
        }

        // ── Step 5: 필터링 및 응답 ──
        const filtered = applyFilters(result, category, timeRange, parseInt(limit));
        console.log(`✅ 실시간 이슈 ${filtered.issues.length}개 응답`);
        return res.json(filtered);

    } catch (error) {
        console.error('❌ 실시간 이슈 수집 실패:', error.message);
        return res.status(500).json({ error: '실시간 이슈를 가져오는 데 실패했습니다.' });
    }
};

// ─── 이슈 상세 정보 ───
const getIssueDetail = async (req, res) => {
    try {
        const { keyword } = req.params;
        if (!keyword) {
            return res.status(400).json({ error: 'keyword 파라미터가 필요합니다.' });
        }

        // 캐시에서 이슈 검색
        let issueData = null;
        try {
            const cached = JSON.parse(await fs.promises.readFile(CACHE_FILE, 'utf-8'));
            issueData = cached.issues.find(i => i.keyword === keyword);
        } catch { /* 캐시 없음 */ }

        // 캐시에 없으면 해당 키워드로 직접 수집
        if (!issueData) {
            console.log(`🔍 "${keyword}" 이슈 상세 수집 시작...`);
            const articles = await fetchNaverNews(keyword, 30);

            if (articles.length === 0) {
                return res.status(404).json({ error: '해당 이슈에 대한 기사를 찾을 수 없습니다.' });
            }

            const summary = generateIssueSummary(articles, keyword);
            const timeline = buildTimeline(articles);
            const relatedKeywords = extractRelatedKeywords(articles, keyword);

            // 본문 스크래핑 및 프레임 분류
            const byFrame = {};
            // 전체 유형 초기화
            for (const dim of Object.values(FRAME_DIMENSIONS)) {
                for (const t of Object.keys(dim.types)) {
                    byFrame[t] = [];
                }
            }
            
            const byDimension = { functional: [], perspective: [], situation: [], delivery: [] };
            
            const classifiedArticles = [];
            for (const art of articles) {
                if (!art.full_text || art.full_text.length < 200) {
                    try {
                        const scraped = await scrapeNaverArticle(art.link);
                        if (scraped.content) art.full_text = scraped.content;
                        if (!art.imageUrl && scraped.imageUrl) art.imageUrl = scraped.imageUrl;
                    } catch {}
                    await new Promise(r => setTimeout(r, 60));
                }
                
                const frameInfo = classifyArticleFrame(art);
                const completeArt = {
                    title: stripHtml(art.title),
                    description: stripHtml(art.description),
                    full_text: art.full_text || '',
                    link: art.link,
                    originallink: art.originallink,
                    pubDate: art.pubDate,
                    source: extractSource(art.originallink || art.link),
                    imageUrl: art.imageUrl || art.image_url || '',
                    frame: frameInfo.frame,
                    frame_kr: frameInfo.label_kr,
                    dimension: frameInfo.dimension,
                    frames: frameInfo.frames,
                    evidence: frameInfo.evidence,
                };
                
                if (byFrame[frameInfo.frame]) byFrame[frameInfo.frame].push(completeArt);
                if (byDimension[frameInfo.dimension]) byDimension[frameInfo.dimension].push(completeArt);
                
                classifiedArticles.push(completeArt);
            }
            
            const dimensionSummary = {};
            for (const [dimKey, dim] of Object.entries(FRAME_DIMENSIONS)) {
                const typeCounts = {};
                for (const typeKey of Object.keys(dim.types)) {
                    if (byFrame[typeKey].length > 0) typeCounts[typeKey] = byFrame[typeKey].length;
                }
                if (Object.keys(typeCounts).length > 0) {
                    dimensionSummary[dimKey] = { label: dim.label, typeCounts };
                }
            }

            issueData = {
                keyword,
                title: generateIssueTitle(keyword, classifiedArticles),
                articleCount: classifiedArticles.length,
                summary,
                timeline,
                relatedKeywords,
                sources: [...new Set(classifiedArticles.map(a => a.source))],
                articles: classifiedArticles,
                frameData: { byFrame, byDimension, dimensionSummary, articles: classifiedArticles }
            };
        }

        return res.json(issueData);
    } catch (error) {
        console.error('❌ 이슈 상세 조회 실패:', error.message);
        return res.status(500).json({ error: '이슈 상세 정보를 가져오는 데 실패했습니다.' });
    }
};

// ═══════════════════════════════════════════
//  내부 함수: 뉴스 수집
// ═══════════════════════════════════════════
async function collectNewsFromCategories() {
    if (!naverConfig.clientID || !naverConfig.clientSecret) {
        console.error('❌ Naver API 키가 설정되지 않았습니다.');
        return [];
    }

    const apiHeaders = {
        'X-Naver-Client-Id': naverConfig.clientID,
        'X-Naver-Client-Secret': naverConfig.clientSecret,
    };

    const allArticles = [];
    const seenLinks = new Set();
    const cutoffTime = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12시간 전

    for (const keyword of FETCH_KEYWORDS) {
        // 페이지 3개(start=1, 101, 201)로 최대 300건 수집 (더 넓은 범위의 이슈를 잡기 위함)
        for (const start of [1, 101, 201]) {
            try {
                // sort=sim(관련도순)을 다시 적용하여 네이버 알고리즘이 중요하다고 판단한 기사 우선 수집
                const url = `${naverConfig.newsSearchUrl}?query=${encodeURIComponent(keyword)}&display=100&sort=sim&start=${start}`;
                const response = await axios.get(url, { headers: apiHeaders, timeout: 8000 });
                const items = response.data.items || [];

                if (start === 1) console.log(`  📰 범용 검색 [${keyword}] ${items.length}+ 기사 융단폭격 중...`);

                for (const item of items) {
                    // 중복 제거
                    if (seenLinks.has(item.link)) continue;
                    seenLinks.add(item.link);

                    // 12시간 이내 기사만
                    const pubDate = parseDate(item.pubDate);
                    if (pubDate && pubDate < cutoffTime) continue;

                    const titleText = stripHtml(item.title);
                    const descText = stripHtml(item.description);

                    allArticles.push({
                        // 카테고리는 사용하지 않으므로 '전체'로 임의 매핑
                        // category: classifyCategory(titleText + ' ' + descText),
                        category: '전체',
                        title: titleText,
                        description: descText,
                        full_text: descText,
                        link: item.link,
                        originallink: item.originallink || item.link,
                        pubDate: item.pubDate,
                        imageUrl: '',
                        image_url: '',
                        _source: extractSource(item.originallink || item.link),
                    });
                }
            } catch (error) {
                console.error(`  ⚠️ [${keyword}] 수집 실패:`, error.message);
            }

            // 페이지 간 딜레이
            await new Promise(r => setTimeout(r, 200));
        }
        // 카테고리 간 딜레이
        await new Promise(r => setTimeout(r, 300));
    }

    console.log(`  📌 12시간 이내 기사: ${allArticles.length}건`);
    return allArticles;
}

// ─── 단일 키워드 뉴스 수집 ───
async function fetchNaverNews(keyword, count = 20) {
    if (!naverConfig.clientID || !naverConfig.clientSecret) return [];

    const apiHeaders = {
        'X-Naver-Client-Id': naverConfig.clientID,
        'X-Naver-Client-Secret': naverConfig.clientSecret,
    };

    try {
        const url = `${naverConfig.newsSearchUrl}?query=${encodeURIComponent(keyword)}&display=${count}&sort=sim&start=1`;
        const response = await axios.get(url, { headers: apiHeaders, timeout: 5000 });
        const items = response.data.items || [];

        return items.map(item => ({
            title: stripHtml(item.title),
            description: stripHtml(item.description),
            link: item.link,
            originallink: item.originallink || item.link,
            pubDate: item.pubDate,
        }));
    } catch {
        return [];
    }
}

// ═══════════════════════════════════════════
//  알고리슈 ML 클러스터링 (Python 서비스 호출)
// ═══════════════════════════════════════════

/**
 * 알고리슈 Python ML 서비스에 기사를 전송하여 의미 기반 클러스터링 수행.
 * 서비스가 응답하지 않으면 예외를 던져 레거시 폴백으로 전환.
 */
async function clusterWithAlgorissue(articles) {
    const payload = {
        articles: articles.map(a => ({
            title: a.title || '',
            description: a.description || '',
            full_text: a.full_text || '',
            link: a.link || '',
            originallink: a.originallink || a.link || '',
            pubDate: a.pubDate || '',
            category: a.category || '',
            imageUrl: a.imageUrl || '',
            image_url: a.image_url || '',
            _source: a._source || '',
        }))
    };

    const response = await axios.post(`${ALGORISSUE_URL}/cluster`, payload, {
        timeout: 300000, // 임베딩과 점진적 학습에 시간이 걸릴 수 있으므로 5분으로 증가
        headers: { 'Content-Type': 'application/json' },
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024,
    });

    const data = response.data;
    console.log(`  🧠 알고리슈 응답: ${data.clusters.length}개 클러스터, 노이즈 ${data.noise_articles}건`);

    return data.clusters.map(c => ({
        keyword: c.keyword,
        articles: c.articles,
        relatedKeywords: c.relatedKeywords,
        size: c.size,
    }));
}

// ═══════════════════════════════════════════
//  레거시 클러스터링 (v3 — 동시출현 co-occurrence 기반, 폴백용)
// ═══════════════════════════════════════════

/**
 * 기사 목록에서 이슈 클러스터를 추출한다.
 *
 * 동시출현(co-occurrence) 기반 알고리즘:
 *  1) 각 기사에서 (제목 명사, 본문 명사) 추출
 *  2) 제목 출현 빈도로 시드(seed) 키워드를 추출
 *  3) 시드 키워드별로:
 *     a) 제목에 키워드를 포함하는 기사 = 코어(core) 그룹 (높은 신뢰도)
 *     b) 코어 기사들을 분석하여 동시출현(co-occurrence) 키워드를 추출
 *        → 코어 기사의 40% 이상에서 함께 등장하는 명사들
 *     c) 본문에만 시드가 있는 기사 중, 동시출현 키워드 2개 이상 공유 → 확장(expand)
 *     d) 코어 + 확장 = 최종 클러스터
 *  4) 기사 수 기준 정렬
 */
function clusterIntoIssues(articles) {
    // ── Step 1: 기사별 명사 추출 ──
    const articleData = articles.map((article, idx) => {
        const titleText = article.title || '';
        const bodyText = `${titleText} ${article.description || ''} ${article.full_text || ''}`;
        return {
            idx,
            titleNouns: new Set(extractKoreanNouns(titleText)),
            allNouns: new Set(extractKoreanNouns(bodyText)),
        };
    });

    // ── Step 2: 시드 키워드 추출 (제목 출현 빈도 기준) ──
    //   제목에 자주 등장하는 명사 = 이슈의 핵심 키워드일 가능성 높음
    const titleFreq = {};
    articleData.forEach(({ titleNouns }) => {
        titleNouns.forEach(n => {
            // if (!SEED_BLACKLIST.has(n)) {
            //     titleFreq[n] = (titleFreq[n] || 0) + 1;
            // }
            titleFreq[n] = (titleFreq[n] || 0) + 1;
        });
    });

    const seedKeywords = Object.entries(titleFreq)
        .filter(([, freq]) => freq >= 2)  // 2개 이상 기사 제목에 등장
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30);

    console.log(`  🌱 시드 키워드 ${seedKeywords.length}개:`,
        seedKeywords.slice(0, 10).map(([w, f]) => `${w}(${f})`).join(', '));

    // ── Step 3: 키워드별 클러스터 형성 (동시출현 검증) ──
    const clusters = [];
    const assigned = new Set();

    for (const [keyword] of seedKeywords) {
        // 3-a) 코어(core): 제목에 키워드 포함 + 미할당
        const core = articleData.filter(d =>
            !assigned.has(d.idx) && d.titleNouns.has(keyword)
        );

        if (core.length < 2) continue;

        // 3-b) 동시출현(co-occurrence) 키워드 추출
        //   코어 기사들의 본문에서 시드 키워드와 함께 자주 등장하는 명사
        const coFreq = {};
        core.forEach(d => {
            d.allNouns.forEach(n => {
                if (n !== keyword) {
                    coFreq[n] = (coFreq[n] || 0) + 1;
                }
            });
        });

        // 코어 기사의 40% 이상에서 함께 등장 = 동시출현 키워드
        const minCo = Math.max(2, Math.ceil(core.length * 0.4));
        const coKeywords = new Set(
            Object.entries(coFreq)
                .filter(([, cnt]) => cnt >= minCo)
                .map(([w]) => w)
        );

        // 3-c) 확장(expand): 본문에만 키워드가 있는 기사 중,
        //   동시출현 키워드를 2개 이상 공유하면 같은 이슈로 판단
        const expand = articleData.filter(d => {
            if (assigned.has(d.idx)) return false;
            if (d.titleNouns.has(keyword)) return false; // 코어에서 이미 처리
            if (!d.allNouns.has(keyword)) return false;  // 키워드 미포함
            if (coKeywords.size === 0) return false;     // 동시출현 키워드 없으면 확장 불가
            // 동시출현 키워드 공유 수
            let shared = 0;
            for (const ck of coKeywords) {
                if (d.allNouns.has(ck)) shared++;
                if (shared >= 2) return true;
            }
            return false;
        });

        // 3-d) 코어 + 확장 = 최종 클러스터
        const finalSet = [...core, ...expand];
        if (finalSet.length < 2) continue;

        finalSet.forEach(d => assigned.add(d.idx));
        const clusterArticles = finalSet.map(d => articles[d.idx]);
        const relatedKeywords = extractRelatedKeywords(clusterArticles, keyword);

        console.log(`  📎 클러스터 "${keyword}": 코어 ${core.length} + 확장 ${expand.length} = ${finalSet.length}개 기사` +
            (coKeywords.size > 0 ? ` (동시출현: ${[...coKeywords].slice(0, 5).join(',')})` : ''));

        clusters.push({
            keyword,
            articles: clusterArticles,
            relatedKeywords,
            size: clusterArticles.length,
        });

        if (clusters.length >= 15) break;
    }

    // ── Step 4: 거시적 이슈 필터링 ──
    //   (1) 다매체 보도: 2개 이상 출처가 보도한 클러스터만 통과
    //   (2) 지역 뉴스 제외: 키워드가 지역명 전용이고 거시 시그널이 없으면 제거
    // const macroFiltered = clusters.filter(cluster => {
    //     // 다매체 검증: 서로 다른 출처(언론사) 수
    //     const sources = new Set(
    //         cluster.articles.map(a => a._source || extractSource(a.originallink || a.link))
    //     );
    //     if (sources.size < 2) return false;
    //
    //     // 지역 뉴스 제외: 키워드가 지역명이고, 관련 키워드에도 거시 시그널이 없으면 제거
    //     if (LOCAL_KEYWORDS.has(cluster.keyword)) {
    //         const hasSignal = cluster.relatedKeywords.some(rk => MACRO_SIGNALS.has(rk.word));
    //         if (!hasSignal) return false;
    //     }
    //
    //     return true;
    // });

    // ── Step 5: 기사 수 기준 정렬 ──
    clusters.sort((a, b) => b.size - a.size);
    return clusters;
}

// ─── 관련 키워드 추출 ───
function extractRelatedKeywords(articles, mainKeyword) {
    const freq = {};
    articles.forEach(a => {
        const text = `${a.title} ${a.description || ''}`;
        const nouns = extractKoreanNouns(text);
        nouns.forEach(n => {
            if (n !== mainKeyword) {
                freq[n] = (freq[n] || 0) + 1;
            }
        });
    });

    return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([word, count]) => ({ word, count }));
}

// ─── 이슈 제목 생성 ───
function generateIssueTitle(keyword, articles) {
    if (!articles || articles.length === 0) return keyword;

    // 가장 최신 기사 제목에서 키워드 포함 제목 선택
    const sorted = [...articles].sort((a, b) => {
        const da = parseDate(a.pubDate);
        const db = parseDate(b.pubDate);
        if (!da || !db) return 0;
        return db - da;
    });

    // 제목에 키워드가 포함된 기사 중 가장 대표적인 것
    for (const article of sorted) {
        const title = stripHtml(article.title);
        if (title.includes(keyword) && title.length <= 60) {
            return title;
        }
    }

    // 찾지 못한 경우 첫 번째 기사 제목 사용
    const firstTitle = stripHtml(sorted[0].title);
    return firstTitle.length > 60 ? firstTitle.substring(0, 57) + '...' : firstTitle;
}

// ─── 필터 적용 ───
function applyFilters(data, category, timeRange, limit) {
    let filteredIssues = [...(data.issues || [])];

    // 카테고리 필터 (더 이상 사용하지 않으므로 무시)
    /*
    if (category && category !== 'all') {
        filteredIssues = filteredIssues.filter(issue =>
            issue.categories.includes(category) || issue.primaryCategory === category
        );
    }
    */

    // 시간 범위 필터 (메인화면에서 기간 버튼 삭제하므로 필터 로직도 주석 처리)
    /*
    if (timeRange) {
        const now = new Date();
        let cutoff;
        switch (timeRange) {
            case '1h':  cutoff = new Date(now - 60 * 60 * 1000); break;
            case '6h':  cutoff = new Date(now - 6 * 60 * 60 * 1000); break;
            case '24h': cutoff = new Date(now - 24 * 60 * 60 * 1000); break;
            case '3d':  cutoff = new Date(now - 3 * 24 * 60 * 60 * 1000); break;
            case '7d':  cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000); break;
            default:    cutoff = new Date(now - 24 * 60 * 60 * 1000);
        }
        filteredIssues = filteredIssues.filter(issue => {
            const d = parseDate(issue.latestDate);
            return d && d >= cutoff;
        });
    }
    */

    // 개수 제한
    if (limit && limit > 0) {
        filteredIssues = filteredIssues.slice(0, limit);
    }

    return {
        issues: filteredIssues,
        totalArticles: data.totalArticles,
        updatedAt: data.updatedAt,
        filters: { category, timeRange, limit }
    };
}

// ═══════════════════════════════════════════
//  트렌딩 키워드 (워드클라우드/보조 시각화용)
// ═══════════════════════════════════════════
const getTrendingKeywords = async (req, res) => {
    try {
        // 캐시 데이터에서 키워드 빈도 추출
        let articles = [];
        try {
            const cached = JSON.parse(await fs.promises.readFile(CACHE_FILE, 'utf-8'));
            // 이슈별 기사들의 모든 키워드를 합산
            articles = cached.issues.flatMap(issue => 
                issue.previewArticles || []
            );
        } catch {
            // 캐시 없으면 간단히 뉴스 수집
            articles = await fetchNaverNews('정치', 30);
        }

        // 전체 텍스트 합치기
        const allText = articles.map(a => `${a.title || ''} ${a.description || ''}`).join(' ');
        const nouns = extractKoreanNouns(allText);
        const freq = {};
        nouns.forEach(n => { freq[n] = (freq[n] || 0) + 1; });

        const keywords = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .map(([text, value]) => ({ text, value }));

        return res.json({ keywords, updatedAt: new Date().toISOString() });
    } catch (error) {
        console.error('❌ 트렌딩 키워드 추출 실패:', error.message);
        return res.status(500).json({ error: '트렌딩 키워드를 가져오는 데 실패했습니다.' });
    }
};

module.exports = {
    getRealtimeIssues,
    getIssueDetail,
    getTrendingKeywords
};
