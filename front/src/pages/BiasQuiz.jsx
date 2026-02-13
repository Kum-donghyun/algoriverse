import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FloatingGuide from '../components/common/FloatingGuide';
import Breadcrumb from '../components/common/Breadcrumb';
import '../styles/BiasQuiz.css';

const BiasQuiz = () => {
    const navigate = useNavigate();
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [quizHistory, setQuizHistory] = useState([]);

    // 퀴즈 문제 데이터
    const questions = [
        {
            id: 1,
            question: '다음 중 편향성이 가장 높은 표현은?',
            options: [
                '대통령이 정책을 발표했다',
                '대통령이 또다시 논란의 정책을 내놓았다',
                '대통령이 새로운 정책을 제안했다',
                '대통령의 정책 발표가 있었다'
            ],
            correct: 1,
            explanation: '"또다시 논란의"라는 표현은 부정적 프레임을 사전에 설정하여 독자의 판단을 유도합니다. 사실 전달보다 의견이 강조된 표현입니다.',
            bias: 'negative',
            frame: '갈등'
        },
        {
            id: 2,
            question: '같은 사건을 다루는 두 헤드라인입니다. 어느 쪽이 더 중립적인가요?\n\nA: "시위대 도심 점거, 교통 마비 우려"\nB: "시민 집회, 민주적 권리 행사"',
            options: [
                'A가 더 중립적',
                'B가 더 중립적',
                '둘 다 중립적',
                '둘 다 편향적'
            ],
            correct: 3,
            explanation: 'A는 부정적 프레임(혼란), B는 긍정적 프레임(권리)을 사용합니다. 중립적 표현은 "시민 집회 진행, 일부 교통 통제" 등이 될 수 있습니다.',
            bias: 'both',
            frame: '프레이밍'
        },
        {
            id: 3,
            question: '뉴스 편향성을 판단할 때 가장 중요한 요소는?',
            options: [
                '기자의 소속 언론사',
                '사용된 형용사와 부사',
                '인용된 발언의 균형',
                '위 모두'
            ],
            correct: 3,
            explanation: '편향성은 단일 요소가 아닌 복합적 요소로 판단됩니다. 언론사 성향, 표현 방식, 인용 발언의 균형 모두를 종합적으로 고려해야 합니다.',
            bias: 'neutral',
            frame: '책임'
        },
        {
            id: 4,
            question: '"경제 전문가들은 이번 정책이 효과적일 것이라고 말한다"\n이 문장의 문제점은?',
            options: [
                '전문가가 누구인지 명시하지 않음',
                '반대 의견을 제시하지 않음',
                '단정적 표현 사용',
                '모두 해당'
            ],
            correct: 3,
            explanation: '익명의 권위에 기대고, 반대 의견을 누락하며, "~것이다"라는 단정적 표현을 사용합니다. 좋은 뉴스는 구체적 출처와 다양한 관점을 제시합니다.',
            bias: 'selective',
            frame: '경제'
        },
        {
            id: 5,
            question: '프레임(Frame)의 개념으로 옳은 것은?',
            options: [
                '사건을 바라보는 관점의 틀',
                '기자의 개인적 의견',
                '팩트체크 결과',
                '기사의 분량'
            ],
            correct: 0,
            explanation: '프레임은 같은 사실을 어떤 관점에서 해석하고 강조하는지를 의미합니다. "시위"를 갈등으로 볼지, 민주적 권리 행사로 볼지가 프레임의 차이입니다.',
            bias: 'neutral',
            frame: '프레임 이론'
        },
        {
            id: 6,
            question: '다음 중 감정적 언어를 가장 많이 사용한 문장은?',
            options: [
                '정책에 대한 찬반 논쟁이 계속되고 있다',
                '충격적인 정책 발표에 시민들이 분노하고 있다',
                '정책 발표 후 다양한 반응이 나오고 있다',
                '정책에 대한 의견이 엇갈리고 있다'
            ],
            correct: 1,
            explanation: '"충격적인", "분노"는 강한 감정적 언어입니다. 중립적 보도는 사실을 전달하되 감정적 형용사를 최소화합니다.',
            bias: 'emotional',
            frame: '인간흥미'
        },
        {
            id: 7,
            question: '미디어 리터러시에서 "비판적 읽기"란?',
            options: [
                '뉴스를 부정적으로 보는 것',
                '항상 의심하며 읽는 것',
                '출처와 관점을 파악하며 읽는 것',
                '전문가 의견만 신뢰하는 것'
            ],
            correct: 2,
            explanation: '비판적 읽기는 의심이 아닌 분석입니다. 누가 쓴 기사인지, 어떤 관점인지, 빠진 정보는 없는지 생각하며 읽는 것을 의미합니다.',
            bias: 'neutral',
            frame: '미디어 리터러시'
        },
        {
            id: 8,
            question: '균형 잡힌 뉴스 소비 방법으로 적절한 것은?',
            options: [
                '한 언론사만 집중적으로 본다',
                '다양한 관점의 매체를 비교한다',
                '헤드라인만 빠르게 확인한다',
                'SNS 요약만 본다'
            ],
            correct: 1,
            explanation: '같은 사건을 다양한 매체에서 어떻게 다루는지 비교하면 편향성을 파악하고 균형 잡힌 이해를 할 수 있습니다.',
            bias: 'neutral',
            frame: '책임'
        },
        {
            id: 9,
            question: '"민주당 의원이 주장했다" vs "민주당 의원이 폭로했다"\n두 표현의 차이는?',
            options: [
                '차이 없음',
                '"폭로"가 더 중립적',
                '"폭로"가 선정적',
                '"주장"이 더 선정적'
            ],
            correct: 2,
            explanation: '"폭로"는 숨겨진 나쁜 일을 드러낸다는 부정적 뉘앙스를 담고 있습니다. "주장"이 더 중립적인 표현입니다.',
            bias: 'word_choice',
            frame: '도덕'
        },
        {
            id: 10,
            question: 'Algoriverse가 분석하는 편향성 요소가 아닌 것은?',
            options: [
                '키워드 빈도',
                '프레임 분류',
                '기자 이름',
                '문맥 분석'
            ],
            correct: 2,
            explanation: 'Algoriverse는 기사 내용(키워드, 프레임, 문맥)을 분석하지, 기자 개인을 평가하지 않습니다. 내용 자체의 편향성에 집중합니다.',
            bias: 'neutral',
            frame: '기술'
        }
    ];

    const handleAnswerClick = (selectedIdx) => {
        setSelectedAnswer(selectedIdx);
        setShowExplanation(true);

        const isCorrect = selectedIdx === questions[currentQuestion].correct;
        if (isCorrect) {
            setScore(score + 1);
        }

        // 퀴즈 히스토리 저장
        const newHistory = [...quizHistory, {
            question: questions[currentQuestion].question,
            selectedAnswer: questions[currentQuestion].options[selectedIdx],
            correctAnswer: questions[currentQuestion].options[questions[currentQuestion].correct],
            isCorrect
        }];
        setQuizHistory(newHistory);
    };

    const handleNext = () => {
        if (currentQuestion + 1 < questions.length) {
            setCurrentQuestion(currentQuestion + 1);
            setSelectedAnswer(null);
            setShowExplanation(false);
        } else {
            setShowResult(true);
            // localStorage에 저장
            const quizResult = {
                date: new Date().toISOString(),
                score: score + (selectedAnswer === questions[currentQuestion].correct ? 1 : 0),
                total: questions.length,
                percentage: Math.round(((score + (selectedAnswer === questions[currentQuestion].correct ? 1 : 0)) / questions.length) * 100)
            };
            const history = JSON.parse(localStorage.getItem('quizHistory') || '[]');
            history.push(quizResult);
            localStorage.setItem('quizHistory', JSON.stringify(history.slice(-10))); // 최근 10개만 저장
        }
    };

    const handleRestart = () => {
        setCurrentQuestion(0);
        setScore(0);
        setShowResult(false);
        setSelectedAnswer(null);
        setShowExplanation(false);
        setQuizHistory([]);
    };

    const getScoreMessage = () => {
        const finalScore = score;
        const percentage = (finalScore / questions.length) * 100;

        if (percentage >= 90) return { emoji: '🏆', message: '완벽해요!', desc: '미디어 리터러시 전문가 수준입니다!' };
        if (percentage >= 70) return { emoji: '🎉', message: '훌륭해요!', desc: '편향성 판별 능력이 우수합니다.' };
        if (percentage >= 50) return { emoji: '👍', message: '좋아요!', desc: '기본적인 이해가 잘 되어 있습니다.' };
        return { emoji: '📚', message: '조금 더 연습해요!', desc: '학습 자료를 다시 읽어보세요.' };
    };

    if (showResult) {
        const result = getScoreMessage();
        return (
            <div className="bias-quiz-page">
                <Breadcrumb />
                <FloatingGuide />

                <div className="quiz-container">
                    <div className="result-card">
                        <div className="result-emoji">{result.emoji}</div>
                        <h1>{result.message}</h1>
                        <p className="result-desc">{result.desc}</p>
                        
                        <div className="score-display">
                            <div className="score-circle">
                                <span className="score-number">{score}</span>
                                <span className="score-total">/ {questions.length}</span>
                            </div>
                            <div className="score-percentage">
                                {Math.round((score / questions.length) * 100)}%
                            </div>
                        </div>

                        <div className="result-history">
                            <h3>상세 결과</h3>
                            {quizHistory.map((item, idx) => (
                                <div key={idx} className={`history-item ${item.isCorrect ? 'correct' : 'wrong'}`}>
                                    <div className="history-icon">
                                        {item.isCorrect ? '✓' : '✗'}
                                    </div>
                                    <div className="history-content">
                                        <div className="history-question">Q{idx + 1}. {item.question}</div>
                                        <div className="history-answer">
                                            당신의 답: <strong>{item.selectedAnswer}</strong>
                                            {!item.isCorrect && (
                                                <span className="correct-answer"> → 정답: {item.correctAnswer}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="result-actions">
                            <button className="btn-primary" onClick={handleRestart}>
                                다시 도전하기
                            </button>
                            <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
                                대시보드로
                            </button>
                            <button className="btn-secondary" onClick={() => navigate('/education-template')}>
                                교육 자료 보기
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const question = questions[currentQuestion];
    const progress = ((currentQuestion + 1) / questions.length) * 100;

    return (
        <div className="bias-quiz-page">
            <Breadcrumb />
            <FloatingGuide />

            <div className="quiz-container">
                <div className="quiz-header">
                    <h1>🎯 편향성 판별 퀴즈</h1>
                    <p>미디어 리터러시 실력을 테스트해보세요</p>
                </div>

                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                    <span className="progress-text">{currentQuestion + 1} / {questions.length}</span>
                </div>

                <div className="question-card">
                    <div className="question-number">문제 {currentQuestion + 1}</div>
                    <h2 className="question-text">{question.question}</h2>

                    <div className="options-container">
                        {question.options.map((option, idx) => (
                            <button
                                key={idx}
                                className={`option-btn ${
                                    selectedAnswer === idx 
                                        ? idx === question.correct 
                                            ? 'correct' 
                                            : 'wrong'
                                        : ''
                                } ${selectedAnswer !== null && idx === question.correct ? 'show-correct' : ''}`}
                                onClick={() => handleAnswerClick(idx)}
                                disabled={selectedAnswer !== null}
                            >
                                <span className="option-number">{String.fromCharCode(65 + idx)}</span>
                                <span className="option-text">{option}</span>
                                {selectedAnswer !== null && idx === question.correct && (
                                    <span className="check-icon">✓</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {showExplanation && (
                        <div className="explanation-box">
                            <h3>💡 해설</h3>
                            <p>{question.explanation}</p>
                            <div className="tags">
                                <span className="tag">프레임: {question.frame}</span>
                            </div>
                        </div>
                    )}

                    {showExplanation && (
                        <button className="next-btn" onClick={handleNext}>
                            {currentQuestion + 1 === questions.length ? '결과 보기' : '다음 문제'}
                        </button>
                    )}
                </div>

                <div className="quiz-tips">
                    <h4>💡 TIP</h4>
                    <ul>
                        <li>감정적 표현과 중립적 표현을 구분하세요</li>
                        <li>누가, 무엇을 말했는지 정확히 확인하세요</li>
                        <li>다양한 관점이 균형있게 제시되었는지 살펴보세요</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default BiasQuiz;
