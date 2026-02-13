const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio'); 
const { spawn } = require('child_process');
const naverConfig = require('../config/newsApiConfig');

// HTML 태그 제거 및 특수문자 변환 함수
const cleanHtmlText = (rawText) => {
    if (!rawText || typeof rawText !== 'string') return '';
    return rawText
        .replace(/<b>/g, '')          // <b> 제거
        .replace(/<\/b>/g, '')         // </b> 제거
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]*>?/gm, '');    // 기타 HTML 태그 제거
};

// AI 편향성 분석 함수
const analyzeNewsBias = (articles) => {
    return new Promise((resolve, reject) => {
        if (!articles || articles.length === 0) return resolve([]);
        const scriptFolder = path.join(__dirname, '..', 'bias_model');
        const scriptFile = 'predict.py';
        // 가상환경의 Python 사용
        const pythonCommand = process.platform === 'win32' 
            ? path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe')
            : path.join(__dirname, '..', '..', '.venv', 'bin', 'python3');
        const pythonProcess = spawn(pythonCommand, [scriptFile], { cwd: scriptFolder });

        // [핵심] 입출력 인코딩을 UTF-8로 명시하여 데이터 깨짐 방지
        pythonProcess.stdin.setDefaultEncoding('utf-8');
        pythonProcess.stdout.setEncoding('utf-8');
        pythonProcess.stderr.setEncoding('utf-8');

        let resultData = '';
        let errorData = '';
        pythonProcess.stdout.on('data', (data) => { resultData += data; });
        pythonProcess.stderr.on('data', (data) => { errorData += data; });

        pythonProcess.on('close', (code) => {
            if (code !== 0) return reject(new Error(`AI 분석 실패: ${errorData}`));
            try {
                // 한글이 포함된 JSON 데이터를 객체로 변환
                resolve(JSON.parse(resultData));
            } catch (e) {
                console.error("JSON 파싱 에러. 원본 데이터 일부:", resultData.substring(0, 100));
                reject(new Error('결과 처리 중 오류 발생'));
            }
        });

        pythonProcess.stdin.write(JSON.stringify(articles), 'utf-8');
        pythonProcess.stdin.end();
    });
};

const searchNews = async (req, res) => {
    const { keyword } = req.query;
    console.log(`--- [${keyword}] 뉴스 및 이미지 검색 시작 ---`);

    try {
        const apiHeaders = {
            'X-Naver-Client-Id': naverConfig.clientID,
            'X-Naver-Client-Secret': naverConfig.clientSecret,
        };
        const naverApiUrl = `${naverConfig.newsSearchUrl}?query=${encodeURIComponent(keyword)}&display=20&sort=sim`;
        const response = await axios.get(naverApiUrl, { headers: apiHeaders });

        if (!response.data.items || response.data.items.length === 0) {
            return res.json({ progressiveNews: [], conservativeNews: [] });
        }

        // 각 뉴스 링크에 접속하여 제목 정제 및 이미지 추출
        const articlesWithDetails = await Promise.all(response.data.items.map(async (item) => {
            let imageUrl = '';
            let realTitle = cleanHtmlText(item.title);
            
            // 네이버 뉴스 페이지에서 og:image 크롤링
            if (item.link.includes('n.news.naver.com')) {
                try {
                    const pageRes = await axios.get(item.link, { timeout: 2000 });
                    const $ = cheerio.load(pageRes.data);
                    imageUrl = $('meta[property="og:image"]').attr('content') || '';
                } catch (e) {
                    console.log(`이미지 로드 실패: ${item.link}`);
                }
            }

            return {
                title: realTitle,
                link: item.link,
                description: cleanHtmlText(item.description),
                imageUrl: imageUrl, 
                content: cleanHtmlText(item.description).trim() || realTitle
            };
        }));

        // AI 모델 분석 실행
        const analyzedNews = await analyzeNewsBias(articlesWithDetails);

        // 결과 분류
        const progressiveNews = analyzedNews.filter(n => (n.bias || "").trim() === '진보');
        const conservativeNews = analyzedNews.filter(n => (n.bias || "").trim() === '보수');

        console.log(`최종 결과 -> 진보: ${progressiveNews.length}개, 보수: ${conservativeNews.length}개`);

        res.json({
            progressiveNews: progressiveNews.slice(0, 10),
            conservativeNews: conservativeNews.slice(0, 10)
        });

    } catch (error) {
        console.error('검색 로직 오류:', error.message);
        res.status(500).json({ message: '서버 오류 발생' });
    }
};

module.exports = { searchNews };