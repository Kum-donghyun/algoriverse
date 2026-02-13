const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
require('dotenv').config();

const clientId = process.env.NAVER_CLIENT_ID;
const clientSecret = process.env.NAVER_CLIENT_SECRET;

// This function scrapes the article page for the main text and an image.
// If scraping the image fails, it uses the Naver Image Search API as a fallback.
async function fetchFullTextAndImage(url, title) {
    try {
        const res = await axios.get(url, {
            timeout: 5000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
            }
        });
        const $ = cheerio.load(res.data);
        
        let fullText =
            $("#newsct_article").text().trim() ||
            $("#newsEndContents").text().trim() ||
            $(".article_body").text().trim() ||
            $("#articeBody").text().trim() ||
            "";
        fullText = fullText.replace(/\s+/g, " ").trim();

        // 1. Scrape for image
        let imageUrl = 
            $('meta[property="og:image"]').attr('content') || 
            $('#newsct_article img').first().attr('src') ||
            $('#newsEndContents img').first().attr('src') ||
            '';

        // 2. Fallback to Naver Image API if scraping fails
        if (!imageUrl && title) {
            console.log(`⚠️  '${url}'에서 이미지를 찾지 못했습니다. 제목으로 이미지 API 검색을 시도합니다.`);
            const imageApiUrl = `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(title)}&display=1&sort=sim`;
            const headers = {
                "X-Naver-Client-Id": clientId,
                "X-Naver-Client-Secret": clientSecret
            };
            try {
                const imageRes = await axios.get(imageApiUrl, { headers });
                if (imageRes.data && imageRes.data.items && imageRes.data.items.length > 0) {
                    imageUrl = imageRes.data.items[0].link;
                    console.log(`✅  이미지 API 검색 성공: ${imageUrl}`);
                } else {
                    console.log(`- 이미지 API에서 '${title}'에 대한 검색 결과가 없습니다.`);
                }
            } catch (err) {
                console.error("❌ 이미지 API 에러:", err.message);
            }
        }

        return { fullText, imageUrl: imageUrl || "" };
    } catch (err) {
        console.error(`❌ 페이지 처리 에러 ${url}:`, err.message);
        return { fullText: "", imageUrl: "" };
    }
}

async function fetchNewsByKeyword(keyword) {
    if (!clientId || !clientSecret) {
        console.error("❌ API 키가 설정되지 않았습니다. .env 파일을 확인하세요.");
        throw new Error("API Key Missing");
    }

    const headers = {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret
    };

    let collected = [];
    const maxCount = 300;

    console.log(`🚀 [${keyword}] 분석 시작...`);

    for (let start = 1; start <= maxCount; start += 100) {
        const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(keyword)}&display=100&start=${start}&sort=sim`;
        try {
            const res = await axios.get(url, { headers });
            const items = res.data.items;
            if (!items || items.length === 0) break;

            for (const item of items) {
                const cleanTitle = item.title.replace(/<[^>]*>?/gm, '');
                const { fullText, imageUrl } = await fetchFullTextAndImage(item.link, cleanTitle);
                collected.push({
                    title: cleanTitle,
                    description: item.description.replace(/<[^>]*>?/gm, ''),
                    link: item.link,
                    pubDate: item.pubDate,
                    description_full: fullText,
                    imageUrl: imageUrl, // for camelCase
                    image_url: imageUrl  // for snake_case
                });
                await new Promise(r => setTimeout(r, 100));
            }
            console.log(`✅ ${collected.length}개 수집 중...`);
        } catch (err) {
            console.error("❌ 뉴스 수집 에러:", err.message);
            break;
        }
    }

    const filename = `news_data_${keyword}.json`;
    const dataDir = path.join(__dirname, '..', 'data');
    const filePath = path.join(dataDir, filename);

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(collected, null, 2), "utf-8");

    console.log(`📁 저장 완료: ${filePath} (총 ${collected.length}개)`);
    return { filename, count: collected.length };
}

module.exports = fetchNewsByKeyword;