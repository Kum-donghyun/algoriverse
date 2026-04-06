// 테스트: 저장된 raw.html을 대상으로 신문사별 사설 추출 및 본문 크롤링, 결과를 JSON으로 저장
async function testEditorialPipelineFromRaw(req, res) {
    try {
        const date = req.query.date || new Date().toISOString().slice(0,10);
        const rawPath = path.join(EDITORIAL_DIR, `${date}_raw.html`);
        if (!fs.existsSync(rawPath)) {
            return res.status(404).json({ error: 'raw.html 파일이 없습니다.' });
        }
        const html = fs.readFileSync(rawPath, 'utf-8');
        // 1. 신문사별 사설 목록 추출
        const out = extractEditorialLinksFromHtml(html);
        // 2. 각 사설 링크에서 본문/이미지 크롤링
        for (const press of Object.keys(out)) {
            for (let i = 0; i < out[press].length; i++) {
                const articleUrl = out[press][i].link;
                try {
                    const response = await axios.get(articleUrl, {
                        timeout: 5000,
                        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
                    });
                    const $$ = cheerio.load(response.data);
                    let content = "";
                    content = $$("#articleBodyContents").text() || "";
                    if (!content || content.trim().length < 100) {
                        content = $$("div.article_body").text() || "";
                    }
                    if (!content || content.trim().length < 100) {
                        content = $$("section.na_article_content").text() || $$("section.newsct_article").text() || "";
                    }
                    if (!content || content.trim().length < 100) {
                        content = $$("article").text() || "";
                    }
                    if (content) {
                        content = content.replace(/[\n\r]\s*\[기자정보\][\s\S]*$/i, '');
                        content = content.replace(/[\n\r]\s*무단.*?전재[\s\S]*$/i, '');
                        content = content.replace(/[\n\r]\s*저작권[\s\S]*$/i, '');
                        content = content.replace(/[\n\r]\s*Copyright[\s\S]*$/i, '');
                        content = content.replace(/[\n\r]\s*관련기사[\s\S]*$/i, '');
                    }
                    content = content ? content.replace(/\s+/g, " ").trim() : "";
                    let img = $$("meta[property='og:image']").attr('content') || $$("meta[name='twitter:image']").attr('content');
                    if (!img) {
                        img = $$("#img1").attr('src') || $$(".end_photo_org img").attr('src') || $$("#articleBodyContents img").first().attr('src') || $$(".newsct_article img").first().attr('src');
                    }
                    const imageUrl = img ? (img.startsWith('//') ? 'https:' + img : img) : '';
                    out[press][i].full_text = content;
                    out[press][i].imageUrl = imageUrl;
                } catch (e) {
                    out[press][i].full_text = '';
                    out[press][i].imageUrl = '';
                }
            }
        }
        // 신문사별 최소 2개 이상만 저장
        const filtered = {};
        for (const press of Object.keys(out)) {
            if (out[press].length >= 2) filtered[press] = out[press];
        }
        // 결과 저장
        const filePath = path.join(EDITORIAL_DIR, `${date}_test.json`);
        fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2), 'utf-8');
        return res.json({ ok: true, date, collected: Object.fromEntries(Object.entries(filtered).map(([p, arr]) => [p, arr.length])) });
    } catch (err) {
        console.error('testEditorialPipelineFromRaw error', err.message);
        return res.status(500).json({ error: '파이프라인 테스트 실패' });
    }
}
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const naverConfig = require('../config/newsApiConfig');

const DATA_DIR = path.join(__dirname, '..', 'data');
const EDITORIAL_DIR = path.join(DATA_DIR, 'editorials');
// 11개 주요 신문사 이름과 네이버 오피니언 페이지에서 사용하는 data-office-id 매핑
const MAIN_PRESS_LIST = [
    { name: '조선일보', id: '023' },
    { name: '중앙일보', id: '025' },
    { name: '동아일보', id: '020' },
    { name: '한겨레', id: '028' },
    { name: '경향신문', id: '032' },
    { name: '한국일보', id: '469' },
    { name: '서울신문', id: '081' },
    { name: '서울경제', id: '011' },
    { name: '국민일보', id: '005' },
    { name: '매일경제', id: '009' },
    { name: '한국경제', id: '015' },
];

/**
 * 저장된 네이버 사설 HTML에서 11개 주요 신문사별 사설 목록(제목, 링크) 추출
 * @param {string} html - 네이버 사설 페이지의 raw HTML
 * @returns {Object} { [press]: [{title, link}] }
 */
function extractEditorialLinksFromHtml(html) {
    const $ = cheerio.load(html);
    const result = {};
    const foundPressNames = new Set();
    MAIN_PRESS_LIST.forEach(({ name }) => { result[name] = []; });
    $('.opinion_editorial_item').each((i, el) => {
        let press = $(el).find('.press_name').text().trim();
        // Normalize press name: remove spaces, handle variants
        const normalizedPress = press.replace(/\s+/g, '');
        foundPressNames.add(normalizedPress);
        const title = $(el).find('.description').text().trim();
        const link = $(el).find('a.link').attr('href');
        // Try to match normalized press name
        const pressObj = MAIN_PRESS_LIST.find(p => {
            const target = p.name.replace(/\s+/g, '');
            return normalizedPress.includes(target) || target.includes(normalizedPress);
        });
        if (pressObj && result[pressObj.name].length < 3 && title && link) {
            result[pressObj.name].push({ title, link });
        }
    });
    // For debugging: log all press names found in the HTML (only in dev/test)
    if (process.env.NODE_ENV !== 'production') {
        console.log('[extractEditorialLinksFromHtml] Found press names:', Array.from(foundPressNames));
    }
    return result;
}

function stripHtml(text) {
    if (!text) return '';
    return text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

async function scrapeNaverArticle(url) {
    try {
        const res = await axios.get(url, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(res.data);
        let content = $('#articleBodyContents').text() || $('article#dic_area').text() || $('div.newsct_article').text() || $('div.article_body').text() || '';
        content = content.replace(/\s+/g, ' ').trim();
        return { content, imageUrl: $('meta[property="og:image"]').attr('content') || '' };
    } catch (e) {
        return { content: '', imageUrl: '' };
    }
}

async function fetchEditorialsForDate(req, res) {
    try {
        const date = req.query.date || new Date().toISOString().slice(0,10);
        const filePath = path.join(EDITORIAL_DIR, `${date}.json`);
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            return res.json(data);
        }
        return res.json({});
    } catch (err) {
        console.error('fetchEditorialsForDate error', err.message);
        return res.status(500).json({ error: '사설 목록을 불러오지 못했습니다.' });
    }
}

async function collectEditorials(req, res) {
    try {
        const date = (req.body && req.body.date) || new Date().toISOString().slice(0,10);
        if (!fs.existsSync(EDITORIAL_DIR)) fs.mkdirSync(EDITORIAL_DIR, { recursive: true });
        const out = {};
        for (const { name, id } of MAIN_PRESS_LIST) {
            const url = `https://m.news.naver.com/opinion/editorial?officeId=${id}`;
            try {
                const res = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                        'Referer': 'https://m.news.naver.com/',
                        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                    },
                    timeout: 7000
                });
                const $ = cheerio.load(res.data);
                const articles = [];
                $('.opinion_editorial_item').each((i, el) => {
                    const title = $(el).find('.description').text().trim();
                    const link = $(el).find('a.link').attr('href');
                    if (title && link) {
                        articles.push({ title, link });
                    }
                });
                // 본문/이미지 크롤링
                for (let i = 0; i < articles.length; i++) {
                    const articleUrl = articles[i].link;
                    try {
                        const response = await axios.get(articleUrl, {
                            timeout: 5000,
                            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
                        });
                        const $$ = cheerio.load(response.data);
                        let content = $$('div#articleBodyContents').text() || $$('div.article_body').text() || $$('section.na_article_content').text() || $$('section.newsct_article').text() || $$('article').text() || '';
                        if (content) {
                            content = content.replace(/[\n\r]\s*\[기자정보\][\s\S]*$/i, '');
                            content = content.replace(/[\n\r]\s*무단.*?전재[\s\S]*$/i, '');
                            content = content.replace(/[\n\r]\s*저작권[\s\S]*$/i, '');
                            content = content.replace(/[\n\r]\s*Copyright[\s\S]*$/i, '');
                            content = content.replace(/[\n\r]\s*관련기사[\s\S]*$/i, '');
                        }
                        content = content ? content.replace(/\s+/g, " ").trim() : "";
                        let img = $$('meta[property="og:image"]').attr('content') || $$('meta[name="twitter:image"]').attr('content');
                        if (!img) {
                            img = $$('img#img1').attr('src') || $$('.end_photo_org img').attr('src') || $$('div#articleBodyContents img').first().attr('src') || $$('.newsct_article img').first().attr('src');
                        }
                        const imageUrl = img ? (img.startsWith('//') ? 'https:' + img : img) : '';
                        articles[i].full_text = content;
                        articles[i].imageUrl = imageUrl;
                    } catch (e) {
                        articles[i].full_text = '';
                        articles[i].imageUrl = '';
                    }
                }
                // 2개 이상만 저장
                if (articles.length >= 2) out[name] = articles;
            } catch (e) {
                out[name] = [];
            }
        }
        // save file
        const filePath = path.join(EDITORIAL_DIR, `${date}.json`);
        fs.writeFileSync(filePath, JSON.stringify(out, null, 2), 'utf-8');
        return res.json({ ok: true, date, collected: Object.fromEntries(Object.entries(out).map(([p, arr]) => [p, arr.length])) });
    } catch (err) {
        console.error('collectEditorials error', err.message);
        return res.status(500).json({ error: '사설 수집 실패' });
    }
}

// 간단한 핵심 문장 추출: 문장을 분리한 뒤, TF-ish scoring by keyword overlap
function extractKeySentencesFromText(text, topK=3) {
    if (!text) return [];
    const sentences = text.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
    if (!sentences.length) return [];
    // simple scoring: sentence length + number of nouns (korean 2-5 chars) occurrences
    const nounRe = /[가-힣]{2,5}/g;
    const scores = sentences.map(s => {
        const words = (s.match(nounRe) || []).filter(w => w.length>=2 && w.length<=6);
        return { s, score: s.length * 0.2 + words.length };
    });
    scores.sort((a,b)=>b.score - a.score);
    return scores.slice(0, topK).map(x=>x.s);
}

async function analyzeEditorials(req, res) {
    try {
        const date = req.query.date || new Date().toISOString().slice(0,10);
        const filePath = path.join(EDITORIAL_DIR, `${date}.json`);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: '해당 날짜의 사설이 없습니다.' });
        const data = JSON.parse(fs.readFileSync(filePath,'utf-8'));
        const out = {};
        for (const [press, arr] of Object.entries(data)) {
            out[press] = { editorials: arr || [], key_sentences: [] };
            // combine top sentences per editorial
            const ks = [];
            (arr || []).forEach(ed => {
                const keys = extractKeySentencesFromText(ed.full_text || ed.description || ed.title, 2);
                keys.forEach(k => ks.push(k));
            });
            // dedupe and limit
            out[press].key_sentences = Array.from(new Set(ks)).slice(0,5);
        }
        return res.json(out);
    } catch (err) {
        console.error('analyzeEditorials error', err.message);
        return res.status(500).json({ error: '분석 실패' });
    }
}

/**
 * 오피니언봇: 이슈별 × 신문사별 경향성 분석
 * Python opinionbot.py 를 child_process로 호출
 */
async function runOpinionBot(req, res) {
    const { spawn } = require('child_process');
    try {
        const date = req.query.date || new Date().toISOString().slice(0,10);

        // Python 실행 경로 탐색 (venv 우선)
        const venvPython = path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');
        const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python';
        const scriptPath = path.join(__dirname, '..', 'bias_model', 'opinionbot.py');

        return new Promise((resolve) => {
            const proc = spawn(pythonCmd, [scriptPath, '--date', date], {
                cwd: path.join(__dirname, '..', 'bias_model'),
                env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
            });

            let stdout = '';
            let stderr = '';
            proc.stdout.on('data', (d) => { stdout += d.toString('utf-8'); });
            proc.stderr.on('data', (d) => { stderr += d.toString('utf-8'); });

            proc.on('close', (code) => {
                clearTimeout(timer);
                if (stderr) console.error('[OpinionBot stderr]', stderr);
                if (code !== 0) {
                    console.error('[OpinionBot] exit code', code);
                    res.status(500).json({ error: '오피니언봇 분석 실패', detail: stderr });
                    return resolve();
                }
                try {
                    const result = JSON.parse(stdout);
                    // 결과 캐싱 저장
                    const cachePath = path.join(EDITORIAL_DIR, `${date}_opinionbot.json`);
                    fs.writeFileSync(cachePath, JSON.stringify(result, null, 2), 'utf-8');
                    res.json(result);
                } catch (e) {
                    console.error('[OpinionBot] JSON parse error', e.message, stdout.slice(0, 500));
                    res.status(500).json({ error: '분석 결과 파싱 실패' });
                }
                resolve();
            });

            // 타임아웃 (180초 - Gemini API 호출 포함)
            const timer = setTimeout(() => {
                try { proc.kill(); } catch (e) {}
                if (!res.headersSent) {
                    res.status(504).json({ error: '오피니언봇 분석 시간 초과 (180초)' });
                }
                resolve();
            }, 180000);
        });
    } catch (err) {
        console.error('runOpinionBot error', err.message);
        return res.status(500).json({ error: '오피니언봇 실행 실패' });
    }
}

/**
 * 캐시된 오피니언봇 결과 조회
 */
async function getOpinionBotResult(req, res) {
    try {
        const date = req.query.date || new Date().toISOString().slice(0,10);
        const cachePath = path.join(EDITORIAL_DIR, `${date}_opinionbot.json`);
        if (fs.existsSync(cachePath)) {
            const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
            return res.json(data);
        }
        return res.json(null);
    } catch (err) {
        return res.status(500).json({ error: '결과 조회 실패' });
    }
}

/**
 * 교육 템플릿용 사설 타임라인 로드 (오피니언봇 결과 통합 분석)
 */
async function getEditorialTrendTimeline(req, res) {
    try {
        const files = fs.readdirSync(EDITORIAL_DIR).filter(f => f.endsWith('_opinionbot.json'));
        files.sort();

        const targetPresses = ['조선일보', '중앙일보', '한겨레', '경향신문'];
        // 동적으로 이슈 토픽을 수집
        const allTimelines = {};

        for (const file of files) {
            const filePath = path.join(EDITORIAL_DIR, file);
            const dateStr = file.replace('_opinionbot.json', '').slice(5); 
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            
            if (!data.issues) continue;

            for (const issue of data.issues) {
                const issueName = issue.issue_name || "";
                if (!issueName || !issue.editorials) continue;

                // stance 필드가 있는 사설만 (신형 포맷)
                const validEds = issue.editorials.filter(e => e.stance && targetPresses.includes(e.press));
                if (validEds.length === 0) continue;

                if (!allTimelines[issueName]) allTimelines[issueName] = [];

                const dateEntry = { date: dateStr, 조선일보: null, 중앙일보: null, 한겨레: null, 경향신문: null };

                for (const ed of validEds) {
                    const stance = (ed.stance || '').toLowerCase();
                    let score = 0;
                    if (stance.includes('강력 비판') || stance.includes('강하게 비판')) score = -3;
                    else if (stance.includes('비판') || stance.includes('반대')) score = -2;
                    else if (stance.includes('우려') || stance.includes('신중') || stance.includes('경고')) score = -1;
                    else if (stance.includes('긍정') || stance.includes('찬성') || stance.includes('환영') || stance.includes('옹호')) score = 2;
                    else if (stance.includes('기대') || stance.includes('지지')) score = 1;
                    else if (stance.includes('촉구') || stance.includes('문제 제기')) score = -1;
                    else score = 0;

                    if (dateEntry[ed.press] === null) {
                        dateEntry[ed.press] = score;
                    } else {
                        dateEntry[ed.press] = (dateEntry[ed.press] + score) / 2;
                    }
                }

                allTimelines[issueName].push(dateEntry);
            }
        }

        // 데이터 포인트가 2개 이상인 이슈만 (타임라인으로서 의미 있는 것만)
        const filtered = {};
        for (const [key, entries] of Object.entries(allTimelines)) {
            if (entries.length >= 1) filtered[key] = entries;
        }

        return res.json(filtered);
    } catch (err) {
        console.error('getEditorialTrendTimeline err:', err);
        return res.status(500).json({ error: '사설 타임라인 생성 실패' });
    }
}

module.exports = { fetchEditorialsForDate, collectEditorials, analyzeEditorials, testEditorialPipelineFromRaw, runOpinionBot, getOpinionBotResult, getEditorialTrendTimeline };
