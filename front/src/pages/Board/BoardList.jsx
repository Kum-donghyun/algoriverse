import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../styles/Board.css'; // 기존 스타일 활용 혹은 신규 작성

const BoardList = () => {
  const [posts, setPosts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchType, setSearchType] = useState('content');
  const [searchKeyword, setSearchKeyword] = useState('');
  const navigate = useNavigate();
  
  let loggedInUser = null;
  try {
    const userItem = localStorage.getItem('user');
    if (userItem && userItem !== 'undefined') {
      loggedInUser = JSON.parse(userItem);
    }
  } catch (error) {
    console.error("Failed to parse user from localStorage", error);
    // loggedInUser remains null
  }

  const fetchPosts = async (type = searchType, keyword = searchKeyword) => {
    try {
      const params = new URLSearchParams();
      if (keyword.trim()) {
        params.append('searchType', type);
        params.append('keyword', keyword);
      }
      const response = await axios.get(`http://localhost:5000/api/board?${params.toString()}`);
      setPosts(response.data);
    } catch (error) {
      console.error("게시글을 불러오는데 실패했습니다.", error);
    }
  };

  // 백엔드에서 데이터 가져오기
  useEffect(() => {
    fetchPosts();
  }, []);

  const handleSearch = () => {
    fetchPosts(searchType, searchKeyword);
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = posts.map(p => p.question_id);
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (e, id) => {
    e.stopPropagation(); // Prevent row click
    if (e.target.checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      alert('삭제할 게시글을 선택하세요.');
      return;
    }
    if (window.confirm(`선택된 ${selectedIds.length}개의 게시글을 정말로 삭제하시겠습니까?`)) {
      try {
        await axios.delete('http://localhost:5000/api/board/bulk', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}` // 수정 페이지와 동일하게 토큰을 직접 가져옵니다.
          },
          data: { question_ids: selectedIds } // 백엔드에서 기대하는 키 'question_ids'로 수정합니다.
        });
        alert('선택한 게시글이 삭제되었습니다.');
        setPosts(posts.filter(p => !selectedIds.includes(p.question_id)));
        setSelectedIds([]);
      } catch (error) {
        console.error("Bulk delete error:", error);
        alert('게시글 삭제에 실패했습니다. 권한이 없습니다.');
      }
    }
  };


  const handleRowClick = (questionId) => {
    // If a checkbox was clicked, the click is stopped.
    // So this only fires when the row itself is clicked.
    navigate(`/board/${questionId}`);
  };

  return (
    <div className="board-container">
      <h2>Q&A 게시판</h2>
      <p className="board-path">홈  게시판  Q&A</p>

      <table className="board-table">
        <thead>
          <tr>
            <th>
              <input type="checkbox" onChange={handleSelectAll} 
               checked={posts.length > 0 && selectedIds.length === posts.length}
              />
            </th>
            <th>번호</th>
            <th>작성자</th>
            <th>제목</th>
            <th>작성일</th>
            <th>유형</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {posts.length > 0 ? (
            posts.map((post, index) => (
              <tr key={post.question_id} onClick={() => handleRowClick(post.question_id)}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(post.question_id)}
                    onChange={(e) => handleSelectOne(e, post.question_id)}
                  />
                </td>
                <td>{posts.length - index}</td>
                <td>{post.User ? post.User.NICK : '알 수 없음'}</td>
                <td className="post-title">{post.question_text}</td>
                <td>{new Date(post.created_at).toLocaleDateString()}</td>
                <td>{post.question_type}</td>
                <td>{post.Answers && post.Answers.length > 0 ? '답변 완료' : '답변 전'}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6">등록된 질문이 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="board-footer">
        <div className="search-bar">
          <select value={searchType} onChange={(e) => setSearchType(e.target.value)}>
            <option value="content">내용</option>
            <option value="author">작성자</option>
          </select>
          <input 
            type="text" 
            placeholder="검색어를 입력하세요" 
            value={searchKeyword} 
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button className="btn-search" onClick={handleSearch}>검색</button>
        </div>
        <div className="footer-buttons">
          <button className="btn-write" onClick={() => navigate('/board/write')}>
            글쓰기
          </button>
          <button className="btn btn-delete" onClick={handleBulkDelete} disabled={selectedIds.length === 0}>
            선택 삭제
          </button>
        </div>
      </div>
    </div>
  );
};
export default BoardList;
