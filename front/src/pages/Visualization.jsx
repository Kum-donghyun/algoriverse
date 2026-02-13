import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import FloatingGuide from '../components/common/FloatingGuide';
import Breadcrumb from '../components/common/Breadcrumb';
import TrustBadge from '../components/common/TrustBadge';
import ExportButton from '../components/common/ExportButton';
import { calculateVisualizationTrustScore } from '../utils/trustScoreCalculator';
import '../styles/Visualization.css';

const API_BASE = 'http://localhost:5000';

const EMPHASIS_FRAME_LABELS = {
  conflict: '갈등 프레임',
  responsibility: '책임 프레임',
  economic: '경제 프레임',
  morality: '도덕 프레임',
  human_interest: '인간흥미 프레임',
  other: '기타',
};

const ISSUE_CLUSTERS = [
  { key: '전체', keywords: [] },
  { key: '기타', keywords: [] },
  { key: '정치적', keywords: ['정치', '정치적', '정치권'] },
  { key: '민주당', keywords: ['민주당'] },
  { key: '국민의힘', keywords: ['국민의힘', '국힘'] },
  { key: '대통령', keywords: ['대통령', '대통령이', '대통령은', '윤석열', '윤 대통령'] },
  { key: '이재명', keywords: ['이재명'] },
  { key: '수사', keywords: ['수사', '기소', '압수수색', '검찰', '송치'] },
  { key: '의혹', keywords: ['의혹', '비리', '논란'] },
  { key: '특정', keywords: ['특정', '특정인', '특정세력'] },
  { key: '없어', keywords: [] },
];

const getFrameLabel = (key) => {
  if (!key) return '';
  return EMPHASIS_FRAME_LABELS[key] || key;
};

const safeLower = (s) => (typeof s === 'string' ? s.toLowerCase() : '');

const decodeEntities = (s = '') =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

const cleanTitle = (s) => (typeof s === 'string' ? decodeEntities(s) : s);
const formatTag = (t) => decodeEntities(t || '');
const escapeForRegex = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const splitSentences = (text = '') =>
  decodeEntities(text)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

const ensureEvidenceSentences = (article, baseKeyword = '', extraKeywords = []) => {
  const existing = Array.isArray(article?.evidence_sentences) ? article.evidence_sentences.filter(Boolean) : [];
  if (existing.length >= 3) return existing.slice(0, 3);

  const body = `${article?.title || ''} ${article?.description_full || article?.description || article?.full_text || ''}`;
  const sentences = splitSentences(body);
  const loweredTargets = [baseKeyword, ...extraKeywords].filter(Boolean).map((t) => safeLower(decodeEntities(t)));
  const picks = [];

  sentences.forEach((s) => {
    if (!s) return;
    const lower = safeLower(s);
    if (loweredTargets.some((t) => t && lower.includes(t))) picks.push(s);
  });

  if (!picks.length && sentences[0]) picks.push(sentences[0]);
  if (sentences[1]) picks.push(sentences[1]);
  if (sentences[2]) picks.push(sentences[2]);

  const merged = [...existing];
  picks.forEach((s) => {
    if (s && !merged.includes(s)) merged.push(s);
  });

  return merged.slice(0, 3);
};

const hasFrameData = (frameSet) => {
  if (!frameSet || typeof frameSet !== 'object') return false;
  return Object.values(frameSet).some((arr) => Array.isArray(arr) && arr.length > 0);
};

const buildFallbackFrameSet = (articles = [], baseKeyword = '', extraKeywords = []) => {
  const out = {};
  (Array.isArray(articles) ? articles : []).forEach((article) => {
    const keyCandidate = article?.__frame_key || article?.frame_key || article?.frame_label || 'other';
    const key = typeof keyCandidate === 'string' && keyCandidate.trim() ? keyCandidate : 'other';
    const evidence = ensureEvidenceSentences(article, baseKeyword, extraKeywords);
    const enriched = {
      ...article,
      __frame_key: key,
      frame_key: key,
      frame_label: getFrameLabel(key),
      evidence_sentences: evidence,
    };
    if (!out[key]) out[key] = [];
    out[key].push(enriched);
  });
  return out;
};

const buildFrameLookup = (frameSet) => {
  const map = new Map();
  if (!frameSet || typeof frameSet !== 'object') return map;

  Object.entries(frameSet).forEach(([frameKey, items]) => {
    (Array.isArray(items) ? items : []).forEach((article) => {
      const linkKey = article?.link || article?.originallink;
      if (!linkKey) return;
      map.set(linkKey, {
        ...article,
        __frame_key: frameKey,
        frame_key: article.frame_key || frameKey,
      });
    });
  });

  return map;
};

const mergeArticlesWithFrameEvidence = (articles = [], frameLookup, baseKeyword = '', extraKeywords = []) => {
  if (!Array.isArray(articles)) return [];
  return articles.map((article) => {
    const linkKey = article?.link || article?.originallink;
    const fromFrame = linkKey ? frameLookup.get(linkKey) : null;
    const merged = fromFrame ? { ...article, ...fromFrame } : article;
    const link = merged?.link || merged?.originallink || linkKey;
    return {
      ...merged,
      link,
      evidence_sentences: ensureEvidenceSentences(merged, baseKeyword, extraKeywords),
      __frame_key: merged.__frame_key || merged.frame_key,
    };
  });
};

const classifyArticlesToIssues = (articles = [], clusters = []) => {
  const base = {};
  
  // 클러스터에 articleLinks가 있으면 그것을 사용하여 분류
  clusters.forEach((cluster) => {
    const { key, articleLinks } = cluster;
    
    if (key === '전체') {
      base[key] = articles;
    } else if (Array.isArray(articleLinks) && articleLinks.length > 0) {
      // articleLinks를 사용하여 기사 매칭
      base[key] = articles.filter(article => {
        const link = article.link || article.originallink;
        return link && articleLinks.includes(link);
      });
    } else {
      // articleLinks가 없으면 keywords로 매칭 (폴백)
      const { keywords } = cluster;
      base[key] = [];
      if (Array.isArray(keywords) && keywords.length > 0) {
        articles.forEach((a) => {
          const text = safeLower(
            decodeEntities(`${a?.title || ''} ${a?.description_full || a?.description || a?.full_text || ''}`)
          );
          if (keywords.some((kw) => text.includes(safeLower(kw)))) {
            base[key].push(a);
          }
        });
      }
    }
  });

  return base;
};

const annotateArticleBody = (article, baseKeyword, extraKeywords = []) => {
  const raw =
    decodeEntities(article?.description_full || article?.description || article?.full_text || '') || '';
  const evidences = ensureEvidenceSentences(article, baseKeyword, extraKeywords);

  const wrapFirst = (body, snippet, className) => {
    if (!snippet) return body;
    const safeSnippet = escapeForRegex(decodeEntities(snippet));
    if (!safeSnippet) return body;
    return body.replace(new RegExp(safeSnippet), `<span class="${className}">${decodeEntities(snippet)}</span>`);
  };

  let result = raw;
  const emphasisKeywords = ['비판', '공격', '공세', '대결'];
  if (evidences[0]) result = wrapFirst(result, evidences[0], 'eq-highlight');

  // 강조 프레이밍: 키워드 밑줄만 적용
  emphasisKeywords.forEach((kw) => {
    const safeKw = escapeForRegex(kw);
    result = result.replace(new RegExp(safeKw, 'g'), `<span class="em-highlight">${kw}</span>`);
  });

  const evSentence = evidences[2];
  if (evSentence) result = wrapFirst(result, evSentence, 'ev-highlight');

  // 문단 구분: 마침표 뒤 공백으로 문장 구분하고 2-3문장마다 문단 나누기
  const sentences = result.split(/(?<=[.!?])\s+/).filter(s => s.trim());
  const paragraphs = [];
  let currentParagraph = [];
  
  sentences.forEach((sentence, index) => {
    currentParagraph.push(sentence);
    // 2-3문장마다 또는 마지막 문장에서 문단 생성
    if (currentParagraph.length >= 2 || index === sentences.length - 1) {
      paragraphs.push(currentParagraph.join(' '));
      currentParagraph = [];
    }
  });
  
  // p 태그로 감싸서 문단 구분
  return paragraphs.map(p => `<p class="article-paragraph">${p}</p>`).join('');
};

const mergeByLink = (frameArticles, newsByLink) => {
  if (!Array.isArray(frameArticles)) return [];
  return frameArticles.map((a) => {
    const link = a?.link || a?.originallink;
    const enriched = link ? newsByLink.get(link) : null;
    const finalLink = link || enriched?.link || enriched?.originallink;
    return {
      ...(enriched || {}),
      ...a,
      link: finalLink,
      originallink: a?.originallink || enriched?.originallink,
      imageUrl: a?.imageUrl || a?.image_url || enriched?.imageUrl || enriched?.image_url,
      image_url: a?.image_url || a?.imageUrl || enriched?.image_url || enriched?.imageUrl,
      pubDate: a?.pubDate || enriched?.pubDate,
      description_full: a?.description_full || enriched?.description_full,
      description: a?.description || enriched?.description,
      full_text: a?.full_text || enriched?.full_text,
    };
  });
};

const ensureFrameEvidenceList = (articles = [], baseKeyword = '', extraKeywords = []) =>
  (Array.isArray(articles) ? articles : []).map((a) => {
    const evidence =
      Array.isArray(a?.evidence_sentences) && a.evidence_sentences.length > 0
        ? a.evidence_sentences
        : ensureEvidenceSentences(a, baseKeyword, extraKeywords);
    return { ...a, evidence_sentences: evidence };
  });

const articleHasImage = (article) => Boolean(article?.imageUrl || article?.image_url);

const deriveArticleTags = (article, issueKeywords = [], baseKeyword = '') => {
  if (!article) return [];
  const tags = [];
  const seen = new Set();
  const addTag = (t) => {
    const value = (t || '').toString().trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    tags.push(value);
  };

  addTag(baseKeyword);
  addTag(decodeEntities(getFrameLabel(article.__frame_key || article.frame_key || article.frame_label)));
  addTag(decodeEntities(article.source));

  const text = safeLower(
    decodeEntities(`${article.title || ''} ${article.description_full || article.description || article.full_text || ''}`)
  );
  issueKeywords.forEach((kw) => {
    const target = (kw || '').trim();
    if (!target) return;
    if (text.includes(safeLower(target))) addTag(target);
  });

  if (tags.length < 8) {
    const titleWords = (article.title || '').split(/\s+/).filter(Boolean).slice(0, 5);
    titleWords.forEach(addTag);
  }

  return tags.slice(0, 10);
};

const mergeNewsWithEnrichedImages = (baseArticles = [], enrichedArticles = []) => {
  if (!Array.isArray(baseArticles) || !Array.isArray(enrichedArticles)) return baseArticles || [];
  const enrichedMap = new Map();
  enrichedArticles.forEach((item) => {
    if (item?.link) enrichedMap.set(item.link, item);
  });

  return baseArticles.map((item) => {
    const extra = item?.link ? enrichedMap.get(item.link) : null;
    if (!extra) return item;
    return {
      ...extra,
      ...item,
      imageUrl: item?.imageUrl || item?.image_url || extra?.imageUrl || extra?.image_url,
      image_url: item?.image_url || item?.imageUrl || extra?.image_url || extra?.imageUrl,
    };
  });
};

const enrichNewsImages = async (articles, keyword) => {
  if (!Array.isArray(articles)) return [];

  const hasAnyImage = articles.some(articleHasImage);
  const shouldFetch = !articles.length || !hasAnyImage;
  if (!shouldFetch) return articles;

  try {
    const res = await fetch(`${API_BASE}/api/news/analyzed/${encodeURIComponent(keyword)}`);
    if (!res.ok) return articles;
    const enriched = await res.json();
    if (Array.isArray(enriched) && enriched.length) {
      const merged = articles.length ? mergeNewsWithEnrichedImages(articles, enriched) : enriched;
      return merged;
    }
  } catch {
    // ignore enrichment failure
  }

  return articles;
};

const Visualization = ({ keyword, onBack }) => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [viewMode, setViewMode] = useState('frame'); // 'frame' | 'issue'

  const [frameSetRaw, setFrameSetRaw] = useState(null); // object: frameKey -> articles
  const [newsArticles, setNewsArticles] = useState([]); // array

  const [activeFrameTab, setActiveFrameTab] = useState('전체');
  const [activeIssueTab, setActiveIssueTab] = useState('전체');
  const [searchTerm, setSearchTerm] = useState('');

  const [issueKeywords, setIssueKeywords] = useState([]);
  const [issueClusters, setIssueClusters] = useState([
    { key: '전체', label: '전체', keywords: [], count: 0 }
  ]);
  const [loadingClusters, setLoadingClusters] = useState(false);

  const [modalArticle, setModalArticle] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isModalExpanded, setIsModalExpanded] = useState(false);
  
  const contentRef = useRef(null);
  const evidenceSectionRef = useRef(null);

  // URL 파라미터 확인 및 자동 이슈 탭 활성화
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const autoOpen = params.get('autoOpen');
    
    if (autoOpen === 'issue') {
      setViewMode('issue');
      console.log('워드 클라우드에서 이동: 이슈 탭 자동 활성화');
    }
  }, [location.search]);

  useEffect(() => {
    const loadLexicon = async () => {
      try {
        const res = await fetch('/lexicon_expanded_preview.json');
        if (!res.ok) return;
        const json = await res.json();
        if (Array.isArray(json?.issue_keywords)) {
          setIssueKeywords(json.issue_keywords);
        }
      } catch {
        // ignore
      }
    };
    loadLexicon();
  }, []);

  useEffect(() => {
    if (!keyword) {
      setError('분석할 키워드가 제공되지 않았습니다.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        let nextFrameSet = null;
        let nextNews = [];

        const [frameRes, newsRes] = await Promise.allSettled([
          fetch(`${API_BASE}/api/news/frame-set/${encodeURIComponent(keyword)}`),
          fetch(`${API_BASE}/api/news/news-set/${encodeURIComponent(keyword)}`),
        ]);

        const frameOk = frameRes.status === 'fulfilled' && frameRes.value.ok;
        const newsOk = newsRes.status === 'fulfilled' && newsRes.value.ok;

        if (frameOk) {
          const frameJson = await frameRes.value.json();
          nextFrameSet = frameJson;
        }

        if (newsOk) {
          const newsJson = await newsRes.value.json();
          nextNews = Array.isArray(newsJson) ? newsJson : [];
        }

        if (!frameOk && !newsOk) {
          const fallback = await fetch(`${API_BASE}/api/news/analyzed/${encodeURIComponent(keyword)}`);
          if (!fallback.ok) throw new Error('Failed to load analyzed news set.');
          const data = await fallback.json();
          if (Array.isArray(data)) {
            nextNews = data;
          } else if (data && typeof data === 'object') {
            nextFrameSet = data;
          }
        }

        nextNews = await enrichNewsImages(nextNews, keyword);
        if (!hasFrameData(nextFrameSet) && Array.isArray(nextNews) && nextNews.length > 0) {
          nextFrameSet = buildFallbackFrameSet(nextNews, keyword, issueKeywords);
        }

        setFrameSetRaw(nextFrameSet);
        setNewsArticles(nextNews);

        // 실시간 이슈 클러스터 추출
        if (nextNews.length > 0) {
          extractIssueClusters(nextNews, keyword);
        }
      } catch (err) {
        setError(err?.message || '데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [keyword]);

  // 실시간 이슈 클러스터 추출 함수
  const extractIssueClusters = async (articles, searchKeyword) => {
    setLoadingClusters(true);
    try {
      const res = await fetch(`${API_BASE}/api/news/extract-issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles, keyword: searchKeyword })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.clusters && Array.isArray(data.clusters)) {
          setIssueClusters(data.clusters);
        }
      }
    } catch (err) {
      console.error('이슈 클러스터 추출 실패:', err);
    } finally {
      setLoadingClusters(false);
    }
  };

  const frameLookup = useMemo(() => buildFrameLookup(frameSetRaw), [frameSetRaw]);

  const enrichedNewsArticles = useMemo(
    () => mergeArticlesWithFrameEvidence(newsArticles, frameLookup, keyword, issueKeywords),
    [newsArticles, frameLookup, keyword, issueKeywords]
  );

  const newsByLink = useMemo(() => {
    const m = new Map();
    for (const a of enrichedNewsArticles) {
      const key = a?.link || a?.originallink;
      if (key) m.set(key, a);
    }
    return m;
  }, [enrichedNewsArticles]);

  const frameTabs = useMemo(() => {
    const keys = frameSetRaw && typeof frameSetRaw === 'object' ? Object.keys(frameSetRaw) : [];
    return ['전체', ...keys];
  }, [frameSetRaw]);

  const frameTabCounts = useMemo(() => {
    const out = {};
    if (!frameSetRaw || typeof frameSetRaw !== 'object') {
      out['전체'] = 0;
      return out;
    }
    let total = 0;
    for (const k of Object.keys(frameSetRaw)) {
      const arr = Array.isArray(frameSetRaw[k]) ? frameSetRaw[k] : [];
      out[k] = arr.length;
      total += arr.length;
    }
    out['전체'] = total;
    return out;
  }, [frameSetRaw]);

  const frameArticles = useMemo(() => {
    if (!frameSetRaw || typeof frameSetRaw !== 'object') return [];
    if (activeFrameTab === '전체') {
      const all = [];
      for (const k of Object.keys(frameSetRaw)) {
        const arr = Array.isArray(frameSetRaw[k]) ? frameSetRaw[k] : [];
        all.push(...arr.map((x) => ({ ...x, __frame_key: k })));
      }
      return ensureFrameEvidenceList(mergeByLink(all, newsByLink), keyword, issueKeywords);
    }
    const list = Array.isArray(frameSetRaw[activeFrameTab]) ? frameSetRaw[activeFrameTab] : [];
    return ensureFrameEvidenceList(
      mergeByLink(list.map((x) => ({ ...x, __frame_key: activeFrameTab })), newsByLink),
      keyword,
      issueKeywords
    );
  }, [frameSetRaw, activeFrameTab, newsByLink, keyword, issueKeywords]);

  const issueMap = useMemo(() => classifyArticlesToIssues(enrichedNewsArticles, issueClusters), [enrichedNewsArticles, issueClusters]);

  const activeArticles = useMemo(() => {
    const list = viewMode === 'frame'
      ? frameArticles
      : (issueMap[activeIssueTab] || []);

    if (!searchTerm) return list;
    const term = safeLower(searchTerm);
    return list.filter((a) => {
      const t = safeLower(a?.title);
      const d = safeLower(a?.description_full || a?.description || a?.full_text || '');
      return t.includes(term) || d.includes(term);
    });
  }, [viewMode, frameArticles, issueMap, activeIssueTab, searchTerm]);

  const highlightText = (text, target) => {
    if (!target || !text) return text;
    const regex = new RegExp(`(${target})`, 'gi');
    return text.replace(regex, '<b class="mark-text">$1</b>');
  };

  const handleEvidenceJump = (e) => {
    if (
      e.target &&
      (e.target.closest('.eq-highlight') ||
        e.target.closest('.ev-highlight') ||
        e.target.closest('.mark-text')) &&
      evidenceSectionRef.current
    ) {
      evidenceSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const averageArticleLength = useMemo(() => {
    if (!activeArticles.length) return 0;
    const totalLength = activeArticles.reduce((sum, article) => {
      const body = article.description_full || article.description || article.full_text || '';
      return sum + (body?.length || 0);
    }, 0);
    return Math.round(totalLength / activeArticles.length);
  }, [activeArticles]);

  const openModal = (article) => {
    setModalArticle(article);
    setShowModal(true);
    setIsModalExpanded(false);
  };

  const openOriginalLink = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const closeModal = () => {
    setShowModal(false);
    setModalArticle(null);
    setIsModalExpanded(false);
  };

  const modalArticleIndex = useMemo(() => {
    if (!modalArticle) return -1;
    return activeArticles.findIndex((a) => a === modalArticle);
  }, [modalArticle, activeArticles]);

  const modalTags = useMemo(() => deriveArticleTags(modalArticle, issueKeywords, keyword), [modalArticle, issueKeywords, keyword]);
  const EMPHASIS_PROMPT = "-비판/공격/공세 등 '대결'이 부각되는가? (단서: 비판)";

  const displayDate = (article) => {
    if (!article?.pubDate) return '';
    const parts = article.pubDate.split(' ');
    return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0];
  };

  if (loading) return <div className="viz-container loading-state"><h1>AI가 분석 중입니다...</h1></div>;
  if (error) return <div className="viz-container loading-state"><h1>{error}</h1></div>;

  return (
    <div className="viz-container" ref={contentRef}>
      <Breadcrumb selectedKeyword={keyword} />
      <header className="viz-header">
        <div className="masthead">
          <h1>뉴스 프레임 분석</h1>
          <p>프레임(모델 분류) / 이슈(클러스터) 탭을 분리했습니다</p>
          <div className="badge-row">
            <span className="keyword-badge">검색어: "{keyword}"</span>
            <span className="keyword-badge tip">팁: 기사 카드 클릭 시 원문 이동</span>
            <TrustBadge 
              {...calculateVisualizationTrustScore(enrichedNewsArticles, keyword)}
            />
            <ExportButton 
              contentRef={contentRef}
              data={{
                title: `뉴스 프레임 분석: ${keyword}`,
                subtitle: `${enrichedNewsArticles.length}개 기사 분석 결과`,
                keyword,
                trustScore: calculateVisualizationTrustScore(enrichedNewsArticles, keyword),
                articles: enrichedNewsArticles.map(a => ({
                  title: a.title || 'No title',
                  press: a.press || '정보 없음',
                  pubDate: a.pubDate || '정보 없음',
                  bias: a.model_result?.predicted_label || '분석 중',
                  link: a.link || a.originallink
                }))
              }}
              filename={`분석결과_${keyword}_${new Date().toLocaleDateString()}`}
            />
          </div>

          <div className="tabs-group" style={{ marginBottom: 8 }}>
            <button
              className={`tab-btn ${viewMode === 'frame' ? 'active' : ''}`}
              onClick={() => setViewMode('frame')}
            >
              프레임
            </button>
            <button
              className={`tab-btn ${viewMode === 'issue' ? 'active' : ''}`}
              onClick={() => setViewMode('issue')}
            >
              이슈(클러스터)
            </button>
          </div>
          
          <div className="search-bar-box">
            <input 
              type="text" 
              className="search-input" 
              placeholder="기사 제목이나 내용으로 검색하세요..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="tabs-group">
            {viewMode === 'frame'
              ? frameTabs.map((k) => (
                  <button
                    key={k}
                    className={`tab-btn ${activeFrameTab === k ? 'active' : ''}`}
                    onClick={() => setActiveFrameTab(k)}
                  >
                    {k === '전체' ? '전체' : getFrameLabel(k)} ({frameTabCounts[k] || 0})
                  </button>
                ))
              : issueClusters.map((cluster) => (
                  <button
                    key={cluster.key}
                    className={`tab-btn ${activeIssueTab === cluster.key ? 'active' : ''}`}
                    onClick={() => setActiveIssueTab(cluster.key)}
                  >
                    {cluster.label} ({cluster.count})
                  </button>
                ))}
            {viewMode === 'issue' && loadingClusters && (
              <span style={{ color: 'white', fontSize: '0.9em', marginLeft: '10px' }}>이슈 추출 중...</span>
            )}
          </div>
        </div>
      </header>

      <main className="viz-content">
        <div className="frame-info-card">
          <div className="frame-header-line">
            <h2 className="frame-title">
              📌 {viewMode === 'frame'
                ? (activeFrameTab === '전체' ? '전체' : getFrameLabel(activeFrameTab))
                : activeIssueTab}{' '}분석
            </h2>
            <div className="frame-stats">
              <span>총 기사 수: <strong>{activeArticles.length}</strong></span>
              <span> 평균 길이: <strong>{averageArticleLength}자</strong></span>
            </div>
          </div>
        </div>

        <div className="articles-grid">
          {activeArticles.map((article, i) => (
            <div
              key={`${article?.link || 'no-link'}-${i}`}
              className="article-card"
            >
              <div className="card-image-wrap" style={{ backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', overflow: 'hidden' }}>
                { (article.imageUrl || article.image_url) ? (
                  <a
                    href={article.link || article.originallink || '#'}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => { if (!article.link && !article.originallink) e.preventDefault(); }}
                    style={{ display: 'block', width: '100%', height: '100%' }}
                  >
                    <img 
                      src={article.imageUrl || article.image_url} 
                      alt="news" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentNode.innerHTML = '<div style="color:#999;font-size:14px;">이미지를 불러올 수 없습니다</div>';
                      }}
                    />
                  </a>
                ) : (
                  <div style={{ color: '#999', fontSize: '14px' }}>관련 이미지 없음</div>
                )}
              </div>
              <div className="card-header-bar">
                {article.link ? (
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noreferrer"
                    className="card-title link-title"
                    dangerouslySetInnerHTML={{ __html: highlightText(cleanTitle(article.title), keyword) }}
                  />
                ) : (
                  <h3 className="card-title" dangerouslySetInnerHTML={{ __html: highlightText(cleanTitle(article.title), keyword) }} />
                )}
              </div>
              <div className="card-body">
                <p className="card-description" dangerouslySetInnerHTML={{ 
                  __html: highlightText((article.description_full || article.description || "").slice(0, 160) + "...", keyword) 
                }} />
                <div className="card-footer-tags">
                  <span className="tag frame-tag">
                    {viewMode === 'frame'
                      ? getFrameLabel(article.__frame_key || activeFrameTab)
                      : activeIssueTab}
                  </span>
                  <span className="tag">기사 #{i + 1}</span>
                  <span className="tag date">{article.pubDate?.split(' ')[0]}</span>
                </div>

                <div className="card-more-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="card-link-actions">
                    <button className="summary-link-btn" onClick={() => { openModal(article); setIsModalExpanded(true); }}>
                      본문 더보기
                    </button>
                    {article.link && (
                      <a className="summary-link-btn" href={article.link} target="_blank" rel="noreferrer">
                        원문 링크
                      </a>
                    )}
                  </div>
                  <div className="summary-tags">
                    {deriveArticleTags(article, issueKeywords, keyword).map((tag) => (
                      <span key={`${article.link || i}-${tag}`} className="summary-tag">#{formatTag(tag)}</span>
                    ))}
                  </div>
                  <div className="card-evidence-box">
                    <h4 className="evidence-title inline">프레임 근거</h4>
                    {Array.isArray(article.evidence_sentences) && article.evidence_sentences.length > 0 ? (
                      <p className="card-evidence-text" dangerouslySetInnerHTML={{ __html: highlightText(article.evidence_sentences[0], keyword) }} />
                    ) : (
                      <p className="card-evidence-text muted">근거 문장을 찾지 못했습니다.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 모달: 이미지 2번 스타일 반영 (본문 아래 해시태그, 버튼, 근거 추가) */}
      {showModal && modalArticle && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className={`modal-card ${isModalExpanded ? 'expanded' : 'compact'}`} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
                <button className="close-btn" onClick={closeModal}>×</button>
              <div className="modal-meta-row">
                <span className="modal-date">{modalArticle.pubDate?.split(' ')[0]}</span>
                {modalArticle.source && <span className="modal-source">{modalArticle.source}</span>}
              </div>
              <h3 className="modal-main-title">{cleanTitle(modalArticle.title)}</h3>
            </div>

            <div className="modal-summary-card">
              <div className="summary-top-row">
                <div className="summary-pill-row">
                  <span className="summary-pill primary">{getFrameLabel(modalArticle.__frame_key || modalArticle.frame_key || activeFrameTab)}</span>
                  <span className="summary-pill muted">기사 #{modalArticleIndex >= 0 ? modalArticleIndex + 1 : activeArticles.indexOf(modalArticle) + 1}</span>
                </div>
                <div className="summary-links">
                  {modalArticle.link && (
                    <a className="summary-link-btn" href={modalArticle.link} target="_blank" rel="noreferrer">원문 링크</a>
                  )}
                </div>
              </div>
                {/* 상단 태그 행 제거 (아래 핵심 프레이밍 키워드 섹션만 사용) */}
              </div>

            <div className="modal-body">
              {isModalExpanded && (
                <section className="modal-section keyword-section">
                  <h4 className="section-title">핵심 프레이밍 키워드</h4>
                  <div className="summary-tags hero-tags">
                    {(modalTags.length ? modalTags : [keyword]).filter(Boolean).map((tag) => (
                      <span key={`hero-${tag}`} className="summary-tag">#{formatTag(tag)}</span>
                    ))}
                  </div>
                </section>
              )}

              <section className="modal-section link-section expand-target panel-block">
                <div className="section-header-inline">
                  <span className="section-label">기사 본문</span>
                </div>
                <p className="section-helper">밑줄 표시된 문구를 클릭하면 해당 프레이밍 근거로 이동합니다.</p>
                {(modalArticle.imageUrl || modalArticle.image_url) && (
                  <div className="modal-image-wrap large">
                    <img
                      src={modalArticle.imageUrl || modalArticle.image_url}
                      alt="news"
                      onError={(e) => (e.target.src = 'https://via.placeholder.com/800x420?text=No+Image')}
                    />
                  </div>
                )}
                <div className="modal-text-container" onClick={handleEvidenceJump}>
                   <p className="modal-text" dangerouslySetInnerHTML={{ 
                     __html: annotateArticleBody(modalArticle, keyword, issueKeywords) 
                   }} />
                </div>
              </section>

              <section className="modal-section framing-type-section expand-target panel-block">
                <h4 className="section-title">프레이밍 유형</h4>
                <div className="framing-card-grid">
                  <div className="framing-card equivalence">
                    <div className="framing-title">등가 프레이밍(손익/비교/선택/수치)</div>
                    <p className="framing-desc" dangerouslySetInnerHTML={{
                      __html: Array.isArray(modalArticle.evidence_sentences) && modalArticle.evidence_sentences[0]
                        ? highlightText(modalArticle.evidence_sentences[0], keyword)
                        : '등가 프레이밍 문장을 찾지 못했습니다.'
                    }} />
                </div>
                <div className="framing-card emphasis">
                  <div className="framing-title">강조 프레이밍(질문지 단서)</div>
                  <p className="framing-desc" dangerouslySetInnerHTML={{
                      __html: EMPHASIS_PROMPT
                  }} />
                </div>
              </div>
            </section>

              <section ref={evidenceSectionRef} className="modal-section evidence-detail-section expand-target panel-block">
                <h4 className="evidence-title">근거 문장</h4>
                <div className="evidence-content-box">
                  <div className="evidence-sentences">
                    {Array.isArray(modalArticle.evidence_sentences) && modalArticle.evidence_sentences.length > 0 ? (
                      modalArticle.evidence_sentences.map((sentence, idx) => (
                        <p key={idx} className="e-sentence">
                          <span className="bullet">•</span>
                          <span dangerouslySetInnerHTML={{ __html: highlightText(sentence, keyword) }} />
                        </p>
                      ))
                    ) : (
                      <p className="e-sentence muted">기사 사용 프레임 분석 근거 문장을 찾지 못했습니다.</p>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      <div className="back-footer">
        <button onClick={onBack} className="main-btn">🏠 메인으로 가기</button>
      </div>
      
      <FloatingGuide />
    </div>
  );
};

export default Visualization;
