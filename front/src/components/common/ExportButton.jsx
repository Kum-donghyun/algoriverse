import React from 'react';
import { exportToPDF, exportToMarkdown, exportToImage, exportToCSV } from '../../utils/exportUtils';
import '../../styles/ExportButton.css';

const ExportButton = ({ contentRef, data, filename = 'analysis', type = 'all' }) => {
    const [showMenu, setShowMenu] = React.useState(false);
    const [exporting, setExporting] = React.useState(false);

    const handleExport = async (format) => {
        setExporting(true);
        setShowMenu(false);

        try {
            switch (format) {
                case 'pdf':
                    if (contentRef?.current) {
                        await exportToPDF(contentRef.current, `${filename}.pdf`);
                    }
                    break;
                case 'markdown':
                    exportToMarkdown(data, `${filename}.md`);
                    break;
                case 'image':
                    if (contentRef?.current) {
                        await exportToImage(contentRef.current, `${filename}.png`);
                    }
                    break;
                case 'csv':
                    if (data.articles) {
                        exportToCSV(data.articles, `${filename}.csv`);
                    }
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.error('내보내기 실패:', error);
            alert('내보내기에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="export-button-container">
            <button 
                className="export-trigger-btn"
                onClick={() => setShowMenu(!showMenu)}
                disabled={exporting}
            >
                {exporting ? '내보내는 중...' : '📥 내보내기'}
            </button>

            {showMenu && (
                <div className="export-menu">
                    <button 
                        className="export-option pdf"
                        onClick={() => handleExport('pdf')}
                    >
                        <span className="icon">📄</span>
                        <span className="label">PDF</span>
                    </button>
                    <button 
                        className="export-option markdown"
                        onClick={() => handleExport('markdown')}
                    >
                        <span className="icon">📝</span>
                        <span className="label">마크다운</span>
                    </button>
                    <button 
                        className="export-option image"
                        onClick={() => handleExport('image')}
                    >
                        <span className="icon">🖼️</span>
                        <span className="label">이미지</span>
                    </button>
                    {data.articles && (
                        <button 
                            className="export-option csv"
                            onClick={() => handleExport('csv')}
                        >
                            <span className="icon">📊</span>
                            <span className="label">CSV</span>
                        </button>
                    )}
                </div>
            )}

            {showMenu && (
                <div 
                    className="export-overlay" 
                    onClick={() => setShowMenu(false)}
                />
            )}
        </div>
    );
};

export default ExportButton;
