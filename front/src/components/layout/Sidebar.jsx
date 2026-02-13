import React from 'react';
import { NavLink } from 'react-router-dom';
import '../../styles/Sidebar.css'; 

const Sidebar = ({ isActive }) => { 
    
    // isActive prop을 사용하여 모바일 메뉴 활성화 상태를 제어합니다.
    const navClasses = `nav-menu ${isActive ? 'active' : ''}`;

    return (
        <nav id="sideMenu" className={navClasses}>
            <div className="sidebar-section">
                <ul className="sidebar-section-list">
                    <li><NavLink to="/" end>메인</NavLink></li>
                    <li><NavLink to="/introduce">소개</NavLink></li>
                    <li><NavLink to="/board">게시판</NavLink></li>
                    <li><NavLink to="/guidance">관점지도</NavLink></li>
                    <li><NavLink to="/edit">회원수정</NavLink></li>
                    <li><NavLink to="/delete">회원탈퇴</NavLink></li>
                </ul>
            </div>
        </nav>
    );
};

export default Sidebar;
