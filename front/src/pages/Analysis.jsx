import React, { useState, useEffect } from "react";
import "../styles/Analysis.css";
import Loading from "./Loading.jsx";

const Analysis = ({ keyword = "특검", onBack, onShowVisualization }) => {
  const [loading, setLoading] = useState(true);
  const [totalNewsCount, setTotalNewsCount] = useState(0);
  const [error, setError] = useState(null); // 에러 상태 추가

  useEffect(() => {
    let pollStatus; // 인터벌 ID 보관용
    let isMounted = true; // 언마운트 시 상태 업데이트 방지

    const startAnalysis = async () => {
      try {
        setLoading(true); // 분석 시작 시 로딩 강제 시작
        setError(null); // 분석 시작 시 에러 상태 초기화

        // 1️⃣ 분석 시작 요청 (POST)
        const startRes = await fetch("http://localhost:5000/api/analysis/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword }),
        });

        if (!startRes.ok) throw new Error(`분석 시작에 실패했습니다 (서버 상태: ${startRes.status})`);

        // 2️⃣ 분석 진행 상태 폴링 (GET)
        pollStatus = setInterval(async () => {
          try {
            const res = await fetch(`http://localhost:5000/api/analysis/status?keyword=${encodeURIComponent(keyword)}`);
            const data = await res.json();
            
            // [진단용] API 응답을 콘솔에 출력합니다.
            console.log("상태 확인 중...", data);

            // 완료되었을 때만 로딩 해제
            if (isMounted && data.completed) {
              setTotalNewsCount(data.count);
              setLoading(false);
              clearInterval(pollStatus);
            }
          } catch (error) {
            console.error("상태 확인 중 오류:", error);
            // 폴링 중 에러가 나면 로딩을 멈추고 에러 메시지 표시
            if (isMounted) {
              setError("분석 상태를 확인하는 데 실패했습니다.");
              setLoading(false);
              clearInterval(pollStatus);
            }
          }
        }, 1500); // 1.5초 간격 체크

      } catch (err) {
        console.error("에러 발생:", err);
        // 에러가 나면 로딩을 멈추고 에러 상태를 설정
        if (isMounted) {
            setError(err.message || "분석 중 알 수 없는 오류가 발생했습니다.");
            setLoading(false);
        }
      }
    };

    startAnalysis();

    // [중요] 컴포넌트가 사라질 때(페이지 이동 등) 인터벌을 종료함
    return () => {
      isMounted = false;
      if (pollStatus) clearInterval(pollStatus);
    };
  }, [keyword]);

  // 로딩 중일 때 보여줄 화면
  if (loading) {
    return <Loading keyword={keyword} />;
  }

  // 에러 발생 시 보여줄 화면
  if (error) {
    return (
      <div className="analysis-page-container">
        <div className="loading-header">
          <h1 style={{ color: '#d9534f' }}>❌ 분석 중 오류 발생</h1>
          <p>분석 처리 중 문제가 발생했습니다.</p>
          <div className="keyword-display" style={{ background: '#d9534f', marginTop: '20px' }}>
            오류: {error}
          </div>
        </div>
        <div style={{ marginTop: '40px' }}>
          <button onClick={onBack} className="main-button">🏠 메인으로 가기</button>
        </div>
      </div>
    );
  }

  // 로딩 완료 후 결과 화면
  return (
    <div className="analysis-page-container">
      <div className="analysis-header-banner">
        <div className="check-icon">✅</div>
        <h1 className="banner-title">뉴스 수집 및 분석 완료</h1>
        <p className="banner-subtitle">검색어: <strong>"{keyword}"</strong></p>
        <p className="banner-desc">
          뉴스 {totalNewsCount}개를 수집하고 프레임 분석을 완료했습니다.
        </p>
      </div>

      <div className="analysis-cards-row">
        <div className="analysis-card">
          <div className="card-icon">📊</div>
          <h4>프레임 분석 결과</h4>
          <p>뉴스가 프레임별로 분류되었습니다.</p>
        </div>

        <div className="analysis-card">
          <div className="card-icon">📁</div>
          <h4>데이터 저장</h4>
          <p>frame_set_{keyword}.json</p>
        </div>

        <div className="analysis-card">
          <div className="card-icon">🎨</div>
          <h4>시각화 준비</h4>
          <p>프레임별 카드 UI 표시 가능</p>
        </div>
      </div>

      <div style={{ textAlign: "center", margin: "50px 0" }}>
        <a href="#" onClick={(e) => { e.preventDefault(); onShowVisualization(); }} className="view-viz-button">
          📈 프레임 시각화 보기
        </a>
      </div>

      <div className="analysis-detail-info">
        <h4>📋 분석 정보</h4>
        <ul>
          <li>✓ 수집된 뉴스: {totalNewsCount}개</li>
          <li>✓ 검색 키워드: <strong>{keyword}</strong></li>
          <li>✓ 분석 파일: <strong>frame_set_{keyword}.json</strong></li>
          <li>✓ 상태: 분석 완료</li>
        </ul>
        <div style={{ textAlign: "right", marginTop: "20px" }}>
          <button onClick={onBack} className="main-button">🏠 메인으로 가기</button>
        </div>
      </div>
    </div>
  );
};

export default Analysis;