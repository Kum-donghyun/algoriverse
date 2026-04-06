import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ReferenceLine } from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import FloatingGuide from '../components/common/FloatingGuide';
import Breadcrumb from '../components/common/Breadcrumb';
import { API_BASE_URL } from '../config/apiConfig';
import '../styles/EducationTemplate.css';

// ─── 4차원 15유형 프레임 메타데이터 ───
const FRAME_META = {
    definition:  { label: '정의/해석', dim: '기능적', color: '#6366f1' },
    cause:       { label: '원인',      dim: '기능적', color: '#8b5cf6' },
    consequence: { label: '결과/영향', dim: '기능적', color: '#a78bfa' },
    remedy:      { label: '대책',      dim: '기능적', color: '#7c3aed' },
    social:      { label: '사회',      dim: '관점',   color: '#10b981' },
    economic:    { label: '경제',      dim: '관점',   color: '#059669' },
    policy:      { label: '정책',      dim: '관점',   color: '#0d9488' },
    morality:    { label: '도덕성',    dim: '관점',   color: '#f59e0b' },
    responsibility: { label: '책임',   dim: '관점',   color: '#d97706' },
    democratic:  { label: '민주합의',  dim: '관점',   color: '#0ea5e9' },
    human_interest: { label: '인간적흥미', dim: '관점', color: '#ec4899' },
    conflict:    { label: '갈등',      dim: '상태',   color: '#ef4444' },
    crisis:      { label: '위기/위험', dim: '상태',   color: '#dc2626' },
    accusation:  { label: '의혹/고발', dim: '전달',   color: '#78716c' },
    informative: { label: '단순정보전달', dim: '전달', color: '#9ca3af' },
};



const EducationTemplate = () => {
    const navigate = useNavigate();
    const [selectedTemplate, setSelectedTemplate] = useState('basic');
    const [customData, setCustomData] = useState({
        title: '미디어 편향성 이해하기',
        subtitle: '비판적 뉴스 소비를 위한 가이드',
        learningObjectives: [
            '같은 사건도 프레임에 따라 전혀 다르게 보도될 수 있음을 이해한다',
            '4차원 15유형 프레임 분류 체계를 파악한다',
            '비판적으로 뉴스를 분석하는 능력을 기른다'
        ],
        exampleData: []
    });
    const contentRef = useRef();

    // ─── 실시간 데이터 상태 ───
    const [issueFrameData, setIssueFrameData] = useState([]); // Top5 이슈별 프레임 차트 데이터
    const [topIssues, setTopIssues] = useState([]);            // Top5 이슈 정보
    const [trendTimelines, setTrendTimelines] = useState({});  // 사설 타임라인 전체
    const [selectedTopic, setSelectedTopic] = useState('');     // 선택된 이슈 토픽
    const [topicOptions, setTopicOptions] = useState([]);       // 드롭다운 옵션
    const [dataUpdatedAt, setDataUpdatedAt] = useState('');     // 데이터 갱신 시각
    const [loading, setLoading] = useState(true);

    // ─── 실시간 이슈 클러스터 + 사설 타임라인 로드 ───
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [issueRes, trendRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/issues/realtime?limit=5`),
                    fetch(`${API_BASE_URL}/editorials/trend-timeline`)
                ]);
                // 이슈 클러스터 Top5
                if (issueRes.ok) {
                    const issueData = await issueRes.json();
                    const issues = (issueData.issues || []).slice(0, 5);
                    setTopIssues(issues);
                    setDataUpdatedAt(issueData.updatedAt ? new Date(issueData.updatedAt).toLocaleString() : new Date().toLocaleString());

                    // Top5 이슈별 프레임 분포 집계
                    const chartData = [];
                    for (const issue of issues) {
                        const fd = issue.frameData;
                        if (!fd || !fd.articles) continue;
                        // 프레임 빈도 집계
                        const frameCounts = {};
                        for (const art of fd.articles) {
                            if (art.frames) {
                                for (const f of art.frames) {
                                    frameCounts[f.type] = (frameCounts[f.type] || 0) + 1;
                                }
                            } else if (art.frame) {
                                frameCounts[art.frame] = (frameCounts[art.frame] || 0) + 1;
                            }
                        }
                        // 상위 프레임만 추출
                        const sorted = Object.entries(frameCounts).sort((a, b) => b[1] - a[1]);
                        const issueLabel = `#${issue.rank} ${issue.keyword}`;
                        for (const [frameKey, count] of sorted) {
                            const meta = FRAME_META[frameKey];
                            if (meta) {
                                chartData.push({
                                    issue: issueLabel,
                                    frame: `${meta.label} (${meta.dim})`,
                                    count,
                                    fill: meta.color,
                                    frameKey,
                                });
                            }
                        }
                    }
                    setIssueFrameData(chartData);
                }
                // 사설 타임라인
                if (trendRes.ok) {
                    const trendData = await trendRes.json();
                    setTrendTimelines(trendData);
                    const keys = Object.keys(trendData).filter(k => trendData[k].length > 0);
                    setTopicOptions(keys);
                    if (keys.length > 0) setSelectedTopic(keys[0]);
                }
            } catch (err) {
                console.error('교육 템플릿 데이터 로드 실패:', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // 템플릿 종류
    const templates = [
        {
            id: 'basic',
            name: '기본 교육 자료',
            icon: '📚',
            description: '편향성 개념과 예시를 포함한 기본 템플릿'
        },
        {
            id: 'trend',
            name: '사설/이슈 타임라인',
            icon: '📈',
            description: '언론사별 사설 논조의 시계열 변화 분석'
        },
        {
            id: 'workshop',
            name: '워크샵용',
            icon: '👥',
            description: '그룹 활동과 토론을 위한 템플릿'
        },
        {
            id: 'presentation',
            name: '발표용',
            icon: '🎤',
            description: '시각 자료 중심의 프레젠테이션 템플릿'
        },
        {
            id: 'assignment',
            name: '과제용',
            icon: '✍️',
            description: '학생 과제를 위한 템플릿'
        }
    ];

    // PDF 다운로드
    const handleDownloadPDF = async () => {
        const element = contentRef.current;
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        const imgX = (pdfWidth - imgWidth * ratio) / 2;
        const imgY = 10;

        pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
        pdf.save(`교육자료_${customData.title}_${new Date().toLocaleDateString()}.pdf`);
    };

    // 마크다운 다운로드
    const handleDownloadMarkdown = () => {
        let markdown = `# ${customData.title}\n\n`;
        markdown += `> ${customData.subtitle}\n\n`;
        markdown += `## 학습 목표\n\n`;
        customData.learningObjectives.forEach((obj, idx) => {
            markdown += `${idx + 1}. ${obj}\n`;
        });
        markdown += `\n## 실시간 이슈 클러스터 Top5 프레임 분석 (4차원 15유형)\n\n`;
        if (topIssues.length > 0) {
            for (const issue of topIssues) {
                markdown += `### #${issue.rank} ${issue.keyword} (${issue.articleCount}건)\n`;
                markdown += `> ${issue.title}\n\n`;
                const frames = issueFrameData.filter(d => d.issue === `#${issue.rank} ${issue.keyword}`);
                if (frames.length > 0) {
                    markdown += `| 프레임(차원) | 빈도 |\n|--------------|------|\n`;
                    frames.forEach(f => { markdown += `| ${f.frame} | ${f.count} |\n`; });
                    markdown += `\n`;
                }
            }
        }
        
        if (selectedTemplate === 'trend' && trendTimelines[selectedTopic]?.length > 0) {
            markdown += `\n## 사설 경향 분석: ${selectedTopic}\n\n`;
            markdown += `| 날짜 | 조선일보 | 중앙일보 | 한겨레 | 경향신문 |\n`;
            markdown += `|------|----------|----------|--------|----------|\n`;
            trendTimelines[selectedTopic].forEach(item => {
                markdown += `| ${item.date} | ${item.조선일보} | ${item.중앙일보} | ${item.한겨레} | ${item.경향신문} |\n`;
            });
        }

        markdown += `\n---\n\n*생성일: ${new Date().toLocaleString()}*\n`;
        markdown += `*데이터 기준: ${dataUpdatedAt}*\n`;
        markdown += `*출처: Algoriverse 교육 자료 템플릿*\n`;

        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `교육자료_${customData.title}_${new Date().toLocaleDateString()}.md`;
        link.click();
    };

    // 이미지 다운로드
    const handleDownloadImage = async () => {
        const element = contentRef.current;
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false
        });

        canvas.toBlob(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `교육자료_${customData.title}_${new Date().toLocaleDateString()}.png`;
            link.click();
        });
    };

    return (
        <div className="education-template-page">
            <Breadcrumb />
            <FloatingGuide />

            <div className="template-container">
                <header className="template-header">
                    <h1>📚 교육 자료 템플릿</h1>
                    <p>미디어 리터러시 교육을 위한 커스터마이징 가능한 템플릿</p>
                </header>

                {/* 템플릿 선택 */}
                <section className="template-selector">
                    <h2>템플릿 선택</h2>
                    <div className="template-grid">
                        {templates.map(template => (
                            <div
                                key={template.id}
                                className={`template-card ${selectedTemplate === template.id ? 'active' : ''}`}
                                onClick={() => setSelectedTemplate(template.id)}
                            >
                                <div className="template-icon">{template.icon}</div>
                                <h4>{template.name}</h4>
                                <p>{template.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 커스터마이즈 */}
                <section className="customization-section">
                    <h2>내용 편집</h2>
                    <div className="form-group">
                        <label>제목</label>
                        <input
                            type="text"
                            value={customData.title}
                            onChange={(e) => setCustomData({ ...customData, title: e.target.value })}
                            className="form-input"
                        />
                    </div>
                    <div className="form-group">
                        <label>부제목</label>
                        <input
                            type="text"
                            value={customData.subtitle}
                            onChange={(e) => setCustomData({ ...customData, subtitle: e.target.value })}
                            className="form-input"
                        />
                    </div>
                    <div className="form-group">
                        <label>학습 목표 (줄바꿈으로 구분)</label>
                        <textarea
                            value={customData.learningObjectives.join('\n')}
                            onChange={(e) => setCustomData({
                                ...customData,
                                learningObjectives: e.target.value.split('\n').filter(line => line.trim())
                            })}
                            className="form-textarea"
                            rows={5}
                        />
                    </div>
                    {(selectedTemplate === 'trend' || selectedTemplate === 'presentation') && topicOptions.length > 0 && (
                        <div className="form-group">
                            <label>분석할 주요 이슈 선택 (사설 타임라인)</label>
                            <select
                                className="form-input"
                                style={{ padding: '10px' }}
                                value={selectedTopic}
                                onChange={(e) => setSelectedTopic(e.target.value)}
                            >
                                {topicOptions.map(topic => (
                                    <option key={topic} value={topic}>{topic}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </section>

                {/* 미리보기 */}
                <section className="preview-section">
                    <div className="preview-header">
                        <h2>미리보기</h2>
                        <div className="download-buttons">
                            <button className="download-btn pdf" onClick={handleDownloadPDF}>
                                📄 PDF 다운로드
                            </button>
                            <button className="download-btn markdown" onClick={handleDownloadMarkdown}>
                                📝 마크다운 다운로드
                            </button>
                            <button className="download-btn image" onClick={handleDownloadImage}>
                                🖼️ 이미지 다운로드
                            </button>
                        </div>
                    </div>

                    <div className="template-preview" ref={contentRef}>
                        <div className="preview-content">
                            <div className="preview-title-section">
                                <h1>{customData.title}</h1>
                                <p className="preview-subtitle">{customData.subtitle}</p>
                                <p style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>데이터 기준: {dataUpdatedAt || '로딩 중...'}</p>
                            </div>

                            <div className="preview-objectives">
                                <h3>📌 학습 목표</h3>
                                <ul>
                                    {customData.learningObjectives.map((obj, idx) => (
                                        <li key={idx}>{obj}</li>
                                    ))}
                                </ul>
                            </div>

                            {/* ─── 이슈 클러스터 Top5 프레임 분석 ─── */}
                            <div className="preview-visualizations">
                                <h3>📊 실시간 이슈 클러스터 Top5 — 프레임 분석 (4차원 15유형)</h3>
                                {loading ? (
                                    <p style={{ textAlign: 'center', padding: '40px', color: '#999' }}>데이터 로딩 중...</p>
                                ) : topIssues.length === 0 ? (
                                    <p style={{ textAlign: 'center', padding: '40px', color: '#999' }}>이슈 클러스터 데이터가 없습니다.</p>
                                ) : (
                                    <>
                                        {/* 이슈 목록 요약 */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                                            {topIssues.map(issue => (
                                                <div key={issue.id} style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', borderLeft: '4px solid #6366f1' }}>
                                                    <strong style={{ fontSize: '13px' }}>#{issue.rank} {issue.keyword}</strong>
                                                    <p style={{ fontSize: '11px', color: '#666', margin: '4px 0 0' }}>
                                                        {issue.articleCount}건 · {issue.title?.slice(0, 30)}…
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* 이슈별 프레임 분포 차트 */}
                                        {topIssues.map(issue => {
                                            const issueLabel = `#${issue.rank} ${issue.keyword}`;
                                            const frames = issueFrameData.filter(d => d.issue === issueLabel);
                                            if (frames.length === 0) return null;
                                            return (
                                                <div className="viz-card" key={issue.id} style={{ marginBottom: '20px' }}>
                                                    <h4 style={{ marginBottom: '10px' }}>{issueLabel}: {issue.title?.slice(0, 40)}</h4>
                                                    <ResponsiveContainer width="100%" height={Math.max(180, frames.length * 28)}>
                                                        <BarChart data={frames} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                                            <CartesianGrid strokeDasharray="3 3" />
                                                            <XAxis type="number" />
                                                            <YAxis dataKey="frame" type="category" width={130} tick={{ fontSize: 11 }} />
                                                            <Tooltip />
                                                            <Bar dataKey="count" name="기사 수">
                                                                {frames.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                                ))}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                            
                            {/* ─── 사설 경향 타임라인 ─── */}
                            {(selectedTemplate === 'trend' || selectedTemplate === 'presentation') && (
                                <div className="preview-editorial-trend" style={{ marginTop: '30px' }}>
                                    <h3>📈 이슈별 사설 경향 타임라인{selectedTopic ? `: '${selectedTopic}'` : ''}</h3>
                                    {trendTimelines[selectedTopic]?.length > 0 ? (
                                        <>
                                            <p style={{ color: '#666', marginBottom: '15px' }}>
                                                언론사별 사설 논조(Stance)의 시계열 변화 (
                                                {trendTimelines[selectedTopic][0]?.date} ~ {trendTimelines[selectedTopic][trendTimelines[selectedTopic].length - 1]?.date}
                                                )
                                            </p>
                                            <div className="viz-card" style={{ width: '100%' }}>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <LineChart data={trendTimelines[selectedTopic]} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis dataKey="date" />
                                                        <YAxis domain={[-3, 3]} ticks={[-3, -1.5, 0, 1.5, 3]} 
                                                            tickFormatter={(tick) => {
                                                                if(tick === 3) return '우호/긍정';
                                                                if(tick === 0) return '중립';
                                                                if(tick === -3) return '비판/부정';
                                                                return tick;
                                                            }} 
                                                            width={90} />
                                                        <Tooltip formatter={(value) => {
                                                            if (value >= 2) return [`${value} (우호/긍정)`];
                                                            if (value >= 1) return [`${value} (기대/지지)`];
                                                            if (value <= -2) return [`${value} (비판적)`];
                                                            if (value <= -1) return [`${value} (우려)`];
                                                            return [`${value} (중립)`];
                                                        }} />
                                                        <Legend />
                                                        <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" label="중립" />
                                                        <Line type="monotone" dataKey="조선일보" stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                                                        <Line type="monotone" dataKey="중앙일보" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                                                        <Line type="monotone" dataKey="한겨레" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                                                        <Line type="monotone" dataKey="경향신문" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </>
                                    ) : (
                                        <p style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
                                            {loading ? '타임라인 로딩 중...' : '선택한 이슈에 대한 사설 데이터가 없습니다. 다른 이슈를 선택해 주세요.'}
                                        </p>
                                    )}
                                </div>
                            )}

                            {selectedTemplate === 'workshop' && (
                                <div className="preview-activity">
                                    <h3>🤝 그룹 활동</h3>
                                    <div className="activity-box">
                                        <p><strong>활동 1:</strong> 같은 뉴스, 다른 관점 찾기</p>
                                        <p>같은 사건을 다룬 여러 기사를 비교하고 편향성 차이를 토론하세요.</p>
                                    </div>
                                    <div className="activity-box">
                                        <p><strong>활동 2:</strong> 프레임 역할극</p>
                                        <p>각 팀이 다른 프레임으로 같은 사건을 설명해보세요.</p>
                                    </div>
                                </div>
                            )}

                            {selectedTemplate === 'assignment' && (
                                <div className="preview-assignment">
                                    <h3>✍️ 과제</h3>
                                    <div className="assignment-box">
                                        <p><strong>과제 목표:</strong> 실제 뉴스 기사 분석하기</p>
                                        <ol>
                                            <li>관심 있는 주제의 뉴스 기사 3개를 선택하세요</li>
                                            <li>각 기사의 편향성과 프레임을 분석하세요</li>
                                            <li>분석 결과를 보고서로 작성하세요</li>
                                        </ol>
                                        <p><strong>제출 기한:</strong> __________________</p>
                                    </div>
                                </div>
                            )}

                            <div className="preview-footer">
                                <p>생성일: {new Date().toLocaleString()}</p>
                                <p>출처: Algoriverse 교육 자료 템플릿</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 도움말 */}
                <section className="help-section">
                    <h3>💡 사용 팁</h3>
                    <ul className="help-list">
                        <li>템플릿을 선택하고 내용을 편집한 후 원하는 형식으로 다운로드하세요</li>
                        <li>PDF는 인쇄용으로, 마크다운은 온라인 문서용으로 적합합니다</li>
                        <li>실제 분석 결과를 추가하려면 <button onClick={() => navigate('/')}>검색 페이지</button>에서 키워드를 분석하세요</li>
                        <li>워크샵용 템플릿은 활동 시간 90분 기준으로 설계되었습니다</li>
                    </ul>
                </section>
            </div>
        </div>
    );
};

export default EducationTemplate;
