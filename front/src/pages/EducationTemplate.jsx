import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import FloatingGuide from '../components/common/FloatingGuide';
import Breadcrumb from '../components/common/Breadcrumb';
import '../styles/EducationTemplate.css';

const EducationTemplate = () => {
    const navigate = useNavigate();
    const [selectedTemplate, setSelectedTemplate] = useState('basic');
    const [customData, setCustomData] = useState({
        title: '미디어 편향성 이해하기',
        subtitle: '비판적 뉴스 소비를 위한 가이드',
        learningObjectives: [
            '편향성의 개념과 종류를 이해한다',
            '다양한 프레임 관점을 파악한다',
            '비판적으로 뉴스를 분석하는 능력을 기른다'
        ],
        exampleData: []
    });
    const contentRef = useRef();

    // 샘플 데이터
    const sampleBiasData = [
        { name: '진보', value: 45, color: '#2196F3' },
        { name: '중립', value: 25, color: '#9E9E9E' },
        { name: '보수', value: 30, color: '#F44336' }
    ];

    const sampleFrameData = [
        { name: '갈등', count: 30 },
        { name: '책임', count: 25 },
        { name: '경제', count: 20 },
        { name: '도덕', count: 15 },
        { name: '인간흥미', count: 10 }
    ];

    // 템플릿 종류
    const templates = [
        {
            id: 'basic',
            name: '기본 교육 자료',
            icon: '📚',
            description: '편향성 개념과 예시를 포함한 기본 템플릿'
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
        markdown += `\n## 편향성 분포\n\n`;
        markdown += `| 편향 유형 | 비율 |\n`;
        markdown += `|----------|------|\n`;
        sampleBiasData.forEach(item => {
            markdown += `| ${item.name} | ${item.value}% |\n`;
        });
        markdown += `\n## 프레임 분석\n\n`;
        markdown += `| 프레임 | 빈도 |\n`;
        markdown += `|--------|------|\n`;
        sampleFrameData.forEach(item => {
            markdown += `| ${item.name} | ${item.count} |\n`;
        });
        markdown += `\n---\n\n*생성일: ${new Date().toLocaleString()}*\n`;
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
                            </div>

                            <div className="preview-objectives">
                                <h3>📌 학습 목표</h3>
                                <ul>
                                    {customData.learningObjectives.map((obj, idx) => (
                                        <li key={idx}>{obj}</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="preview-visualizations">
                                <div className="viz-card">
                                    <h3>편향성 분포</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={sampleBiasData}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={(entry) => `${entry.name}: ${entry.value}%`}
                                                outerRadius={100}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {sampleBiasData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="viz-card">
                                    <h3>프레임 분석</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={sampleFrameData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Tooltip />
                                            <Bar dataKey="count" fill="#667eea" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

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
