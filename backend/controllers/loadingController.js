// controllers/loadingController.js
const fs = require('fs');
const path = require('path');
const fetchNewsByKeyword = require('../config/crawling');

// 분석 진행 상태를 저장하는 인메모리 객체
let analysisProgress = {};
const dataDir = path.join(__dirname, '..', 'data');

/**
 * 키워드에 해당하는 데이터 파일 경로를 확인하고 반환하는 함수
 * @param {string} keyword
 * @returns {string|null} 파일 경로 또는 null
 */
const findDataFile = (keyword) => {
    const filePatterns = [
        `news_data_${keyword}.json`,
        `frame_set_${keyword}.json`
    ];

    for (const filename of filePatterns) {
        const filePath = path.join(dataDir, filename);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }
    return null;
};


/**
 * 분석 상태를 확인하는 컨트롤러
 */
const checkStatus = (req, res) => {
    const { keyword } = req.query;

    if (!keyword) {
        return res.status(400).json({ error: "keyword가 필요합니다." });
    }

    // 1. 인메모리에서 진행상태 확인
    const inMemoryStatus = analysisProgress[keyword];
    if (inMemoryStatus) {
        return res.json({
            keyword,
            completed: inMemoryStatus.completed,
            count: inMemoryStatus.count,
            message: inMemoryStatus.completed ? "분석 완료" : "분석 진행 중"
        });
    }

    // 2. 인메모리에 없으면 파일 시스템에서 기존 데이터 확인
    const existingFilePath = findDataFile(keyword);
    if (existingFilePath) {
        try {
            const fileContent = fs.readFileSync(existingFilePath, 'utf-8');
            const data = JSON.parse(fileContent);

            let count = 0;
            // 데이터가 배열인 경우 (news_data_*.json)
            if (Array.isArray(data)) {
                count = data.length;
            } 
            // 데이터가 객체인 경우 (frame_set_*.json)
            else if (typeof data === 'object' && data !== null) {
                // 객체의 모든 속성을 순회하며 배열의 길이를 더함
                for (const key in data) {
                    if (Array.isArray(data[key])) {
                        count += data[key].length;
                    }
                }
            }

            return res.json({
                keyword,
                completed: true,
                count: count,
                message: "기존 분석 데이터가 존재합니다."
            });
        } catch (error) {
            console.error(`[${keyword}] 데이터 파일 읽기/파싱 오류:`, error);
            // 파일은 있으나 읽을 수 없는 경우, 에러 상태로 간주하고 새로 분석 유도
        }
    }

    // 3. 어디에도 없으면 "시작되지 않음" 응답
    return res.json({
        keyword,
        completed: false,
        count: 0,
        message: "분석이 아직 시작되지 않았습니다."
    });
};


/**
 * 뉴스 분석을 시작하는 컨트롤러
 */
const startAnalysis = (req, res) => {
    const { keyword } = req.body;

    if (!keyword) {
        return res.status(400).json({ error: "keyword가 필요합니다." });
    }
    
    // 이미 분석이 진행 중이면 중복 실행 방지
    if (analysisProgress[keyword] && !analysisProgress[keyword].completed) {
        return res.status(409).json({ message: `이미 '${keyword}'에 대한 분석이 진행 중입니다.` });
    }

    // 이미 분석 완료된 파일이 있는지 확인
    const existingFilePath = findDataFile(keyword);
    if (existingFilePath) {
        return res.status(200).json({ message: `'${keyword}'에 대한 분석은 이미 완료되었습니다.` });
    }

    // 분석 상태 초기화
    analysisProgress[keyword] = { count: 0, completed: false };

    // 클라이언트에게 즉시 응답
    res.status(202).json({ message: `'${keyword}'에 대한 뉴스 분석을 시작합니다.` });

    // 백그라운드에서 크롤링 및 분석 실행
    (async () => {
        try {
            console.log(`[${keyword}] 뉴스 분석 백그라운드 작업 시작`);
            const result = await fetchNewsByKeyword(keyword);

            analysisProgress[keyword] = {
                count: result.count,
                completed: true
            };
            console.log(`[${keyword}] 뉴스 분석 완료. 총 ${result.count}개 수집.`);

        } catch (error) {
            console.error(`[${keyword}] 분석 중 에러 발생:`, error);
            analysisProgress[keyword] = {
                count: 0,
                completed: true, // 에러 시에도 무한 로딩 방지
                error: error.message
            };
        }
    })();
};

module.exports = {
    checkStatus,
    startAnalysis
};
