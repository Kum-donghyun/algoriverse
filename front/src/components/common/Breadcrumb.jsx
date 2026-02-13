import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../../styles/Breadcrumb.css';

const Breadcrumb = ({ selectedKeyword = null, articleTitle = null }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const path = location.pathname;
    
    const getBreadcrumbs = () => {
        const crumbs = [
            { label: '🏠 이슈 현황', path: '/', active: false }
        ];
        
        if (path === '/visualization') {
            crumbs.push({ label: '📊 프레임 분석', path: '/visualization', active: true });
            if (selectedKeyword) {
                crumbs.push({ label: `"${selectedKeyword}"`, path: null, active: true });
            }
        } else if (path.startsWith('/bias')) {
            crumbs.push({ label: '📊 프레임 분석', path: '/visualization', active: false });
            crumbs.push({ label: '🔍 기사 상세', path: null, active: true });
            if (articleTitle) {
                const shortTitle = articleTitle.length > 30 
                    ? articleTitle.substring(0, 30) + '...' 
                    : articleTitle;
                crumbs.push({ label: shortTitle, path: null, active: true });
            }
        } else if (path === '/methodology') {
            crumbs.push({ label: '🔬 기술 설명', path: '/methodology', active: true });
        } else if (path === '/analysis') {
            crumbs.push({ label: '📊 분석 결과', path: '/analysis', active: true });
        }
        
        return crumbs;
    };
    
    const breadcrumbs = getBreadcrumbs();
    
    const openContextHelp = () => {
        // 페이지별 도움말 모달 열기
        alert('도움말 기능은 곧 추가됩니다!');
    };
    
    return (
        <div className="breadcrumb-container">
            <nav className="breadcrumb">
                {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={index}>
                        {index > 0 && <span className="separator">→</span>}
                        {crumb.path ? (
                            <Link to={crumb.path} className={crumb.active ? 'active' : ''}>
                                {crumb.label}
                            </Link>
                        ) : (
                            <span className={crumb.active ? 'active' : ''}>
                                {crumb.label}
                            </span>
                        )}
                    </React.Fragment>
                ))}
            </nav>
            
            <div className="quick-actions">
                <button className="help-btn" onClick={openContextHelp} title="도움말">
                    💡 도움말
                </button>
                <button 
                    className="methodology-btn" 
                    onClick={() => navigate('/methodology')}
                    title="기술 설명"
                >
                    🔬 기술 설명
                </button>
            </div>
        </div>
    );
};

export default Breadcrumb;
