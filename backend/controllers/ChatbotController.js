const db = require('../models');
const { Chatbot, Question } = db; 
const { Op } = require('sequelize');
const axios = require('axios'); // Import axios

exports.getReply = async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || messages.length === 0) {
      return res.status(400).json({ message: '메시지가 없습니다.' });
    }

    const userMessage = messages[messages.length - 1].content;
    let botReply = "궁금한 키워드와 함께 '찾아줘'라고 입력해보세요! (예: 정치 찾아줘)";
    let newsResults = [];

    // '찾아줘' 키워드 체크
    if (userMessage.includes("찾아줘") || userMessage.includes("검색") || userMessage.includes("기사")) {
      // 1. 순수 키워드만 추출
      const keyword = userMessage.replace(/기사|찾아줘|검색|해줘|관련/g, "").trim();

      if (keyword) {
        // 2. DB 검색 (is_active 확인 및 LIKE 검색)
        const localNewsResults = await Question.findAll({
          where: {
            question_text: { [Op.like]: `%${keyword}%` },
            is_active: 1 // 삭제되지 않은 활성 게시글만 검색
          },
          limit: 3,
          attributes: ['question_id', 'question_text']
        });

        // 3. Naver News API 검색
        try {
          const naverApiUrl = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(keyword)}&display=5&sort=sim`;
          const naverResponse = await axios.get(naverApiUrl, {
            headers: {
              'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
              'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
            },
          });

          if (naverResponse.data && naverResponse.data.items.length > 0) {
            const naverNews = naverResponse.data.items.map(item => ({
              question_id: `naver-${item.link}`, // Use link as unique ID for Naver news
              question_text: item.title.replace(/&lt;b&gt;|&lt;\/b&gt;/g, ''), // Remove bold tags
              link: item.link // Add link for external articles
            }));
            newsResults = [...localNewsResults, ...naverNews];
          } else {
            newsResults = localNewsResults;
          }
        } catch (naverError) {
          console.error('Naver News API Error:', naverError.message);
          // If Naver API fails, still use local results
          newsResults = localNewsResults;
        }

        if (newsResults.length > 0) {
          botReply = `'${keyword}'에 대한 관련 기사를 찾았습니다!`;
        } else {
          botReply = `'${keyword}'와(과) 일치하는 검색 결과가 없네요. 다른 단어로 검색해보세요.`;
        }
      }
    } else if (userMessage.includes("운영시간")) {
      botReply = "운영 시간은 평일 09:00 ~ 18:00입니다.";
    }

    // 3. 로그 저장 (이제 4번이 됨)
    if (db.Chatbot) {
      await db.Chatbot.create({
        user_message: userMessage,
        bot_message: botReply
      });
    }

    res.status(200).json({ reply: botReply, news: newsResults });
  } catch (error) {
    console.error('Chatbot Error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};