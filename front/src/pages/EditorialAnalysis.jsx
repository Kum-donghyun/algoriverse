import React, { useEffect, useState } from 'react';
import Breadcrumb from '../components/common/Breadcrumb';
import FloatingGuide from '../components/common/FloatingGuide';
import '../styles/Visualization.css';
import '../styles/OpinionBot.css';

const API_BASE = 'http://localhost:5000';

const EDITORIAL_PAPERS = ['한국일보','서울신문','국민일보','경향신문','한겨레','동아일보','중앙일보','조선일보','매일경제','한국경제','서울경제'];

// 논조 색상
const TONE_COLORS = {
  '비판적': '#ef4444', '우려': '#f59e0b', '촉구': '#f97316', '경고': '#dc2626',
  '옹호적': '#22c55e', '긍정적': '#10b981', '중립적': '#6b7280', '신중론': '#8b5cf6',
};
function getToneColor(tone) {
  if (!tone) return '#6b7280';
  for (const [k, c] of Object.entries(TONE_COLORS)) { if (tone.includes(k)) return c; }
  return '#6b7280';
}

/* ── 컴팩트 사설 카드 (첨부 이미지 스타일) ── */
function CompactCard({ editorial, press, onClickTitle }) {
  const snippet = (editorial.full_text || editorial.snippet || editorial.description || '').slice(0, 100);
  return (
    <div className="compact-card">
      {editorial.imageUrl && (
        <div className="compact-card-img">
          <img src={editorial.imageUrl} alt="" loading="lazy" />
        </div>
      )}
      <div className="compact-card-body">
        <h5 className="compact-card-title" onClick={onClickTitle}>{editorial.title}</h5>
        <p className="compact-card-snippet">{snippet}</p>
        <a href={editorial.link} target="_blank" rel="noreferrer" className="compact-card-link">원문 보기</a>
      </div>
    </div>
  );
}

export default function EditorialAnalysis() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [editorials, setEditorials] = useState({});
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);

  // OpinionBot
  const [opinionBot, setOpinionBot] = useState(null);
  const [obLoading, setObLoading] = useState(false);
  const [obError, setObError] = useState(null);

  // 뷰 모드: 'press' (신문사별 - 기본) | 'issue' (이슈별)
  const [viewMode, setViewMode] = useState('press');

  /* ── 데이터 Fetch ── */
  const fetchList = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/editorials/list?date=${date}`);
      if (!res.ok) throw new Error('사설 목록을 불러오지 못했습니다.');
      const data = await res.json();
      setEditorials(data || {});
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const triggerCollect = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/editorials/collect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date })
      });
      if (!res.ok) throw new Error('수집에 실패했습니다.');
      await fetchList();
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const runOpinionBot = async () => {
    setObLoading(true); setObError(null);
    try {
      const res = await fetch(`${API_BASE}/api/editorials/opinionbot?date=${date}`);
      if (!res.ok) throw new Error('오피니언봇 분석 실패');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOpinionBot(data);
    } catch (e) { setObError(e.message); }
    setObLoading(false);
  };

  // 날짜 변경 시 데이터 로드 + 캐시 조회
  useEffect(() => {
    fetchList();
    // 캐시된 오피니언봇 결과 조회
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/editorials/opinionbot-result?date=${date}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.issues) { setOpinionBot(data); return; }
        }
      } catch (e) { /* ignore */ }
      setOpinionBot(null);
    })();
    setViewMode('press');
  }, [date]);

  /* ── 총 사설 수 ── */
  const totalCount = Object.values(editorials).reduce((s, a) => s + (a?.length || 0), 0);

  /* ── 렌더 ── */
  return (
    <div className="viz-container">
      <Breadcrumb selectedKeyword={null} />

      {/* ── 헤더 ── */}
      <header className="viz-header">
        <div className="masthead">
          <h1>📰 주요 11개 신문사 사설 논거 분석</h1>
          <p>일별 주요지 사설을 수집 · 비교하여 각 사설의 논거적 경향과 프레임을 분석합니다.</p>
          <div className="ed-top-controls">
            <input type="date" className="ed-date-input" value={date} onChange={e => setDate(e.target.value)} />
            <button className="ed-btn ed-btn-outline" onClick={fetchList} disabled={loading}>
              {loading ? '⏳' : '📋'} 목록 불러오기
            </button>
            <button className="ed-btn ed-btn-outline" onClick={triggerCollect} disabled={loading}>
              📥 수집
            </button>
            <button className="ed-btn ed-btn-primary" onClick={runOpinionBot} disabled={obLoading || loading}>
              {obLoading ? '⏳ Gemini 분석 중…' : '🤖 오피니언봇 분석'}
            </button>
          </div>
          {(error || obError) && <div className="ed-error-msg">{error || obError}</div>}
          {totalCount > 0 && <p className="ed-count-badge">총 {totalCount}건 수집됨</p>}
        </div>
      </header>

      {/* ── 메인: 좌 1/3 오피니언봇 | 우 2/3 사설 카드 ── */}
      <main className="viz-content">
        <div className="ed-main-layout">

          {/* ─── 좌측: 오피니언봇 패널 ─── */}
          <aside className="ob-panel">
            <div className="ob-panel-header">
              <h2>🤖 오피니언봇</h2>
              {opinionBot && <span className="ob-meta">{opinionBot.total_issues}개 이슈 · {opinionBot.total_editorials}건</span>}
            </div>

            {obLoading && (
              <div className="ob-loading">
                <div className="ob-spinner" />
                <p>Gemini AI가 사설을 분석하고 있습니다…</p>
                <p className="ob-loading-sub">이슈 클러스터링 → 논거 분석 → 비교 요약</p>
              </div>
            )}

            {!opinionBot && !obLoading && (
              <div className="ob-empty">
                <div className="ob-empty-icon">🔍</div>
                <p>사설을 수집한 후<br/><strong>오피니언봇 분석</strong> 버튼을<br/>눌러주세요.</p>
                <p className="ob-empty-sub">Gemini AI가 각 사설의 논거적 경향,<br/>프레임, 입장을 분석합니다.</p>
              </div>
            )}

            {opinionBot && !obLoading && (
              <div className="ob-results-scroll">
                {opinionBot.issues.map((issue, idx) => (
                  <div key={idx} className="ob-issue-card">
                    <div className="ob-issue-top">
                      <span className="ob-issue-badge">이슈 {idx + 1}</span>
                      <h4 className="ob-issue-name">{issue.issue_name}</h4>
                    </div>
                    <div className="ob-kw-row">
                      {issue.keywords.map((kw, ki) => <span key={ki} className="ob-kw-tag">{kw}</span>)}
                    </div>
                    {issue.issue_summary && (
                      <p className="ob-issue-summary">💬 {issue.issue_summary}</p>
                    )}
                    <div className="ob-ed-list">
                      {issue.editorials.map((ed, ei) => (
                        <div key={ei} className="ob-ed-item">
                          <div className="ob-ed-top-row">
                            <span className="ob-ed-press-badge">{ed.press}</span>
                            {ed.tone && <span className="ob-ed-tone" style={{ background: getToneColor(ed.tone) + '22', color: getToneColor(ed.tone) }}>{ed.tone}</span>}
                          </div>
                          {ed.key_argument && <p className="ob-ed-argument">"{ed.key_argument}"</p>}
                          <div className="ob-ed-meta-row">
                            {ed.frame && <span className="ob-ed-frame">🏷 {ed.frame}</span>}
                            {ed.stance && <span className="ob-ed-stance">📌 {ed.stance}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>

          {/* ─── 우측: 사설 카드 그리드 ─── */}
          <section className="ed-cards-section">
            <div className="ed-view-bar">
              <button className={`ed-view-btn ${viewMode === 'press' ? 'active' : ''}`} onClick={() => setViewMode('press')}>
                🏢 신문사별
              </button>
              <button
                className={`ed-view-btn ${viewMode === 'issue' ? 'active' : ''}`}
                onClick={() => setViewMode('issue')}
                disabled={!opinionBot}
                title={!opinionBot ? '오피니언봇 분석을 먼저 실행하세요' : ''}
              >
                📑 이슈별
              </button>
            </div>

            {viewMode === 'press' ? (
              /* ── 신문사별 보기 (기본) ── */
              <div className="ed-press-grid">
                {EDITORIAL_PAPERS.map(p => {
                  const list = editorials[p] || [];
                  if (list.length === 0) return null;
                  return (
                    <div key={p} className="ed-press-bigcard">
                      <h4 className="ed-press-name">{p} <span className="ed-press-cnt">{list.length}</span></h4>
                      <div className="ed-press-items">
                        {list.map((ed, i) => (
                          <CompactCard
                            key={ed.link || i}
                            editorial={ed}
                            press={p}
                            onClickTitle={() => setModal({ paper: p, editorial: ed })}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── 이슈별 보기 ── */
              <div className="ed-issue-grid">
                {opinionBot?.issues?.map((issue, idx) => (
                  <div key={idx} className="ed-issue-bigcard">
                    <div className="ed-issue-bigcard-header">
                      <span className="ob-issue-badge">이슈 {idx + 1}</span>
                      <h4>{issue.issue_name}</h4>
                      <span className="ed-press-cnt">{issue.editorials.length}건</span>
                    </div>
                    {issue.issue_summary && <p className="ed-issue-summary-text">{issue.issue_summary}</p>}
                    <div className="ed-press-items">
                      {issue.editorials.map((ed, ei) => (
                        <CompactCard
                          key={ed.link || ei}
                          editorial={{ ...ed, full_text: ed.full_text || ed.snippet }}
                          press={ed.press}
                          onClickTitle={() => setModal({ paper: ed.press, editorial: ed })}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ── 모달 ── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setModal(null)}>&times;</button>
            <span className="modal-press-label">{modal.paper}</span>
            <h2 className="modal-title">{modal.editorial.title}</h2>
            {modal.editorial.imageUrl && <img src={modal.editorial.imageUrl} alt="" className="modal-hero-img" />}
            <div className="modal-body-text">{modal.editorial.full_text || modal.editorial.description || modal.editorial.snippet}</div>
            <a href={modal.editorial.link} target="_blank" rel="noreferrer" className="modal-link-btn">네이버 원문 바로가기 →</a>
          </div>
        </div>
      )}

      <FloatingGuide />
    </div>
  );
}
