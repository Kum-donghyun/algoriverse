#!/usr/bin/env python3
"""
Algoriverse_news_gpt.py - GPT API 전용 뉴스 성향 분석

기존 Word2Vec 기반 로직을 제거하고, GPT API만 사용하여:
- 뉴스 성향 점수 산출 (-1~1)
- 핵심 키워드 추출
- 반대 성향 기사 추천 (입력: analyzed_articles.json의 타겟 기사)
"""

import json
import argparse
import os
import sys
import re
import time
import urllib.request
import urllib.error
import warnings
warnings.filterwarnings('ignore')


def _load_local_dotenv(dotenv_path='.env'):
    """Load .env file into os.environ (no override)."""
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(base_dir, dotenv_path)
        if not os.path.exists(path):
            return
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                s = (line or '').strip()
                if not s or s.startswith('#'):
                    continue
                if '=' not in s:
                    continue
                key, val = s.split('=', 1)
                key = key.strip()
                val = val.strip()
                if not key:
                    continue
                if len(val) >= 2 and ((val[0] == '"' and val[-1] == '"') or (val[0] == "'" and val[-1] == "'")):
                    val = val[1:-1]
                if key not in os.environ:
                    os.environ[key] = val
    except Exception:
        return


_load_local_dotenv('.env')


def clean_text(text):
    """텍스트 정제"""
    if not text:
        return ""
    text = re.sub(r'[=\[]?\s*[가-힣]{2,4}\s*기자\s*[\]]*', '', text)
    text = re.sub(r'\([가-힣]{2,4}\s*기자\)', '', text)
    text = re.sub(r'이미지\s*(확대|축소|보기|출처|제공)', '', text)
    text = re.sub(r'\[사진\]|\[그래픽\]|\[영상\]', '', text)
    text = re.sub(r'http[s]?://\S+', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def _extract_first_json_object(s: str):
    if not s:
        return None
    start = s.find('{')
    if start < 0:
        return None
    depth = 0
    for i in range(start, len(s)):
        ch = s[i]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return s[start:i+1]
    return None


def _normalize_score(x):
    try:
        v = float(x)
    except:
        return None
    return max(-1.0, min(1.0, v))


def gpt_analyze_article(text, title=None, press=None, link=None, date=None, *,
                        model=None, temperature=0.2, timeout=30, max_chars=8000):
    """GPT API로 뉴스 분석: 성향 점수 + 키워드 + (선택) 추천 ID 등.

    Returns:
        dict | None
    """
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY not set', 'model': model or 'unknown'}

    model = model or os.getenv('OPENAI_MODEL') or 'gpt-4o-mini'
    try:
        temperature = float(os.getenv('OPENAI_TEMPERATURE', str(temperature)))
    except:
        temperature = float(temperature)

    t = (text or '').strip()
    if len(t) < 50:
        return {'error': 'Text too short', 'model': model}

    clipped = t[:max_chars]

    system = """너는 한국 정치/사회 뉴스의 제목과 본문을 읽고, 서술 방식과 프레이밍을 근거로 "보수↔진보" 성향 점수를 산출하는 분석기다.

요청:
1) 입력 뉴스의 성향을 -1.0(보수) ~ +1.0(진보) 실수로 산출한다.
2) label_en은 conservative|neutral|progressive 중 하나.
3) confidence는 low|medium|high 중 하나.
4) 핵심 키워드(이슈 중심 명사/개념 5~10개)를 배열로 추출한다.
5) 근거는 기사 내부 표현(단어/구/문장) 중심으로 제시하되, 사실판단이 아니라 "표현/프레이밍"을 근거로 한다.
6) 기사가 어떤 인물/정당 발언을 많이 인용했는지(quote_dominance)도 고려한다. 인용구에 특정 진영의 가치와 연관된 표현이 많더라도, 성향 판단의 우선순위는 해당 발언을 한 정치인의 소속과 이념 성향에 둔다.
7) 출력은 JSON만 반환한다(설명 텍스트 금지).

주의:
- 정치적 중립을 목표로 하며, 특정 진영을 옹호/비난하지 않는다.
- 분석 시 한국 정치 맥락을 고려한다.
- 기사 내용이 정치/사회 이슈가 아니거나 근거가 부족하면 score를 0에 가깝게 하고 confidence를 낮게 한다.
""".strip()

    schema = {
        "ideology_score": "number (-1..1)",
        "label_en": "conservative|neutral|progressive",
        "label_kr": "보수|중립|진보",
        "confidence": "low|medium|high",
        "rationale": "string (2~4 sentences, Korean)",
        "evidence_phrases": "string[] (3~8 short quotes or key phrases from the article)",
        "issue_keywords": "string[] (5~10 core issue keywords, Korean nouns/concepts)",
    }

    meta = {
        "title": title or None,
        "source": press or None,
        "url": link or None,
        "date": date or None,
    }

    user = "\n".join([
        "아래 뉴스에 대해 JSON만 출력해라.",
        "반드시 아래 키를 포함해라:",
        json.dumps(schema, ensure_ascii=False, indent=2),
        "",
        "메타정보:",
        json.dumps(meta, ensure_ascii=False, indent=2),
        "",
        "뉴스 본문:",
        clipped,
    ])

    payload = {
        "model": model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
    }

    req = urllib.request.Request(
        url='https://api.openai.com/v1/chat/completions',
        data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode('utf-8', errors='replace')
        except:
            detail = str(e)
        return {
            'error': f'HTTPError {getattr(e, "code", "?")}',
            'detail': detail[:1200],
            'model': model,
        }
    except Exception as e:
        return {
            'error': 'RequestFailed',
            'detail': str(e)[:400],
            'model': model,
        }

    try:
        data = json.loads(raw)
        content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
    except Exception:
        return {
            'error': 'BadResponse',
            'detail': raw[:1200],
            'model': model,
        }

    parsed = None
    try:
        parsed = json.loads(content)
    except Exception:
        extracted = _extract_first_json_object(content)
        if extracted:
            try:
                parsed = json.loads(extracted)
            except Exception:
                parsed = None

    if not isinstance(parsed, dict):
        return {
            'error': 'NonJsonModelOutput',
            'detail': (content or '')[:1200],
            'model': model,
        }

    score = _normalize_score(parsed.get('ideology_score'))
    if score is None:
        return {
            'error': 'InvalidScore',
            'detail': json.dumps(parsed, ensure_ascii=False)[:1200],
            'model': model,
        }

    label_en = (parsed.get('label_en') or '').strip().lower()
    if label_en not in ('conservative', 'neutral', 'progressive'):
        if score > 0.08:
            label_en = 'progressive'
        elif score < -0.08:
            label_en = 'conservative'
        else:
            label_en = 'neutral'

    label_kr = parsed.get('label_kr')
    if label_kr not in ('보수', '중립', '진보'):
        label_kr = '진보' if label_en == 'progressive' else '보수' if label_en == 'conservative' else '중립'

    conf = (parsed.get('confidence') or '').strip().lower()
    if conf not in ('low', 'medium', 'high'):
        conf = 'low'

    ev = parsed.get('evidence_phrases')
    if not isinstance(ev, list):
        ev = []

    kw = parsed.get('issue_keywords')
    if not isinstance(kw, list):
        kw = []

    return {
        'ideology_score': float(score),
        'label_en': label_en,
        'label_kr': label_kr,
        'confidence': conf,
        'rationale': (parsed.get('rationale') or '').strip(),
        'evidence_phrases': [str(x)[:120] for x in ev[:10]],
        'issue_keywords': [str(x)[:30] for x in kw[:12]],
        'model': model,
        'temperature': temperature,
        'input_chars': len(clipped),
    }


def analyze_article(text, article_id=None, title=None, press=None, link=None, date=None):
    """단일 기사 분석 (GPT only)."""
    try:
        cleaned = clean_text(text)
        if len(cleaned) < 50:
            raise ValueError("Text too short")

        gpt = gpt_analyze_article(
            cleaned,
            title=title,
            press=press,
            link=link,
            date=date,
        )

        if isinstance(gpt, dict) and gpt.get('error'):
            print(f"[GPT분석실패] 기사 {article_id}: {gpt.get('error')}", file=sys.stderr)
            return None

        # GPT 결과를 기본 스키마로 변환
        return {
            'article_id': article_id,
            'ideology_score': float(gpt.get('ideology_score', 0.0)),
            'bias_label': gpt.get('label_en'),
            'bias_label_kr': gpt.get('label_kr'),
            'confidence': gpt.get('confidence'),
            'cleaned_text': cleaned,
            'gpt_analysis': {
                'rationale': gpt.get('rationale'),
                'evidence_phrases': gpt.get('evidence_phrases', []),
                'issue_keywords': gpt.get('issue_keywords', []),
                'model': gpt.get('model'),
                'temperature': gpt.get('temperature'),
                'input_chars': gpt.get('input_chars'),
            },
        }
    except Exception as e:
        print(f"[분석실패] 기사 {article_id}: {e}", file=sys.stderr)
        return None


def batch_analysis(input_file, output_file):
    """배치 분석 (GPT only)."""
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            articles = json.load(f)
    except:
        print(f"[Error] {input_file} 로드 실패", file=sys.stderr)
        return

    results = []
    stats = {'progressive': 0, 'conservative': 0, 'neutral': 0, 'failed': 0}
    gpt_stats = {'success': 0, 'error': 0, 'error_reasons': {}}

    print(f"[GPT 배치처리] {len(articles)}개 기사 분석 시작...", file=sys.stderr)

    for i, article in enumerate(articles, 1):
        text = (
            article.get('full_text')
            or article.get('description_full')
            or article.get('content')
            or article.get('description')
            or article.get('title')
            or ''
        )
        article_id = article.get('_id') or article.get('id') or i

        result = analyze_article(
            text,
            article_id=article_id,
            title=article.get('title'),
            press=article.get('press'),
            link=article.get('link'),
            date=article.get('date') or article.get('pubDate'),
        )

        if result:
            result['title'] = article.get('title', '')
            result['press'] = article.get('press', '')
            result['date'] = article.get('date', '') or article.get('pubDate', '')
            result['link'] = article.get('link', '')
            result['originallink'] = article.get('originallink', '')
            result['description'] = article.get('description', '')
            result['full_text'] = article.get('full_text', '') or article.get('description_full', '')
            result['pubDate'] = article.get('pubDate', '')
            result['image_url'] = article.get('image_url', '') or article.get('imageUrl', '')

            results.append(result)
            stats[result['bias_label']] += 1
            gpt_stats['success'] += 1

            if i % 20 == 0:
                print(f"[GPT 배치] {i}/{len(articles)} 완료 (진보: {stats['progressive']}, 보수: {stats['conservative']}, 중립: {stats['neutral']})", file=sys.stderr)
        else:
            stats['failed'] += 1
            gpt_stats['error'] += 1

    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        print(f"\n[GPT 배치] ✅ 완료! {len(results)}개 기사 → {output_file}", file=sys.stderr)
        print(f"[통계] 진보: {stats['progressive']}, 보수: {stats['conservative']}, 중립: {stats['neutral']}, 실패: {stats['failed']}", file=sys.stderr)
        print(f"[GPT 호출] 성공: {gpt_stats['success']}, 실패: {gpt_stats['error']}", file=sys.stderr)
    except Exception as e:
        print(f"[Error] 저장 실패: {e}", file=sys.stderr)


def recommend_opposite_articles(target_article_id, database_file, top_k=5):
    """다른 관점의 기사 추천 (반대 성향 + 중립 포함, GPT-analyzed DB 기반)."""
    try:
        with open(database_file, 'r', encoding='utf-8') as f:
            articles = json.load(f)
    except:
        print(f"[Error] {database_file} 로드 실패", file=sys.stderr)
        return []

    target = None
    for art in articles:
        if str(art['article_id']) == str(target_article_id):
            target = art
            break

    if not target:
        print(f"[Error] 기사 ID {target_article_id} 없음", file=sys.stderr)
        return []

    target_label = target['bias_label']

    # 반대 성향 + 중립 기사 모두 포함
    if target_label == 'progressive':
        opposite_labels = ['conservative', 'neutral']
    elif target_label == 'conservative':
        opposite_labels = ['progressive', 'neutral']
    else:
        # 중립이면 양쪽 모두 추천
        opposite_labels = ['progressive', 'conservative']

    candidates = [a for a in articles if a['bias_label'] in opposite_labels]

    if not candidates:
        return []

    # 단순 키워드 교집합 기반 유사도
    target_kw = set(target.get('gpt_analysis', {}).get('issue_keywords', []))

    scored = []
    for cand in candidates:
        cand_kw = set(cand.get('gpt_analysis', {}).get('issue_keywords', []))
        overlap = len(target_kw & cand_kw)
        scored.append((overlap, cand))

    scored.sort(key=lambda x: x[0], reverse=True)

    recommendations = []
    for overlap, cand in scored[:top_k]:
        recommendations.append({
            'article_id': cand['article_id'],
            'title': cand.get('title', ''),
            'link': cand.get('link', ''),
            'bias_label': cand['bias_label'],
            'bias_label_kr': cand['bias_label_kr'],
            'similarity_score': float(overlap) / max(len(target_kw), 1),
            'explanation': f"키워드 {overlap}개 공유, {cand['bias_label_kr']} 관점에서 같은 이슈를 다룸",
        })

    return recommendations


def main():
    parser = argparse.ArgumentParser(description='GPT API 기반 뉴스 성향 분석')
    parser.add_argument('--mode', choices=['analyze', 'batch', 'recommend'], required=True)
    parser.add_argument('--input', help='입력 파일 (batch) 또는 텍스트 (analyze)')
    parser.add_argument('--output', help='출력 파일 (batch)')
    parser.add_argument('--article-id', help='기사 ID (recommend)')
    parser.add_argument('--database', default='analyzed_articles.json', help='분석 DB (recommend)')
    parser.add_argument('--top-k', type=int, default=5, help='추천 개수')
    parser.add_argument('--model', default=None, help='GPT 모델 (기본: gpt-4o-mini)')
    parser.add_argument('--temperature', type=float, default=0.2, help='GPT temperature')

    args = parser.parse_args()

    if args.mode == 'analyze':
        if args.input:
            if os.path.exists(args.input):
                with open(args.input, 'r', encoding='utf-8') as f:
                    text = f.read()
            else:
                text = args.input
        else:
            text = sys.stdin.read()

        result = analyze_article(text)
        if result:
            print(json.dumps(result, ensure_ascii=False, indent=2))

    elif args.mode == 'batch':
        if not args.input or not args.output:
            print("[Error] --input, --output 필요", file=sys.stderr)
            sys.exit(1)
        batch_analysis(args.input, args.output)

    elif args.mode == 'recommend':
        if not args.article_id:
            print("[Error] --article-id 필요", file=sys.stderr)
            sys.exit(1)
        recommendations = recommend_opposite_articles(args.article_id, args.database, args.top_k)
        print(json.dumps(recommendations, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
