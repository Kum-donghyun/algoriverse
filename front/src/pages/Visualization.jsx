import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import FloatingGuide from '../components/common/FloatingGuide';
import Breadcrumb from '../components/common/Breadcrumb';
import TrustBadge from '../components/common/TrustBadge';
import ExportButton from '../components/common/ExportButton';
import { calculateVisualizationTrustScore } from '../utils/trustScoreCalculator';
import '../styles/Visualization.css';

const API_BASE = 'http://localhost:5000';

// ─── 4차원 15유형 프레임 메타데이터 ───
const FRAME_DIMENSIONS = {
    functional: {
        label: '기능적 차원', desc: '이슈 흐름 파악', color: '#6366f1',
        types: {
            definition:  { label_kr: '정의/해석', icon: '🔎', color: '#6366f1', bg: '#eef2ff' },
            cause:       { label_kr: '원인',      icon: '🔗', color: '#8b5cf6', bg: '#f5f3ff' },
            consequence: { label_kr: '결과/영향', icon: '📉', color: '#a78bfa', bg: '#ede9fe' },
            remedy:      { label_kr: '대책',      icon: '🛠️', color: '#7c3aed', bg: '#f5f3ff' },
        },
    },
    perspective: {
        label: '특정관점 차원', desc: '보도 시각', color: '#10b981',
        types: {
            social:          { label_kr: '사회',       icon: '👥', color: '#10b981', bg: '#ecfdf5' },
            economic:        { label_kr: '경제',       icon: '💰', color: '#059669', bg: '#ecfdf5' },
            policy:          { label_kr: '정책',       icon: '📋', color: '#0d9488', bg: '#f0fdfa' },
            morality:        { label_kr: '도덕성',     icon: '⚖️', color: '#f59e0b', bg: '#fffbeb' },
            responsibility:  { label_kr: '책임',       icon: '🎯', color: '#d97706', bg: '#fffbeb' },
            democratic:      { label_kr: '민주합의',   icon: '🤝', color: '#0ea5e9', bg: '#f0f9ff' },
            human_interest:  { label_kr: '인간적흥미', icon: '💬', color: '#ec4899', bg: '#fdf2f8' },
        },
    },
    situation: {
        label: '상태/상황 차원', desc: '이슈 분위기', color: '#ef4444',
        types: {
            conflict: { label_kr: '갈등',     icon: '⚔️', color: '#ef4444', bg: '#fef2f2' },
            crisis:   { label_kr: '위기/위험', icon: '🚨', color: '#dc2626', bg: '#fef2f2' },
        },
    },
    delivery: {
        label: '전달방식 차원', desc: '보도 형식', color: '#78716c',
        types: {
            accusation:  { label_kr: '의혹/고발',   icon: '🔍', color: '#78716c', bg: '#f5f5f4' },
            informative: { label_kr: '단순정보전달', icon: '📰', color: '#9ca3af', bg: '#f9fafb' },
        },
    },
};

const FRAME_META = {};
for (const dim of Object.values(FRAME_DIMENSIONS)) {
    for (const [key, meta] of Object.entries(dim.types)) {
        FRAME_META[key] = meta;
    }
}

const getFrameLabel = (key) => {
  if (!key) return '';
  const meta = FRAME_META[key];
  return meta ? `${meta.icon} ${meta.label_kr}` : key;
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
            decodeEntities(`${a?.title || ''} ${a?.full_text || a?.description_full || a?.description || ''}`)
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
    decodeEntities(article?.full_text || article?.description_full || article?.description || '') || '';
  
  // 백엔드에서 15유형 프레임의 matched_cues가 있으면 이를 활용해 하이라이트
  let emphasisKeywords = ['비판', '공격', '공세', '대결'];
  if (Array.isArray(article.evidence)) {
    article.evidence.forEach(ev => {
      if (Array.isArray(ev.matched_cues)) {
        emphasisKeywords.push(...ev.matched_cues);
      }
    });
  }
  
  const evidences = ensureEvidenceSentences(article, baseKeyword, extraKeywords);

  const wrapFirst = (body, snippet, className) => {
    if (!snippet) return body;
    const safeSnippet = escapeForRegex(decodeEntities(snippet));
    if (!safeSnippet) return body;
    return body.replace(new RegExp(safeSnippet), `<span class="${className}">${decodeEntities(snippet)}</span>`);
  };

  let result = raw;
  if (evidences[0]) result = wrapFirst(result, evidences[0], 'eq-highlight');

  // 중복 키워드 제거
  emphasisKeywords = [...new Set(emphasisKeywords)];

  // 강조 프레이밍/매칭 키워드 밑줄 적용
  emphasisKeywords.forEach((kw) => {
    const safeKw = escapeForRegex(kw);
    result = result.replace(new RegExp(safeKw, 'g'), `<span class="em-highlight">${kw}</span>`);
  });

  const evSentence = evidences[2];
  if (evSentence) result = wrapFirst(result, evSentence, 'ev-highlight');

  // 백엔드에서 내려온 문단 구분이 반영된 full_text가 있다면, 이를 최대한 보존
  // \n\n 등 명시적 구분이 있으면 그것으로 나누고, 아니면 기존 2-3문장 로직 사용
  if (result.includes('\n')) {
    const splitByNewline = result.split(/\n+/).map(p => p.trim()).filter(Boolean);
    return splitByNewline.map(p => `<p class="article-paragraph" style="margin-bottom:12px;">${p}</p>`).join('');
  }

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
  const seen = new Set();
  const deduped = [];
  
  for (const a of frameArticles) {
    const link = a?.link || a?.originallink || a?.title;
    if (seen.has(link)) continue;
    seen.add(link);
    
    const enriched = link ? newsByLink.get(link) || Array.from(newsByLink.values()).find(en => en.title === a.title) : null;
    const finalLink = link || enriched?.link || enriched?.originallink;
    deduped.push({
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
    });
  }
  return deduped;
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
  const [activeDimTab, setActiveDimTab] = useState('전체');
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
    } else if (autoOpen === 'frame') {
      setViewMode('frame');
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

  // --- 데이터 로딩 (기존 AI 파이프라인은 비활성화 가능) ---
  // 백업된 AI 로직을 보존해두었으므로 여기선 모델 기반 자동 분석 호출을 옵션으로 제어합니다.
  const AI_DISABLED = true; // true로 두면 기존 모델 호출(extractIssueClusters 등)을 하지 않습니다.

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
        const res = await fetch(`${API_BASE}/api/issues/detail/${encodeURIComponent(keyword)}`);
        
        // 이슈 데이터가 없으면 fallback으로 넘길 수도 있지만,
        // 이제 issueController가 없으면 새로 수집 및 프레임 분류(15유형)를 수행합니다.
        if (!res.ok) {
          throw new Error('이슈 데이터를 불러올 수 없습니다.');
        }

        const data = await res.json();
        
        let nextNews = data.articles || [];
        let nextFrameSet = data.frameData?.byFrame || null;

        // frameSetRaw를 { type: [articles] } 형태로 변환
        if (!nextFrameSet && data.frameData) {
           nextFrameSet = data.frameData.byFrame;
        }

        // 혹시나 이미지 보완이 필요하다면 (issueController에서도 이미 하지만 fallback)
        nextNews = await enrichNewsImages(nextNews, keyword);

        setFrameSetRaw(nextFrameSet);
        setNewsArticles(nextNews);

        // 연관 키워드를 이슈 탭용으로 (전체, 기타 외)
        if (data.relatedKeywords) {
          const clusters = [
            { key: '전체', label: '전체', keywords: [], count: nextNews.length }
          ];
          data.relatedKeywords.slice(0, 8).forEach(kw => {
            clusters.push({
              key: kw.word,
              label: kw.word,
              keywords: [kw.word],
              count: kw.count || 0
            });
          });
          setIssueClusters(clusters);
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
    if (!frameSetRaw || typeof frameSetRaw !== 'object') return ['전체'];
    const tabs = ['전체'];
    if (activeDimTab === '전체') {
      tabs.push(...Object.keys(frameSetRaw).filter(k => Array.isArray(frameSetRaw[k]) && frameSetRaw[k].length > 0));
    } else {
      const dimTypes = FRAME_DIMENSIONS[activeDimTab]?.types || {};
      tabs.push(...Object.keys(dimTypes).filter(k => Array.isArray(frameSetRaw[k]) && frameSetRaw[k].length > 0));
    }
    return tabs;
  }, [frameSetRaw, activeDimTab]);

  const frameTabCounts = useMemo(() => {
    const out = {};
    if (!frameSetRaw || typeof frameSetRaw !== 'object') {
      out['전체'] = 0;
      return out;
    }
    let total = 0;
    // 고유 기사들 추적
    const allUnique = new Set();
    for (const k of Object.keys(frameSetRaw)) {
      const arr = Array.isArray(frameSetRaw[k]) ? frameSetRaw[k] : [];
      out[k] = arr.length;
      arr.forEach(a => allUnique.add(a.link || a.title));
    }
    out['전체'] = allUnique.size;
    return out;
  }, [frameSetRaw]);

  const frameArticles = useMemo(() => {
    if (!frameSetRaw || typeof frameSetRaw !== 'object') return [];
    if (activeFrameTab === '전체') {
      const all = [];
      const keysToUse = activeDimTab === '전체' 
        ? Object.keys(frameSetRaw) 
        : Object.keys(FRAME_DIMENSIONS[activeDimTab]?.types || {});
        
      for (const k of keysToUse) {
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
  }, [frameSetRaw, activeFrameTab, activeDimTab, newsByLink, keyword, issueKeywords]);

  const issueMap = useMemo(() => classifyArticlesToIssues(enrichedNewsArticles, issueClusters), [enrichedNewsArticles, issueClusters]);

  const activeArticles = useMemo(() => {
    const list = viewMode === 'frame'
      ? frameArticles
      : (issueMap[activeIssueTab] || []);

    if (!searchTerm) return list;
    const term = safeLower(searchTerm);
    return list.filter((a) => {
      const t = safeLower(a?.title);
      const d = safeLower(a?.full_text || a?.description_full || a?.description || '');
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
            {/* 별도의 사설 페이지로 이동하도록 UI에서 제거됨 */}
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
            {viewMode === 'frame' ? (
              <>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px', width: '100%' }}>
                  <button
                    className={`tab-btn ${activeDimTab === '전체' ? 'active' : ''}`}
                    onClick={() => { setActiveDimTab('전체'); setActiveFrameTab('전체'); }}
                  >
                    전체 차원
                  </button>
                  {Object.entries(FRAME_DIMENSIONS).map(([dimKey, dim]) => (
                    <button
                      key={dimKey}
                      className={`tab-btn ${activeDimTab === dimKey ? 'active' : ''}`}
                      onClick={() => { setActiveDimTab(dimKey); setActiveFrameTab('전체'); }}
                    >
                      {dim.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%' }}>
                  {frameTabs.map((k) => (
                    <button
                      key={k}
                      className={`tab-btn ${activeFrameTab === k ? 'active' : ''}`}
                      onClick={() => setActiveFrameTab(k)}
                    >
                      {k === '전체' ? '전체' : getFrameLabel(k)} ({frameTabCounts[k] || 0})
                    </button>
                  ))}
                </div>
              </>
            ) : (
                issueClusters.map((cluster) => (
                  <button
                    key={cluster.key}
                    className={`tab-btn ${activeIssueTab === cluster.key ? 'active' : ''}`}
                    onClick={() => setActiveIssueTab(cluster.key)}
                  >
                    {cluster.label} ({cluster.count})
                  </button>
                ))
            )}
            {viewMode === 'issue' && loadingClusters && (
              <span style={{ color: 'white', fontSize: '0.9em', marginLeft: '10px' }}>이슈 추출 중...</span>
            )}
            {viewMode === 'issue' && (
              <div style={{ marginLeft: 12 }}>
                <button
                  className="main-btn"
                  onClick={() => extractIssueClusters(newsArticles, keyword)}
                  disabled={loadingClusters || !newsArticles.length}
                >이슈 추출</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="viz-content">
          <>
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
                      <span className="tag frame-tag" style={{
                        background: FRAME_META[article.frame]?.bg || '',
                        color: FRAME_META[article.frame]?.color || ''
                      }}>
                        {viewMode === 'frame'
                          ? (article.frame ? `${FRAME_META[article.frame]?.icon || ''} ${FRAME_META[article.frame]?.label_kr || article.frame}` : getFrameLabel(article.__frame_key || activeFrameTab))
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
                        {Array.isArray(article.evidence) && article.evidence.length > 0 ? (
                          <p className="card-evidence-text" dangerouslySetInnerHTML={{ __html: highlightText(article.evidence[0].evidence, keyword) }} />
                        ) : Array.isArray(article.evidence_sentences) && article.evidence_sentences.length > 0 ? (
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
          </>
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
                <div className="summary-pill-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {modalArticle.frames ? (
                    modalArticle.frames.map((f, idx) => {
                      const meta = FRAME_META[f.type] || { color: '#6b7280', bg: '#f9fafb', icon: '📄', label_kr: f.type };
                      return (
                        <span key={idx} className="summary-pill" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}` }}>
                          {meta.icon} {meta.label_kr} {f.score ? `${Math.round(f.score * 100)}%` : ''}
                        </span>
                      );
                    })
                  ) : (
                    <span className="summary-pill primary">{getFrameLabel(modalArticle.__frame_key || modalArticle.frame_key || activeFrameTab)}</span>
                  )}
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
                <h4 className="section-title">분석된 프레임 유형</h4>
                <div className="framing-card-grid">
                  {modalArticle.frames ? (
                    modalArticle.frames.map((f, idx) => {
                      const meta = FRAME_META[f.type] || { color: '#6b7280', label_kr: f.type };
                      const evidenceObj = (modalArticle.evidence || []).find(e => e.frame === f.type);
                      return (
                        <div key={idx} className="framing-card" style={{ borderLeft: `4px solid ${meta.color}` }}>
                          <div className="framing-title" style={{ color: meta.color }}>
                            {meta.icon} {meta.label_kr} {f.score ? `(${Math.round(f.score * 100)}%)` : ''}
                          </div>
                          <p className="framing-desc" dangerouslySetInnerHTML={{
                            __html: evidenceObj 
                              ? highlightText(evidenceObj.evidence, keyword) 
                              : '해당 프레임에 대한 명시적 근거 문장을 찾지 못했습니다.'
                          }} />
                          {evidenceObj?.matched_cues && (
                            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                              매칭 키워드: {evidenceObj.matched_cues.join(', ')}
                            </p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </section>

              {(!modalArticle.frames) && (
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
              )}
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
