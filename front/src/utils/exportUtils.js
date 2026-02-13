/**
 * 내보내기 유틸리티
 * PDF, 마크다운, 이미지 형식으로 분석 결과를 내보냅니다.
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

/**
 * HTML 요소를 PDF로 내보내기
 * @param {HTMLElement} element - PDF로 변환할 HTML 요소
 * @param {string} filename - 저장할 파일명
 * @param {Object} options - 추가 옵션
 */
export const exportToPDF = async (element, filename = 'document.pdf', options = {}) => {
    try {
        const canvas = await html2canvas(element, {
            scale: options.scale || 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: options.orientation || 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        
        const imgX = (pdfWidth - imgWidth * ratio) / 2;
        const imgY = 10;

        pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
        pdf.save(filename);
        
        return { success: true };
    } catch (error) {
        console.error('PDF 내보내기 실패:', error);
        return { success: false, error };
    }
};

/**
 * 분석 결과를 마크다운으로 내보내기
 * @param {Object} data - 내보낼 데이터
 * @param {string} filename - 저장할 파일명
 */
export const exportToMarkdown = (data, filename = 'analysis.md') => {
    try {
        let markdown = '';

        // 제목
        if (data.title) {
            markdown += `# ${data.title}\n\n`;
        }

        // 부제목
        if (data.subtitle) {
            markdown += `> ${data.subtitle}\n\n`;
        }

        // 메타 정보
        if (data.meta) {
            markdown += `## 분석 정보\n\n`;
            Object.keys(data.meta).forEach(key => {
                markdown += `- **${key}**: ${data.meta[key]}\n`;
            });
            markdown += `\n`;
        }

        // 검색 키워드
        if (data.keyword) {
            markdown += `## 검색 키워드\n\n`;
            markdown += `"${data.keyword}"\n\n`;
        }

        // 신뢰도 점수
        if (data.trustScore) {
            markdown += `## 신뢰도 점수\n\n`;
            markdown += `| 항목 | 점수 |\n`;
            markdown += `|------|------|\n`;
            markdown += `| 종합 신뢰도 | ${data.trustScore.trustScore}% |\n`;
            markdown += `| 키워드 일치도 | ${data.trustScore.keywordMatch}% |\n`;
            markdown += `| 프레임 일관성 | ${data.trustScore.frameConsistency}% |\n`;
            markdown += `| 문맥 신뢰도 | ${data.trustScore.contextScore}% |\n\n`;
        }

        // 편향성 분석
        if (data.biasAnalysis) {
            markdown += `## 편향성 분석\n\n`;
            markdown += `- **분류 결과**: ${data.biasAnalysis.classification}\n`;
            markdown += `- **신뢰도**: ${data.biasAnalysis.confidence}%\n\n`;
        }

        // 프레임 분석
        if (data.frameAnalysis) {
            markdown += `## 프레임 분석\n\n`;
            markdown += `| 프레임 | 빈도 |\n`;
            markdown += `|--------|------|\n`;
            data.frameAnalysis.forEach(frame => {
                markdown += `| ${frame.name} | ${frame.count} |\n`;
            });
            markdown += `\n`;
        }

        // 기사 목록
        if (data.articles && data.articles.length > 0) {
            markdown += `## 분석 기사 목록\n\n`;
            data.articles.forEach((article, idx) => {
                markdown += `### ${idx + 1}. ${article.title}\n\n`;
                markdown += `- **언론사**: ${article.press || '정보 없음'}\n`;
                markdown += `- **게시일**: ${article.pubDate || '정보 없음'}\n`;
                markdown += `- **편향성**: ${article.bias || '분석 중'}\n`;
                if (article.link) {
                    markdown += `- **링크**: [기사 보기](${article.link})\n`;
                }
                markdown += `\n`;
            });
        }

        // 주요 키워드
        if (data.keywords && data.keywords.length > 0) {
            markdown += `## 주요 키워드\n\n`;
            data.keywords.forEach(keyword => {
                markdown += `- ${keyword}\n`;
            });
            markdown += `\n`;
        }

        // 분석 요약
        if (data.summary) {
            markdown += `## 분석 요약\n\n`;
            markdown += `${data.summary}\n\n`;
        }

        // 푸터
        markdown += `---\n\n`;
        markdown += `*생성일: ${new Date().toLocaleString('ko-KR')}*\n\n`;
        markdown += `*출처: Algoriverse 뉴스 편향성 분석 플랫폼*\n`;

        // 파일 다운로드
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();

        return { success: true };
    } catch (error) {
        console.error('마크다운 내보내기 실패:', error);
        return { success: false, error };
    }
};

/**
 * HTML 요소를 이미지로 내보내기
 * @param {HTMLElement} element - 이미지로 변환할 HTML 요소
 * @param {string} filename - 저장할 파일명
 * @param {string} format - 이미지 형식 (png, jpeg)
 */
export const exportToImage = async (element, filename = 'image.png', format = 'png') => {
    try {
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        canvas.toBlob(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        }, `image/${format}`);

        return { success: true };
    } catch (error) {
        console.error('이미지 내보내기 실패:', error);
        return { success: false, error };
    }
};

/**
 * CSV 형식으로 내보내기
 * @param {Array} data - CSV로 변환할 배열 데이터
 * @param {string} filename - 저장할 파일명
 */
export const exportToCSV = (data, filename = 'data.csv') => {
    try {
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('유효하지 않은 데이터');
        }

        // 헤더 추출
        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');

        // 데이터 행 생성
        const csvRows = data.map(row => {
            return headers.map(header => {
                const value = row[header];
                // 쉼표나 줄바꿈이 포함된 경우 따옴표로 감싸기
                if (typeof value === 'string' && (value.includes(',') || value.includes('\n'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',');
        }).join('\n');

        const csv = `${csvHeaders}\n${csvRows}`;

        // BOM 추가 (한글 깨짐 방지)
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();

        return { success: true };
    } catch (error) {
        console.error('CSV 내보내기 실패:', error);
        return { success: false, error };
    }
};

/**
 * JSON 형식으로 내보내기
 * @param {Object|Array} data - JSON으로 변환할 데이터
 * @param {string} filename - 저장할 파일명
 */
export const exportToJSON = (data, filename = 'data.json') => {
    try {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();

        return { success: true };
    } catch (error) {
        console.error('JSON 내보내기 실패:', error);
        return { success: false, error };
    }
};

/**
 * 테이블 데이터를 PDF로 내보내기 (jsPDF autoTable 사용)
 * @param {Array} data - 테이블 데이터 배열
 * @param {Object} options - 테이블 옵션
 * @param {string} filename - 저장할 파일명
 */
export const exportTableToPDF = (data, options = {}, filename = 'table.pdf') => {
    try {
        const pdf = new jsPDF({
            orientation: options.orientation || 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // 제목 추가
        if (options.title) {
            pdf.setFontSize(18);
            pdf.text(options.title, 14, 15);
        }

        // 헤더 추출
        const headers = options.headers || (data.length > 0 ? Object.keys(data[0]) : []);

        // 데이터 행 변환
        const rows = data.map(row => headers.map(header => row[header]));

        // autoTable로 테이블 생성
        pdf.autoTable({
            head: [headers],
            body: rows,
            startY: options.title ? 25 : 15,
            styles: {
                font: 'helvetica',
                fontSize: 10,
                cellPadding: 5
            },
            headStyles: {
                fillColor: [102, 126, 234],
                textColor: 255,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            }
        });

        // 푸터 추가
        const pageCount = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            pdf.setFontSize(10);
            pdf.text(
                `페이지 ${i} / ${pageCount}`,
                pdf.internal.pageSize.getWidth() / 2,
                pdf.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            );
        }

        pdf.save(filename);

        return { success: true };
    } catch (error) {
        console.error('테이블 PDF 내보내기 실패:', error);
        return { success: false, error };
    }
};
