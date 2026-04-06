"""
opinionbot.py — Gemini 기반 사설 논거 분석 엔진

파이프라인:
  1. 수집된 사설 JSON을 읽어옴
  2. TF-IDF + 코사인 유사도 기반 이슈 클러스터링 (자동 토픽 그룹핑)
  3. Gemini 2.0 Flash로 각 사설의 논거적 경향 분석
     (핵심 주장, 논거 프레임, 입장, 논조)
  4. 이슈별 비교 요약 생성
  5. JSON 결과 출력 → Node.js 백엔드에서 수신

사용법:
  python opinionbot.py --date 2026-03-04
"""

import sys
import os
import io
import json
import re
import math
import argparse
from pathlib import Path
from collections import defaultdict, Counter

# UTF-8 강제 설정
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / 'data' / 'editorials'
CONFIG_PATH = BASE_DIR / 'gemini_config.json'

# ─── 한국어 불용어 ───
STOPWORDS = set([
    '것', '수', '등', '년', '월', '일', '위', '때', '중', '후', '전', '내', '더', '적',
    '이', '그', '저', '이런', '그런', '대한', '통해', '위해', '대해', '있다', '없다',
    '했다', '한다', '된다', '한다', '말했다', '밝혔다', '지난', '올해', '지금', '또한',
    '하지만', '그러나', '따라서', '때문에', '그리고', '또는', '다만', '관련', '이번',
    '정부', '대통령', '국회', '사회', '경제', '문제', '상황', '필요', '의원', '장관',
    '기자', '서울', '한국', '미국', '대표', '사람', '우리', '자신', '주장', '입장',
])

# ─── 1. 한국어 명사 추출 (경량 방식 - 정규식 기반) ───
def extract_nouns(text):
    """정규식 기반 2~6자 한글 명사 후보 추출 (konlpy 없이도 동작)"""
    if not text:
        return []
    # 한글 2~6글자 패턴 매칭
    candidates = re.findall(r'[가-힣]{2,6}', text)
    # 불용어 필터링 + 빈도 필터
    return [w for w in candidates if w not in STOPWORDS and len(w) >= 2]


# ─── 2. TF-IDF 계산 (순수 Python) ───
def compute_tfidf(documents):
    """
    documents: list of list of words
    returns: list of dict { word: tfidf_score }
    """
    N = len(documents)
    if N == 0:
        return []

    # DF 계산
    df = Counter()
    for doc in documents:
        unique_words = set(doc)
        for w in unique_words:
            df[w] += 1

    # TF-IDF
    tfidf_list = []
    for doc in documents:
        tf = Counter(doc)
        total = len(doc) if doc else 1
        tfidf = {}
        for w, count in tf.items():
            idf = math.log((N + 1) / (df[w] + 1)) + 1
            tfidf[w] = (count / total) * idf
        tfidf_list.append(tfidf)

    return tfidf_list


def cosine_sim(v1, v2):
    """두 dict 벡터 간 코사인 유사도"""
    common = set(v1.keys()) & set(v2.keys())
    if not common:
        return 0.0
    dot = sum(v1[w] * v2[w] for w in common)
    norm1 = math.sqrt(sum(x ** 2 for x in v1.values()))
    norm2 = math.sqrt(sum(x ** 2 for x in v2.values()))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


# ─── 3. 이슈 클러스터링 (Agglomerative-like greedy) ───
def cluster_editorials(editorials_flat, threshold=0.15):
    """
    editorials_flat: list of { press, title, full_text, link, ... }
    returns: list of { issue_name, keywords, editorials: [...] }
    """
    if not editorials_flat:
        return []

    # 각 사설의 명사 추출
    docs_words = []
    for ed in editorials_flat:
        text = (ed.get('title', '') + ' ' + ed.get('full_text', ''))[:2000]
        nouns = extract_nouns(text)
        docs_words.append(nouns)

    # TF-IDF 벡터 생성
    tfidf_vectors = compute_tfidf(docs_words)

    # Greedy 클러스터링
    n = len(editorials_flat)
    assigned = [False] * n
    clusters = []

    for i in range(n):
        if assigned[i]:
            continue
        cluster_indices = [i]
        assigned[i] = True
        centroid = dict(tfidf_vectors[i])

        for j in range(i + 1, n):
            if assigned[j]:
                continue
            sim = cosine_sim(centroid, tfidf_vectors[j])
            if sim >= threshold:
                cluster_indices.append(j)
                assigned[j] = True
                # 센트로이드 업데이트 (간이 평균)
                for w, v in tfidf_vectors[j].items():
                    centroid[w] = centroid.get(w, 0) + v

        # 클러스터 대표 키워드 추출 (TF-IDF 상위)
        all_words = Counter()
        for idx in cluster_indices:
            all_words.update(docs_words[idx])

        # 키워드: 빈도 + TF-IDF 합산 양쪽 고려
        keyword_scores = {}
        for w, freq in all_words.items():
            tfidf_sum = sum(tfidf_vectors[idx].get(w, 0) for idx in cluster_indices)
            keyword_scores[w] = freq * 0.3 + tfidf_sum * 0.7

        top_keywords = sorted(keyword_scores, key=keyword_scores.get, reverse=True)[:5]
        issue_name = ' / '.join(top_keywords[:3]) if top_keywords else '기타'

        cluster_eds = [editorials_flat[idx] for idx in cluster_indices]
        clusters.append({
            'issue_name': issue_name,
            'keywords': top_keywords,
            'editorial_indices': cluster_indices,
            'editorials': cluster_eds
        })

    return clusters


# ─── 4. Gemini 기반 논거 분석 ───
GEMINI_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash-001",
]

def load_gemini():
    """Gemini 모델 로드 (새 google-genai SDK 사용)"""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key and CONFIG_PATH.exists():
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
            api_key = cfg.get("api_key", "")
    if not api_key:
        print("[OpinionBot] Gemini API 키가 없습니다. gemini_config.json을 확인하세요.", file=sys.stderr)
        return None, None
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        # 사용 가능한 모델 순서대로 시도
        for model_name in GEMINI_MODELS:
            try:
                test_resp = client.models.generate_content(
                    model=model_name,
                    contents="테스트: 1+1=?"
                )
                if test_resp and test_resp.text:
                    print(f"[OpinionBot] Gemini 모델 사용: {model_name}", file=sys.stderr)
                    return client, model_name
            except Exception as e:
                print(f"[OpinionBot] {model_name} 실패: {e}", file=sys.stderr)
                continue
        print("[OpinionBot] 사용 가능한 Gemini 모델이 없습니다.", file=sys.stderr)
        return None, None
    except Exception as e:
        print(f"[OpinionBot] Gemini 로드 실패: {e}", file=sys.stderr)
        return None, None


def analyze_issue_with_gemini(client, model_name, issue_name, keywords, editorials):
    """Gemini로 이슈 내 사설들의 논거적 경향 분석"""
    ed_parts = []
    for i, ed in enumerate(editorials):
        text = (ed.get('full_text', '') or '')[:800]
        ed_parts.append(f"[사설 {i+1}] [{ed['press']}] {ed['title']}\n{text}")

    all_text = "\n\n---\n\n".join(ed_parts)

    prompt = f"""당신은 한국 언론 사설 분석 전문가입니다.
다음은 '{issue_name}' (키워드: {', '.join(keywords)}) 이슈에 관한 여러 신문사 사설들입니다.

{all_text}

각 사설의 **논거적 경향**을 분석하여 아래 JSON 형식으로만 응답해주세요.
절대 다른 텍스트 없이 순수 JSON만 출력하세요. 마크다운 코드블록도 사용하지 마세요.

{{
  "issue_summary": "이 이슈에 대한 각 신문사의 논조 차이를 2~3문장으로 비교 요약",
  "editorials": [
    {{
      "index": 1,
      "key_argument": "이 사설의 핵심 주장 (1~2문장)",
      "frame": "논거 프레임 (예: 법치주의, 경제성장 우선, 사회안전망, 정치개혁, 국제협력 등 - 한두 단어)",
      "stance": "이 이슈에 대한 입장 (예: 찬성, 반대, 비판적, 신중론, 조건부 찬성, 개혁 촉구 등)",
      "tone": "논조 (예: 비판적, 옹호적, 중립적, 우려, 촉구, 경고 등)"
    }}
  ]
}}"""

    try:
        from google import genai
        response = client.models.generate_content(
            model=model_name,
            contents=prompt
        )
        text = response.text.strip()
        # 마크다운 코드블록 제거
        if text.startswith('```'):
            text = re.sub(r'^```\w*\n?', '', text)
            text = re.sub(r'\n?```$', '', text)
        result = json.loads(text)
        return result
    except Exception as e:
        print(f"[OpinionBot] Gemini 분석 오류 ({issue_name}): {e}", file=sys.stderr)
        return None


# ─── 5. 전체 파이프라인 ───
def run_opinionbot(date):
    """메인 파이프라인: 수집된 사설 → 이슈 클러스터링 → Gemini 논거 분석 → 결과 반환"""
    import time

    # 1) 사설 데이터 로드
    json_path = DATA_DIR / f"{date}.json"
    if not json_path.exists():
        return {'error': f'{date} 사설 데이터가 없습니다.', 'date': date}

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 2) 플랫 리스트로 변환 (신문사 정보 포함)
    editorials_flat = []
    for press, articles in data.items():
        for art in articles:
            editorials_flat.append({
                'press': press,
                'title': art.get('title', ''),
                'full_text': art.get('full_text', ''),
                'link': art.get('link', ''),
                'imageUrl': art.get('imageUrl', ''),
            })

    if not editorials_flat:
        return {'error': '분석할 사설이 없습니다.', 'date': date}

    # 3) 이슈 클러스터링
    issues = cluster_editorials(editorials_flat, threshold=0.12)

    # 4) Gemini 모델 로드
    gemini_client, gemini_model = load_gemini()

    # 5) 이슈별 Gemini 논거 분석
    issue_results = []
    for cluster in issues:
        issue_data = {
            'issue_name': cluster['issue_name'],
            'keywords': cluster['keywords'],
            'editorial_count': len(cluster['editorials']),
            'editorials': [],
            'issue_summary': '',
        }

        # Gemini로 이슈 내 사설들 분석
        gemini_result = None
        if gemini_client and gemini_model:
            gemini_result = analyze_issue_with_gemini(
                gemini_client,
                gemini_model,
                cluster['issue_name'],
                cluster['keywords'],
                cluster['editorials']
            )
            # API Rate limit 대비 딜레이
            time.sleep(1)

        for i, ed in enumerate(cluster['editorials']):
            ed_data = {
                'press': ed['press'],
                'title': ed['title'],
                'link': ed['link'],
                'imageUrl': ed.get('imageUrl', ''),
                'snippet': (ed.get('full_text', '') or '')[:150],
            }

            # Gemini 분석 결과 매핑
            if gemini_result and 'editorials' in gemini_result:
                for ge in gemini_result['editorials']:
                    if ge.get('index') == i + 1:
                        ed_data['key_argument'] = ge.get('key_argument', '')
                        ed_data['frame'] = ge.get('frame', '')
                        ed_data['stance'] = ge.get('stance', '')
                        ed_data['tone'] = ge.get('tone', '')
                        break

            issue_data['editorials'].append(ed_data)

        if gemini_result:
            issue_data['issue_summary'] = gemini_result.get('issue_summary', '')

        issue_results.append(issue_data)

    return {
        'date': date,
        'total_editorials': len(editorials_flat),
        'total_issues': len(issue_results),
        'issues': issue_results,
    }


# ─── CLI 인터페이스 ───
def main():
    parser = argparse.ArgumentParser(description='OpinionBot 오피니언봇 (Gemini)')
    parser.add_argument('--date', type=str, default=None, help='분석할 날짜 (YYYY-MM-DD)')
    args, _ = parser.parse_known_args()

    date = args.date
    if not date:
        from datetime import datetime
        date = datetime.now().strftime('%Y-%m-%d')

    result = run_opinionbot(date)

    # 캐시 파일 저장 (CLI 실행 시에도 결과 보존)
    cache_path = DATA_DIR / f"{date}_opinionbot.json"
    with open(cache_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"[OpinionBot] 결과 저장: {cache_path}", file=sys.stderr)

    print(json.dumps(result, ensure_ascii=False))
    sys.stdout.flush()


if __name__ == '__main__':
    main()
