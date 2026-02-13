const OpenAI = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');

const generateChatResponse = async (req, res) => {
    try {
        const { message, article, history } = req.body;

        if (!message || !article) {
            return res.status(400).json({ error: '메시지와 기사 정보가 필요합니다.' });
        }
        
        let imageUrl = null;
        // 기사 링크가 있으면 OG 이미지를 스크래핑합니다.
        if (article.link) {
            try {
                const { data } = await axios.get(article.link, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
                    }
                });
                const $ = cheerio.load(data);
                imageUrl = $('meta[property="og:image"]').attr('content');
            } catch (scrapeError) {
                console.error('기사 이미지 스크래핑 오류:', scrapeError.message);
            }
        }
        
        const apiKey = process.env.SITEAI_API_KEY;
        if (!apiKey) {
            console.error('SITEAI_API_KEY가 설정되지 않았습니다.');
            return res.status(500).json({ error: '서버 설정 오류: API 키가 없습니다.' });
        }

        const openai = new OpenAI({ apiKey: apiKey });

        const enableGptBias = process.env.ENABLE_GPT_BIAS === '1';
        let systemPrompt;

        if (enableGptBias) {
            systemPrompt = `당신은 '알고리봇'입니다. 한국 뉴스 기사의 편향성 분석을 돕는 AI 어시스턴트입니다.

**분석 중인 기사 정보**:
- 제목: ${article.title || 'N/A'}
- 언론사: ${article.publisher || 'N/A'}
- (참고) 시스템이 사전에 분석한 정보:
  - GPT 성향 점수: ${article.gpt_score || 'N/A'} (-5: 진보 ~ +5: 보수)
  - 핵심 키워드: ${article.gpt_keywords ? article.gpt_keywords.join(', ') : 'N/A'}
  - 편향 근거: ${article.gpt_evidence ? article.gpt_evidence.join(', ') : 'N/A'}

**핵심 역할**:
1.  **기사 분석**: 사용자가 '분석', '요약', '평가' 등 유사한 요청을 하면, 기사 본문을 바탕으로 아래 항목을 새로 분석하고 요약해서 제공합니다.
    *   **핵심 키워드 추출**: 기사의 주제를 가장 잘 나타내는 단어 5-7개를 추출합니다.
    *   **뉴스 성향 분석**: 기사가 진보, 보수, 중립 중 어느 쪽에 가까운지 판단하고, 그 이유를 구체적인 단어나 문장을 근거로 설명합니다. AI가 판단한 성향 점수(-5점(진보) ~ +5점(보수))를 함께 제시합니다.
2.  **반대 관점 기사 추천**: 사용자가 '반대 기사 추천', '다른 관점' 등 유사한 요청을 하면, 현재 기사와 반대되는 관점에서 작성될 수 있는 가상의 기사 제목과 핵심 논지를 2-3가지 제안합니다.
3.  **심층 질문 답변**: 기사 내용, 정치적 맥락, 사용된 프레임, 특정 단어의 함의 등 깊이 있는 질문에 대해 기사 본문과 AI의 분석을 참고하여 중립적으로 설명합니다.

**응답 형식**:
- 답변은 항상 친절하고 전문적인 톤을 유지합니다.
- 모든 답변은 주어진 기사 내용과 정보에 근거해야 합니다. 외부 정보를 가져오거나 추측성 답변은 하지 않습니다.

**본문 전체**:
${article.content || '본문 정보 없음'}`;
        } else {
            systemPrompt = `당신은 '알고리봇'입니다. 기사 분석을 돕는 AI 어시스턴트입니다. 기사 본문을 참고하여 사실 관계를 설명하되, 정치적 중립을 유지합니다.`;
        }

        // OpenAI API 오류 방지를 위해 'bot' 역할을 'assistant'로 변환
        const validHistory = (history || [])
            .filter(h => h && h.content)
            .map(h => ({
                role: h.role === 'bot' ? 'assistant' : (h.role || (h.isUser ? 'user' : 'assistant')),
                content: h.content
            }));

        const messages = [
            { role: 'system', content: systemPrompt },
            ...validHistory,
            { role: 'user', content: message }
        ];

        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: messages,
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.2,
            max_tokens: 1024
        });

        res.json({ response: completion.choices[0].message.content, imageUrl: imageUrl });

    } catch (error) {
        console.error('Chatbot Controller Error:', error);
        res.status(500).json({ error: '챗봇 답변 생성 중 오류가 발생했습니다.' });
    }
};

module.exports = { generateChatResponse };