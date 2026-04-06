import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Outlet } from 'react-router-dom';
import Header from './components/layout/Header.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import Login from './pages/Login.jsx';
import Home from './components/layout/Home.jsx';
import Analysis from './pages/Analysis.jsx';
import WordCloud from './pages/WordCloud.jsx';
import Loading from './pages/Loading.jsx';
import Visualization from './pages/Visualization.jsx';
import EditorialAnalysis from './pages/EditorialAnalysis.jsx';
import Bias from './pages/Bias.jsx';
import Find from './pages/Find.jsx';
import Introduce from './pages/Introduce.jsx';
import Edit from './pages/Edit.jsx';
import Delete from './pages/Delete.jsx';
import Join from './pages/Join.jsx';
import BoardList from './pages/Board/BoardList.jsx'; 
import BoardWrite from './pages/Board/BoardWrite.jsx';
import BoardDetail from './pages/Board/BoardDetail.jsx';
import BoardEdit from './pages/Board/BoardEdit.jsx';
import Chatbot from './pages/Chatbot.jsx';
import Guidance from './pages/Guidance.jsx';
import Methodology from './pages/Methodology.jsx';
import PersonaDashboard from './pages/PersonaDashboard.jsx';
import EducationTemplate from './pages/EducationTemplate.jsx';
import BiasQuiz from './pages/BiasQuiz.jsx';


function App() {
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <MainApp />
    </BrowserRouter>
  );
}

function MainApp() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoginModalVisible, setIsLoginModalVisible] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);
  
  const [keyword, setKeyword] = useState(() => sessionStorage.getItem('keyword') || '');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const toggleLoginModal = () => setIsLoginModalVisible(!isLoginModalVisible);

  // Use useCallback for functions passed into useEffect dependencies
  const handleLogout = useCallback((isSilent = false) => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setLoggedInUser(null);
    if (!isSilent) {
      alert('로그아웃되었습니다.');
    }
  }, []);

  const handleLoginSuccess = (user) => {
    // The 'user' from the login response is expected to be an object.
    // We store the whole user object as a JSON string.
    localStorage.setItem('user', JSON.stringify(user)); 
    setLoggedInUser(user); // Set the state with the user object
    setIsLoginModalVisible(false);
    navigate('/'); // 홈으로 리디렉션
  };
  
  // Restore login state from localStorage on initial load
  useEffect(() => {
    const storedUserJSON = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUserJSON && storedToken) {
      try {
        const userObject = JSON.parse(storedUserJSON);
        setLoggedInUser(userObject);
      } catch (error) {
        console.error("Failed to parse user from localStorage on initial load", error);
        // If parsing fails, treat as logged out.
        handleLogout(true); 
      }
    }
  }, [handleLogout]);

  // Auto-logout timer
  useEffect(() => {
    const LOGOUT_TIME = 10 * 60 * 1000; // 10 minutes
    let logoutTimer;

    const resetTimer = () => {
      clearTimeout(logoutTimer);
      if (loggedInUser) {
        logoutTimer = setTimeout(() => {
          handleLogout(true); // silent logout
          alert('10분 동안 활동이 없어 자동 로그아웃되었습니다.');
        }, LOGOUT_TIME);
      }
    };

    const handleActivity = () => {
      resetTimer();
    };

    // Listen for user activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keypress', handleActivity);
    window.addEventListener('click', handleActivity);

    resetTimer(); // Set the timer when the component mounts or user logs in

    // Cleanup listeners and timer
    return () => {
      clearTimeout(logoutTimer);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [loggedInUser, handleLogout]); // Rerun effect if user logs in/out

  const handleAnalysisStart = useCallback((analysisKeyword) => {
    console.log("Word clicked:", analysisKeyword); // Log the received value
    let keywordStr = analysisKeyword;

    if (typeof keywordStr === 'object' && keywordStr !== null) {
      keywordStr = keywordStr.text || keywordStr.word;
    }

    if (typeof keywordStr !== 'string' || !keywordStr.trim()) {
      console.error("Analysis cannot start. Invalid keyword:", keywordStr);
      return; 
    }

    sessionStorage.setItem('keyword', keywordStr);
    setKeyword(keywordStr);
    setIsLoading(true);
  }, []);

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setIsLoading(false);
        navigate('/analysis');
      }, 3000); 

      return () => clearTimeout(timer);
    }
  }, [isLoading, navigate]);
  
  const handleGoHome = () => {
    navigate('/');
  };

  const handleShowVisualization = () => {
    navigate('/visualization');
  };

  const Layout = () => (
    <>
      <Header 
        onMenuClick={toggleMenu} 
        onLoginClick={toggleLoginModal}
        loggedInUser={loggedInUser}
        onLogout={handleLogout}
        onSearch={handleAnalysisStart}
        onLogoClick={handleGoHome}
      />
      
      <div className="container" style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar isActive={isMenuOpen} />
        
        <div className="content" style={{ flex: 1, padding: '20px' }}>
          {isLoading ? <Loading keyword={keyword} /> : <Outlet />}
        </div>
      </div>

      <Chatbot />
      
      <Login 
        isVisible={isLoginModalVisible}
        onClose={toggleLoginModal}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home onWordSelected={handleAnalysisStart} />} />
        <Route path="analysis" element={<Analysis keyword={keyword || sessionStorage.getItem('keyword')} onBack={handleGoHome} onShowVisualization={handleShowVisualization} />} />
        <Route path="wordcloud" element={<WordCloud onWordClick={handleAnalysisStart} />} />
        <Route path="find" element={<Find />} />
        <Route path="bias/:bias" element={<Bias />} />
        <Route path="introduce" element={<Introduce />} />
        <Route path="edit" element={<Edit />} />
        <Route path="delete" element={<Delete />} />
        <Route path="join" element={<Join />} />
        <Route path="board" element={<BoardList />} />
        <Route path="board/write" element={<BoardWrite />} />
        <Route path="board/:id" element={<BoardDetail />} />
        <Route path="board/edit/:id" element={<BoardEdit />} />
        <Route path="guidance" element={<Guidance />} />
        <Route path="methodology" element={<Methodology />} />
        <Route path="dashboard" element={<PersonaDashboard />} />
        <Route path="education-template" element={<EducationTemplate />} />
        <Route path="quiz" element={<BiasQuiz />} />
      </Route>
      <Route path="/visualization" element={<Visualization keyword={keyword || sessionStorage.getItem('keyword')} onBack={handleGoHome} />} />
      <Route path="/editorials" element={<EditorialAnalysis />} />
    </Routes>
  );
}

export default App;