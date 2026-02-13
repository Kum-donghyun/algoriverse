#!/usr/bin/env python3
"""make_frame_kiwi.py

뉴스 프레이밍 분석 파이프라인 (모델 기반)

목표
- 기사(제목+본문)로부터 **핵심 키프레이즈**를 추출 (간단 TextRank)
- 프레임 이론 기반 2축 산출
  1) 강조 프레이밍(Emphasis framing): 갈등/책임/경제/도덕/인간흥미/기타
  2) 등가 프레이밍(Equivalence framing): 이득/손실/비교/선택/수치 강조
- (옵션) TF-IDF + KMeans로 이슈(클러스터) 신호 생성
- 결과를 `frame_set_{keyword}.json`으로 저장

입력/출력
- 입력: news_500_{keyword}.json (기본: 현재 작업 디렉터리)
- 출력: frame_set_{keyword}.json (기본: 현재 작업 디렉터리)

의존 패키지
- kiwipiepy (선택, 없으면 정규식 토큰화로 폴백)
- numpy, scikit-learn, joblib

사용 예
  python make_frame_kiwi.py 특검 --auto-train
  python make_frame_kiwi.py 특검 --model-dir frame_model --auto-train

주의
- 모델 파일이 없고 --auto-train을 켜지 않으면, 약지도(weak supervision) 기반 규칙만으로 분류합니다.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

import numpy as np
from joblib import dump, load

try:
    from kiwipiepy import Kiwi

    kiwi = Kiwi()
    kiwi_available = True
except Exception:
    kiwi = None
    kiwi_available = False

from sklearn.cluster import MiniBatchKMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression


EMPHASIS_FRAMES = [
    "conflict",
    "responsibility",
    "economic",
    "morality",
    "human_interest",
    "other",
]

FRAME_LABEL_KR = {
    "conflict": "갈등 프레임",
    "responsibility": "책임 프레임",
    "economic": "경제 프레임",
    "morality": "도덕 프레임",
    "human_interest": "인간흥미 프레임",
    "other": "기타",
}

EQUIV_LABEL_KR = {
    "gain": "이득(positive) 프레이밍",
    "loss": "손실(negative) 프레이밍",
    "comparison": "비교/대조 프레이밍",
    "choice": "선택/대안 프레이밍",
    "numbers": "수치/통계 강조",
}


_TAG_RE = re.compile(r"<[^>]+>")


def clean_text(text: Any) -> str:
    if not text:
        return ""
    s = str(text)
    s = _TAG_RE.sub(" ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def normalize_for_evidence(text: str) -> str:
    s = clean_text(text)
    if not s:
        return ""
    s = re.sub(r"\[(?:앵커|기자|인터뷰|속보|단독|영상|사진|자료|자막|해설|현장)\]", " ", s)
    s = re.sub(r"\([^\)]{0,24}=[^\)]{0,24}\)", " ", s)
    s = s.replace("][", " ")
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def split_sentences(text: str) -> list[str]:
    text = normalize_for_evidence(text)
    parts = re.split(r"[\n\r]+|(?<=[\.!?。？！])\s+", text)
    return [p.strip() for p in parts if p and p.strip()]


def _kiwi_tokens(text: str):
    if not kiwi_available:
        return []
    try:
        res = kiwi.analyze(text, top_n=1)
        if not res:
            return []
        tokens, _score = res[0]
        return [(t.form, t.tag) for t in tokens]
    except Exception:
        return []


def tokenize_for_tfidf(text: str) -> list[str]:
    text = clean_text(text)
    if not text:
        return []
    if kiwi_available:
        toks: list[str] = []
        for form, tag in _kiwi_tokens(text):
            if len(form) < 2:
                continue
            if tag.startswith("N"):
                toks.append(form)
            elif tag in ("VV", "VA"):
                toks.append(form)
        return toks
    return re.findall(r"[가-힣]{2,}", text)


def extract_noun_phrases(text: str, min_len: int = 2) -> list[str]:
    text = clean_text(text)
    if not text:
        return []
    if not kiwi_available:
        return [w for w in re.findall(r"[가-힣]{2,}", text) if len(w) >= min_len]

    morphs = _kiwi_tokens(text)
    out: list[str] = []
    buf: list[str] = []
    for form, tag in morphs:
        if tag.startswith("N") and len(form) >= min_len:
            buf.append(form)
        else:
            if buf:
                phrase = "".join(buf)
                if len(phrase) >= min_len:
                    out.append(phrase)
                buf = []
    if buf:
        phrase = "".join(buf)
        if len(phrase) >= min_len:
            out.append(phrase)
    return out


def textrank_keyphrases(text: str, top_k: int = 12, window: int = 4) -> list[str]:
    candidates = extract_noun_phrases(text)
    if not candidates:
        return []
    seq = [c for c in candidates if c]
    vocab = {c: i for i, c in enumerate(sorted(set(seq)))}
    n = len(vocab)
    if n == 0:
        return []

    adj = [defaultdict(float) for _ in range(n)]
    for i in range(len(seq)):
        wi = vocab[seq[i]]
        for j in range(i + 1, min(len(seq), i + window)):
            wj = vocab[seq[j]]
            if wi == wj:
                continue
            adj[wi][wj] += 1.0
            adj[wj][wi] += 1.0

    d = 0.85
    pr = np.ones(n, dtype=np.float64) / n
    for _ in range(25):
        new = np.ones(n, dtype=np.float64) * (1.0 - d) / n
        for u in range(n):
            s = sum(adj[u].values())
            if s <= 0:
                continue
            for v, w in adj[u].items():
                new[v] += d * pr[u] * (w / s)
        pr = new

    inv = {i: w for w, i in vocab.items()}
    ranked = sorted(range(n), key=lambda i: pr[i], reverse=True)
    return [inv[i] for i in ranked[:top_k]]


def detect_equivalence_frames(text: str) -> list[dict[str, Any]]:
    text = normalize_for_evidence(text)
    if not text:
        return []
    sents = split_sentences(text)

    gain_terms = ["혜택", "이득", "증가", "개선", "상승", "확대", "강화", "성장", "회복", "완화"]
    loss_terms = ["피해", "손실", "감소", "악화", "부담", "하락", "축소", "침체", "위기", "우려"]
    comp_terms = ["대비", "비교", "반면", "한편", "대조", "차이", "격차", "vs", "맞서"]
    choice_terms = ["선택", "대안", "방안", "옵션", "갈림길", "양자", "둘 중", "결정"]
    num_re = re.compile(r"\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b")

    def _find_sent(terms: list[str]):
        for s in sents:
            if any(t in s for t in terms if t):
                return s
        return None

    hits: list[dict[str, Any]] = []
    gain_sent = _find_sent(gain_terms)
    if gain_sent:
        hits.append({"type": "gain", "label_kr": EQUIV_LABEL_KR["gain"], "evidence": gain_sent[:140]})
    loss_sent = _find_sent(loss_terms)
    if loss_sent:
        hits.append({"type": "loss", "label_kr": EQUIV_LABEL_KR["loss"], "evidence": loss_sent[:140]})
    comp_sent = _find_sent(comp_terms)
    if comp_sent:
        hits.append({"type": "comparison", "label_kr": EQUIV_LABEL_KR["comparison"], "evidence": comp_sent[:140]})
    choice_sent = _find_sent(choice_terms)
    if choice_sent:
        hits.append({"type": "choice", "label_kr": EQUIV_LABEL_KR["choice"], "evidence": choice_sent[:140]})

    for s in sents:
        if num_re.search(s):
            hits.append({"type": "numbers", "label_kr": EQUIV_LABEL_KR["numbers"], "evidence": s[:140]})
            break

    return hits


FRAME_CUES = {
    "conflict": ["공방", "대립", "갈등", "충돌", "비판", "반발", "논쟁", "맞서", "공격", "설전", "파행", "장외"],
    "responsibility": ["책임", "원인", "책임론", "사과", "규명", "조사", "수사", "처벌", "관리", "대책", "책무", "감사"],
    "economic": ["예산", "세금", "물가", "금리", "고용", "투자", "경제", "시장", "성장", "부담", "지원", "보조", "손실"],
    "morality": ["도덕", "윤리", "정의", "공정", "부패", "비리", "특혜", "정당", "명분", "가치", "인권"],
    "human_interest": ["눈물", "가족", "아이", "시민", "주민", "현장", "피해자", "사연", "인터뷰", "병원", "사망", "부상"],
}


def weak_label_from_cues(text: str) -> str:
    text = clean_text(text)
    if not text:
        return "other"
    scores = {f: 0 for f in FRAME_CUES}
    for f, cues in FRAME_CUES.items():
        for c in cues:
            if c and c in text:
                scores[f] += 1
    best = max(scores.items(), key=lambda kv: kv[1])
    return best[0] if best[1] > 0 else "other"


@dataclass
class FrameModelBundle:
    vectorizer: TfidfVectorizer
    model: LogisticRegression


def train_frame_model(texts: list[str], labels: list[str]) -> FrameModelBundle:
    vec = TfidfVectorizer(
        tokenizer=tokenize_for_tfidf,
        preprocessor=clean_text,
        lowercase=False,
        min_df=2,
        max_df=0.9,
        ngram_range=(1, 2),
    )
    X = vec.fit_transform(texts)
    clf = LogisticRegression(
        max_iter=2000,
        n_jobs=1,
        multi_class="multinomial",
        class_weight="balanced",
        solver="lbfgs",
    )
    clf.fit(X, labels)
    return FrameModelBundle(vectorizer=vec, model=clf)


def save_bundle(bundle: FrameModelBundle, out_dir: str) -> None:
    os.makedirs(out_dir, exist_ok=True)
    dump(bundle.vectorizer, os.path.join(out_dir, "frame_vectorizer.joblib"))
    dump(bundle.model, os.path.join(out_dir, "frame_model.joblib"))


def load_bundle(model_dir: str) -> FrameModelBundle | None:
    vec_path = os.path.join(model_dir, "frame_vectorizer.joblib")
    mdl_path = os.path.join(model_dir, "frame_model.joblib")
    if not (os.path.exists(vec_path) and os.path.exists(mdl_path)):
        return None
    try:
        vec = load(vec_path)
        mdl = load(mdl_path)
        return FrameModelBundle(vectorizer=vec, model=mdl)
    except Exception:
        return None


def predict_emphasis(bundle: FrameModelBundle | None, text: str) -> list[dict[str, Any]]:
    text = clean_text(text)
    if not text:
        return [{"frame": "other", "label_kr": FRAME_LABEL_KR["other"], "score": 1.0}]
    if bundle is None:
        label = weak_label_from_cues(text)
        return [{"frame": label, "label_kr": FRAME_LABEL_KR.get(label, label), "score": 1.0}]

    X = bundle.vectorizer.transform([text])
    proba = bundle.model.predict_proba(X)[0]
    classes = list(bundle.model.classes_)
    scored = list(zip(classes, [float(p) for p in proba]))
    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:3]
    denom = sum(s for _, s in top) or 1.0
    return [{"frame": f, "label_kr": FRAME_LABEL_KR.get(f, f), "score": float(s / denom)} for f, s in top]


def _pick_issue_cluster_k(n: int) -> int:
    if n <= 0:
        return 0
    if n < 30:
        return 3
    k = int(np.sqrt(n))
    return max(3, min(14, k))


def compute_issue_clusters(articles: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    texts: list[str] = []
    idx_map: list[int] = []
    for idx, it in enumerate(articles):
        title = clean_text(it.get("title", ""))
        body = clean_text(it.get("full_text") or it.get("description_full") or it.get("description") or "")
        t = (title + "\n" + body).strip()
        if t:
            texts.append(t)
            idx_map.append(idx)

    n = len(texts)
    if n < 2:
        return {}

    k = _pick_issue_cluster_k(n)
    if k < 2:
        return {}

    vec = TfidfVectorizer(
        tokenizer=tokenize_for_tfidf,
        preprocessor=clean_text,
        lowercase=False,
        min_df=2,
        max_df=0.9,
        ngram_range=(1, 2),
        max_features=12000,
    )
    X = vec.fit_transform(texts)

    km = MiniBatchKMeans(
        n_clusters=k,
        random_state=42,
        batch_size=256,
        n_init="auto",
        max_iter=200,
    )
    labels = km.fit_predict(X)

    feature_names = vec.get_feature_names_out()
    centroids = km.cluster_centers_

    cluster_keywords: dict[int, list[str]] = {}
    cluster_labels: dict[int, str] = {}
    for c in range(k):
        weights = centroids[c]
        top_idx = np.argsort(weights)[::-1][:8]
        kws = [str(feature_names[i]) for i in top_idx if weights[i] > 0]
        cluster_keywords[c] = kws
        cluster_labels[c] = " / ".join(kws[:3]) if kws else f"cluster {c}"

    out: dict[int, dict[str, Any]] = {}
    for local_i, article_idx in enumerate(idx_map):
        cid = int(labels[local_i])
        out[article_idx] = {
            "issue_cluster_id": cid,
            "issue_label": cluster_labels.get(cid, str(cid)),
            "issue_keywords": cluster_keywords.get(cid, []),
            "issue_embedding_method": "tfidf+kmeans",
        }

    return out


def pick_article_text(item: dict[str, Any]) -> tuple[str, str, str]:
    title = clean_text(item.get("title", ""))
    content = ""
    for key in ("full_text", "description_full", "content", "article"):
        if item.get(key):
            content = str(item.get(key))
            break
    if not content:
        content = item.get("description", "")
    content = clean_text(content)
    link = item.get("link") or item.get("originallink") or ""
    return title, content, link


def build_output_by_primary_frame(articles: list[dict[str, Any]], bundle: FrameModelBundle | None) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {k: [] for k in EMPHASIS_FRAMES}

    issue_meta_by_idx: dict[int, dict[str, Any]] = {}
    try:
        issue_meta_by_idx = compute_issue_clusters(articles)
    except Exception:
        issue_meta_by_idx = {}

    for idx, item in enumerate(articles):
        title, body, link = pick_article_text(item)
        text = (title + "\n" + body).strip()
        if not text:
            continue

        emphasis_top3 = predict_emphasis(bundle, text)
        primary = emphasis_top3[0]["frame"] if emphasis_top3 else "other"
        if primary not in grouped:
            primary = "other"

        out_item: dict[str, Any] = {
            "title": title,
            "description": clean_text(item.get("description", "")),
            "full_text": body,
            "link": link,
            "primary_frame": primary,
            "primary_frame_kr": FRAME_LABEL_KR.get(primary, primary),
            "emphasis_top3": emphasis_top3,
            "keyphrases": textrank_keyphrases(text, top_k=10),
            "equivalence_frames": detect_equivalence_frames(text),
        }
        if idx in issue_meta_by_idx:
            out_item.update(issue_meta_by_idx[idx])

        grouped[primary].append(out_item)

    return grouped


def make_frame(keyword: str, model_dir: str, auto_train: bool, retrain: bool) -> None:
    input_file = f"news_500_{keyword}.json"
    output_file = f"frame_set_{keyword}.json"
    if not os.path.exists(input_file):
        raise SystemExit(f"입력 파일이 없습니다: {input_file}")
    with open(input_file, "r", encoding="utf-8") as f:
        articles = json.load(f)
    if not isinstance(articles, list):
        raise SystemExit("입력 JSON은 기사 배열(list)이어야 합니다")

    bundle: FrameModelBundle | None = None
    if not retrain:
        bundle = load_bundle(model_dir)

    if bundle is None and auto_train:
        texts: list[str] = []
        labels: list[str] = []
        for it in articles:
            title, body, _link = pick_article_text(it)
            text = (title + "\n" + body).strip()
            if not text:
                continue
            texts.append(text)
            labels.append(weak_label_from_cues(text))

        if len(texts) >= 200 and len(set(labels)) >= 2:
            bundle = train_frame_model(texts, labels)
            save_bundle(bundle, model_dir)

    result = build_output_by_primary_frame(articles, bundle)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"프레임 분석 완료 -> {output_file}")


def main() -> None:
    parser = argparse.ArgumentParser(description="기사 프레임 분석(강조/등가) + 키프레이즈 + 이슈 클러스터")
    parser.add_argument("keyword", help="검색 키워드 (news_500_{keyword}.json 파일 사용)")
    parser.add_argument("--model-dir", default="frame_model", help="프레임 분류 모델 저장/로드 디렉터리")
    parser.add_argument("--auto-train", action="store_true", help="모델이 없으면 약지도 학습을 수행")
    parser.add_argument("--retrain", action="store_true", help="기존 모델이 있어도 다시 학습")
    args = parser.parse_args()

    make_frame(args.keyword, model_dir=args.model_dir, auto_train=args.auto_train, retrain=args.retrain)


if __name__ == "__main__":
    main()
