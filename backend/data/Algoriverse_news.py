#!/usr/bin/env python3
# 파이썬 3 환경에서 실행되도록 지정하는 셔뱅(Shebang) 라인입니다.

"""
Algoriverse_news.py (개선 버전)

개요:
    Kiwi 형태소 분석 + 개선된 본문 정제 + 불용어 필터링 + 품사 필터링
    - 기자명, 이미지 캡션, 메타정보 제거로 순수 본문만 분석
    - 50+ 불용어 제거 (의, 가, 이, 기자 등)
    - 유의미한 품사만 추출 (명사, 동사, 형용사)
    - TF-IDF + 분류기로 진보/보수 분류

출력:
    - `blue_news_set.json`: 진보(blue)로 분류된 기사 리스트
    - `red_news_set.json`: 보수(red)로 분류된 기사 리스트
    - (학습 성공 시) `public/tfidf_vectorizer.pkl`, `public/classifier_model.pkl` 저장

필요 패키지:
    pip install kiwipiepy scikit-learn
"""

# 필요한 표준 라이브러리들을 임포트합니다.
import json
import argparse
import os
import sys
import re  # 정규표현식 (본문 정제용)
from collections import defaultdict, Counter
import pickle

# ----------------------------------------------------
# 머신러닝 관련 라이브러리(scikit-learn) 임포트 시도
# ----------------------------------------------------
try:
    # 텍스트 데이터를 벡터(수치)화하는 도구 (TF-IDF)
    from sklearn.feature_extraction.text import TfidfVectorizer
    # 로지스틱 회귀 분류 모델 (기본적으로 사용할 모델)
    from sklearn.linear_model import LogisticRegression
    # 선형 서포트 벡터 머신 (로지스틱 회귀 실패 시 대안)
    from sklearn.svm import LinearSVC
    # 데이터를 학습용과 검증용으로 나누는 함수
    from sklearn.model_selection import train_test_split
    # 분류 성능 평가 리포트 출력 함수
    from sklearn.metrics import classification_report
except Exception:
    # scikit-learn이 설치되어 있지 않은 경우, 관련 변수를 None으로 설정하여 에러 방지
    TfidfVectorizer = None
    LogisticRegression = None
    LinearSVC = None
    train_test_split = None
    classification_report = None

# ----------------------------------------------------
# 형태소 분석기 Kiwi 임포트 시도
# ----------------------------------------------------
try:
    from kiwipiepy import Kiwi
except Exception as e:
    # Kiwi가 없으면 실행 자체가 불가능하므로 에러를 발생시키고 설치 안내 메시지 출력
    raise ImportError(
        "kiwipiepy is required. Install with: pip install kiwipiepy"
    ) from e

# ----------------------------------------------------
# Word2Vec 사전학습 모델 로드 (선택적)
# ----------------------------------------------------
WORD2VEC_MODEL = None
HAS_NUMPY = False
try:
    import numpy as np
    HAS_NUMPY = True
except:
    print("[Word2Vec] numpy not available", file=sys.stderr)

# Word2Vec 모델 정보
WORD2VEC_INFO = {
    'type': 'none',
    'threshold': 0.3,
    'weight': 0.5
}

# 진보/보수 논리 구조 학습 모델
PROGRESSIVE_MODEL = None
CONSERVATIVE_MODEL = None

LOGICAL_STRUCTURE_INFO = {
    'progressive_loaded': False,
    'conservative_loaded': False,
    'analysis_method': 'subject_predicate'  # 주어-서술어 중심 분석
}

# 진보/보수 개념 시드 단어 (Word2Vec 분석용)
PROGRESSIVE_SEEDS = [
    '민주당', '진보', '개혁', '평등', '복지', '노동', '환경', '인권',
    '여성', '소수자', '참여', '민주주의', '분배', '정의', '공정'
]

CONSERVATIVE_SEEDS = [
    '국민의힘', '보수', '안보', '자유', '시장', '경제', '성장', '질서',
    '전통', '국가', '법치', '책임', '효율', '경쟁', '개인'
]

if HAS_NUMPY:
    try:
        # [우선순위 1] 한국어 정치 뉴스 Word2Vec 모델 - dict 형식 (빅카인즈 데이터, gensim 불필요)
        korean_dict_path = os.path.join(os.getcwd(), 'political_news_word2vec_dict.pkl')
        # [우선순위 2] Google News Word2Vec 모델 (fallback)
        google_path = os.path.join(os.getcwd(), 'word2vec_google_news_300_dict.pkl')
        # [우선순위 3] 한국어 정치 뉴스 Word2Vec 모델 - gensim 형식 (gensim 필요)
        korean_gensim_path = os.path.join(os.getcwd(), 'political_news_word2vec.pkl')
        
        model_loaded = False
        
        # [최우선] dict 형식 한국어 정치 뉴스 모델 로드
        if os.path.exists(korean_dict_path):
            print(f"[Word2Vec] Loading Korean political news model (dict format) from {korean_dict_path}...", file=sys.stderr)
            
            with open(korean_dict_path, 'rb') as f:
                WORD2VEC_MODEL = pickle.load(f)
            
            vocab_size = len(WORD2VEC_MODEL) if hasattr(WORD2VEC_MODEL, '__len__') else 'unknown'
            
            # 한국어 정치 뉴스 모델 최적화 설정
            WORD2VEC_INFO['type'] = 'korean_political'
            WORD2VEC_INFO['threshold'] = 0.45  # 한국어 모델: 높은 임계값 (정확한 매칭)
            WORD2VEC_INFO['weight'] = 0.8  # 한국어 모델: 높은 가중치 (의미론적 신호 강화)
            
            print(f"[Word2Vec] ✅ Korean political model loaded! Vocab: {vocab_size}", file=sys.stderr)
            print(f"[Word2Vec] 🎯 Optimized for Korean news analysis:", file=sys.stderr)
            print(f"    - Model type: {WORD2VEC_INFO['type']}", file=sys.stderr)
            print(f"    - Similarity threshold: {WORD2VEC_INFO['threshold']} (high precision)", file=sys.stderr)
            print(f"    - Semantic weight: {WORD2VEC_INFO['weight']} (strong signal)", file=sys.stderr)
            print(f"    - Training data: BigKinds political news corpus (2024-2025)", file=sys.stderr)
            model_loaded = True
        
        # [2순위] Google News 모델 (fallback)
        elif os.path.exists(google_path):
            print(f"[Word2Vec] Korean dict model not found, loading Google News model from {google_path}...", file=sys.stderr)
            
            with open(google_path, 'rb') as f:
                WORD2VEC_MODEL = pickle.load(f)
            
            vocab_size = len(WORD2VEC_MODEL) if hasattr(WORD2VEC_MODEL, '__len__') else 'unknown'
            
            # Google News 모델 설정
            WORD2VEC_INFO['type'] = 'google_news'
            WORD2VEC_INFO['threshold'] = 0.3  # 영어 모델: 낮은 임계값
            WORD2VEC_INFO['weight'] = 0.5  # 영어 모델: 낮은 가중치
            
            print(f"[Word2Vec] Google News model loaded! Vocab: {vocab_size}", file=sys.stderr)
            print(f"[Word2Vec] Using fallback settings (threshold={WORD2VEC_INFO['threshold']}, weight={WORD2VEC_INFO['weight']})", file=sys.stderr)
            model_loaded = True
        
        # [3순위] gensim 형식 한국어 모델 (gensim 설치 필요)
        elif os.path.exists(korean_gensim_path):
            print(f"[Word2Vec] Attempting to load Korean model (gensim format) from {korean_gensim_path}...", file=sys.stderr)
            
            try:
                with open(korean_gensim_path, 'rb') as f:
                    WORD2VEC_MODEL = pickle.load(f)
                
                # gensim KeyedVectors 형식 처리
                if hasattr(WORD2VEC_MODEL, 'key_to_index'):
                    vocab_size = len(WORD2VEC_MODEL.key_to_index)
                elif hasattr(WORD2VEC_MODEL, '__len__'):
                    vocab_size = len(WORD2VEC_MODEL)
                else:
                    vocab_size = 'unknown'
                
                WORD2VEC_INFO['type'] = 'korean_political'
                WORD2VEC_INFO['threshold'] = 0.45
                WORD2VEC_INFO['weight'] = 0.8
                
                print(f"[Word2Vec] Korean political model (gensim) loaded! Vocab: {vocab_size}", file=sys.stderr)
                model_loaded = True
            
            except ModuleNotFoundError:
                print(f"[Word2Vec] ⚠️ gensim module required for this model format", file=sys.stderr)
                print(f"[Word2Vec] 💡 Tip: Use dict format model (political_news_word2vec_dict.pkl) instead", file=sys.stderr)
        
        if not model_loaded:
            print(f"[Word2Vec] ⚠️ Word2Vec model not found in:", file=sys.stderr)
            print(f"    1. {korean_dict_path}", file=sys.stderr)
            print(f"    2. {google_path}", file=sys.stderr)
            print(f"    3. {korean_gensim_path}", file=sys.stderr)
            print(f"[Word2Vec] ⚠️ Semantic analysis will use fallback method", file=sys.stderr)
        
        # 진보/보수 논리 구조 모델 로드
        progressive_path = os.path.join(os.getcwd(), 'progressive_news_word2vec.pkl')
        conservative_path = os.path.join(os.getcwd(), 'conservative_news_word2vec.pkl')
        
        if os.path.exists(progressive_path):
            print(f"[논리구조] Loading progressive news model from {progressive_path}...", file=sys.stderr)
            try:
                with open(progressive_path, 'rb') as f:
                    PROGRESSIVE_MODEL = pickle.load(f)
                
                prog_vocab_size = len(PROGRESSIVE_MODEL) if hasattr(PROGRESSIVE_MODEL, '__len__') else 'unknown'
                if hasattr(PROGRESSIVE_MODEL, 'wv') and hasattr(PROGRESSIVE_MODEL.wv, 'key_to_index'):
                    prog_vocab_size = len(PROGRESSIVE_MODEL.wv.key_to_index)
                
                LOGICAL_STRUCTURE_INFO['progressive_loaded'] = True
                print(f"[논리구조] ✅ 진보 언론사 모델 로드 완료! Vocab: {prog_vocab_size}", file=sys.stderr)
                print(f"    - 출처: 한겨레, 경향신문, MBC", file=sys.stderr)
                print(f"    - 학습 데이터: 2만 정치 기사", file=sys.stderr)
            except Exception as e:
                print(f"[논리구조] ⚠️ 진보 모델 로드 실패: {e}", file=sys.stderr)
                print(f"[논리구조] 💡 gensim이 필요한 모델입니다. 기존 분석 방식을 사용합니다.", file=sys.stderr)
        else:
            print(f"[논리구조] ⚠️ 진보 모델을 찾을 수 없습니다: {progressive_path}", file=sys.stderr)
        
        if os.path.exists(conservative_path):
            print(f"[논리구조] Loading conservative news model from {conservative_path}...", file=sys.stderr)
            try:
                with open(conservative_path, 'rb') as f:
                    CONSERVATIVE_MODEL = pickle.load(f)
                
                cons_vocab_size = len(CONSERVATIVE_MODEL) if hasattr(CONSERVATIVE_MODEL, '__len__') else 'unknown'
                if hasattr(CONSERVATIVE_MODEL, 'wv') and hasattr(CONSERVATIVE_MODEL.wv, 'key_to_index'):
                    cons_vocab_size = len(CONSERVATIVE_MODEL.wv.key_to_index)
                
                LOGICAL_STRUCTURE_INFO['conservative_loaded'] = True
                print(f"[논리구조] ✅ 보수 언론사 모델 로드 완료! Vocab: {cons_vocab_size}", file=sys.stderr)
                print(f"    - 출처: 조선일보, 중앙일보, 문화일보, 매일경제, 한국경제, SBS, YTN", file=sys.stderr)
                print(f"    - 학습 데이터: 2만 정치 기사", file=sys.stderr)
            except Exception as e:
                print(f"[논리구조] ⚠️ 보수 모델 로드 실패: {e}", file=sys.stderr)
                print(f"[논리구조] 💡 gensim이 필요한 모델입니다. 기존 분석 방식을 사용합니다.", file=sys.stderr)
        else:
            print(f"[논리구조] ⚠️ 보수 모델을 찾을 수 없습니다: {conservative_path}", file=sys.stderr)
        
        if PROGRESSIVE_MODEL and CONSERVATIVE_MODEL:
            print(f"[논리구조] 🎯 주어-서술어 논리 구조 분석 활성화!", file=sys.stderr)
        else:
            print(f"[논리구조] ⚠️ 논리 구조 모델 미사용 - 기존 Word2Vec 모델로 분석합니다.", file=sys.stderr)
    
    except Exception as e:
        print(f"[Word2Vec] 모델 로드 실패: {e}", file=sys.stderr)

def load_lexicon(path):
        """
        정치 성향 어휘 사전(JSON)을 로드하여 진보(Left)/보수(Right) 단어 집합(Set)을 반환합니다.

        입력 파일은 다음의 키를 포함한다고 가정합니다:
            {
                "bias_left_words": ["단어1", "단어2", ...],
                "bias_right_words": ["단어A", "단어B", ...]
            }

        반환값:
            left_set, right_set  (각각 Python `set`)
        """
        # 지정된 경로의 파일을 UTF-8 인코딩으로 열어 JSON 파싱
        with open(path, "r", encoding="utf-8") as f:
                lex = json.load(f)

        # 공백 제거 및 빈 문자열 필터링 후 set으로 변환
        left = set([w.strip() for w in lex.get("bias_left_words", []) if w.strip()])
        right = set([w.strip() for w in lex.get("bias_right_words", []) if w.strip()])

        return left, right


def normalize_token(tok):
    """토큰 정규화"""
    return tok.strip()


# ============================================================
# 본문 정제 함수
# ============================================================
def clean_article_text(text):
    """
    기사에서 순수한 본문만 추출
    - 기자명, 이미지 캡션, 메타정보, 관련기사, 날짜 등 제거
    - 네이버 뉴스 HTML 구조에서 발생하는 불필요한 텍스트 제거
    """
    if not text:
        return ""
    
    # 기자명 패턴 제거 (다양한 형태)
    text = re.sub(r'[=\[]?\s*[가-힣]{2,4}\s*기자\s*[\]]*', '', text)
    text = re.sub(r'기자\s*[=\[]?\s*[가-힣]{2,4}\s*[\]]*', '', text)
    text = re.sub(r'[가-힣]{2,4}\s+기자\s*[=]?', '', text)
    text = re.sub(r'\([가-힣]{2,4}\s*기자\)', '', text)
    
    # 이미지 관련 캡션 제거
    text = re.sub(r'이미지\s*(확대|축소|보기|출처|제공|캡처|클릭)', '', text)
    text = re.sub(r'사진\s*[=:]?\s*[가-힣\s]+', '', text)
    text = re.sub(r'\[사진\]|\[그래픽\]|\[영상\]|\[동영상\]', '', text)
    text = re.sub(r'\[.*?제공\]', '', text)
    text = re.sub(r'그래픽\s*[=:]?\s*[가-힣\s]+', '', text)
    
    # 날짜/시간 패턴 제거
    text = re.sub(r'\d{4}[-.년]\s*\d{1,2}[-.월]\s*\d{1,2}일?', '', text)
    text = re.sub(r'\d{1,2}:\d{2}(:\d{2})?', '', text)
    text = re.sub(r'(입력|수정|발행|배포|송고)\s*[:=]?\s*\d{4}.*?\d{2}', '', text)
    
    # 뉴스 메타정보 제거
    text = re.sub(r'본지\s*DB', '', text)
    text = re.sub(r'(연합뉴스|뉴시스|뉴스1|머니투데이|JTBC|KBS|MBC|SBS|YTN)', '', text)
    text = re.sub(r'[\(]?출처[:\s].*?[\)]?', '', text)
    text = re.sub(r'ⓒ.*?(무단.*?금지)?', '', text)
    text = re.sub(r'저작권자.*?무단.*?금지', '', text)
    
    # 관련 기사/링크 패턴 제거
    text = re.sub(r'관련\s*기사.*?(?=\n|$)', '', text)
    text = re.sub(r'(이전|다음|추천)\s*기사', '', text)
    text = re.sub(r'▶\s*관련기사.*?◀', '', text)
    text = re.sub(r'☞\s*관련기사', '', text)
    
    # 기자 정보/연락처 제거
    text = re.sub(r'[가-힣]{2,4}\s*기자\s*[\w\.-]+@[\w\.-]+', '', text)
    text = re.sub(r'\[.*?특파원\]', '', text)
    text = re.sub(r'\[.*?통신원\]', '', text)
    
    # 광고/프로모션 텍스트 제거
    text = re.sub(r'(무단|무단전재).*?(전재|배포|재배포).*?금지', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Copyright.*?All rights reserved', '', text, flags=re.IGNORECASE)
    
    # URL, 이메일 제거
    text = re.sub(r'http[s]?://\S+', '', text)
    text = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '', text)
    
    # 특수문자 정리 (과도한 기호 제거)
    text = re.sub(r'[▶◀☞◆●■□○◇△▲▼]', '', text)
    text = re.sub(r'[=]{2,}', '', text)
    text = re.sub(r'[-]{3,}', '', text)
    
    # 과도한 공백 정리
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\n\s*\n+', '\n', text)
    
    return text.strip()


def clean_article_text_preserve_html(text):
    """
    기사에서 순수한 본문만 추출하되 HTML 구조는 보존
    - strong, em, img 태그는 유지
    - 기자명, 메타정보는 제거
    """
    if not text:
        return ""
    
    # 먼저 보존할 태그를 플레이스홀더로 대체
    preserved_tags = {}
    tag_counter = 0
    
    # strong 태그 보존
    for match in re.finditer(r'<strong[^>]*>(.*?)</strong>', text, re.DOTALL):
        placeholder = f"__STRONG_{tag_counter}__"
        preserved_tags[placeholder] = match.group(0)
        text = text.replace(match.group(0), placeholder, 1)
        tag_counter += 1
    
    # em 태그 보존
    for match in re.finditer(r'<em[^>]*>(.*?)</em>', text, re.DOTALL):
        placeholder = f"__EM_{tag_counter}__"
        preserved_tags[placeholder] = match.group(0)
        text = text.replace(match.group(0), placeholder, 1)
        tag_counter += 1
    
    # img 태그 보존
    for match in re.finditer(r'<img[^>]*>', text):
        placeholder = f"__IMG_{tag_counter}__"
        preserved_tags[placeholder] = match.group(0)
        text = text.replace(match.group(0), placeholder, 1)
        tag_counter += 1
    
    # 기존 clean_article_text와 동일한 정제 과정
    # 기자명 패턴 제거
    text = re.sub(r'[=\[]?\s*[가-힣]{2,4}\s*기자\s*[\]]*', '', text)
    text = re.sub(r'기자\s*[=\[]?\s*[가-힣]{2,4}\s*[\]]*', '', text)
    text = re.sub(r'[가-힣]{2,4}\s+기자\s*[=]?', '', text)
    text = re.sub(r'\([가-힣]{2,4}\s*기자\)', '', text)
    
    # 이미지 관련 캡션 제거 (단, em 태그는 보존)
    text = re.sub(r'이미지\s*(확대|축소|보기|출처|제공|캡처|클릭)', '', text)
    text = re.sub(r'\[사진\]|\[그래픽\]|\[영상\]|\[동영상\]', '', text)
    
    # 날짜/시간 패턴 제거
    text = re.sub(r'\d{4}[-.\ub144]\s*\d{1,2}[-.\uc6d4]\s*\d{1,2}일?', '', text)
    text = re.sub(r'\d{1,2}:\d{2}(:\d{2})?', '', text)
    
    # 뉴스 메타정보 제거
    text = re.sub(r'(연합뉴스|뉴시스|뉴스1|KBS|MBC|SBS|YTN|JTBC)', '', text)
    text = re.sub(r'ⓒ.*?(무단.*?금지)?', '', text)
    
    # URL, 이메일 제거
    text = re.sub(r'http[s]?://\S+', '', text)
    text = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '', text)
    
    # 특수문자 정리
    text = re.sub(r'[▶◀☞◆●■□○◇△▲▼]', '', text)
    text = re.sub(r'[=]{2,}', '', text)
    
    # HTML 태그 제거 (br은 줄바꿈으로 변환)
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'<p>', '\n\n', text)
    text = re.sub(r'</p>', '', text)
    text = re.sub(r'<[^>]+>', '', text)
    
    # 과도한 공백 정리
    text = re.sub(r' +', ' ', text)
    text = re.sub(r'\n\s*\n+', '\n\n', text)
    
    # 플레이스홀더를 원래 태그로 복원
    for placeholder, original_tag in preserved_tags.items():
        text = text.replace(placeholder, original_tag)
    
    return text.strip()


# ============================================================
# 불용어 및 품사 필터링
# ============================================================
KOREAN_STOPWORDS = {
    # 단순 조사/어미만 제거 (너무 많이 제거하지 않도록)
    '의', '가', '이', '은', '들', '는', '을', '를', '에', '와', '과', '도',
    '기자', '취재', '보도', '전했다', '밝혔다', '말했다',
    '이미지', '확대', '사진', '제공', '출처'
}

# 품사 필터링을 완화 - 명사, 동사, 형용사, 부사 모두 포함
VALID_POS_TAGS = {
    'NNG',  # 일반 명사
    'NNP',  # 고유 명사
    'NNB',  # 의존 명사
    'VV',   # 동사
    'VA',   # 형용사
    'VX',   # 보조 용언
    'MAG',  # 일반 부사
    'XR',   # 어근
}

def is_valid_token(form, pos):
    """유효한 토큰인지 검사"""
    # 품사 체크
    if pos not in VALID_POS_TAGS:
        return False
    
    # 불용어 체크
    if form in KOREAN_STOPWORDS:
        return False
    
    # 길이 체크 (1글자는 제외하되, 2글자 이상은 허용)
    if len(form) < 2:
        return False
    
    # 숫자만 있는 토큰 제외
    if form.isdigit():
        return False
    
    return True


def extract_subject_predicate_pairs(tokens):
    """
    주어-서술어 쌍 추출 (논리 구조 분석의 핵심)
    
    Args:
        tokens: [(form, pos), ...] 형태의 토큰 리스트
    
    Returns:
        list: [{'subject': str, 'predicate': str, 'subject_pos': str, 'predicate_pos': str}, ...]
    """
    pairs = []
    subject_candidates = []
    
    for i, (form, pos) in enumerate(tokens):
        # 주어 후보: 명사(NNG, NNP, NNB)
        if pos in ['NNG', 'NNP', 'NNB'] and len(form) >= 2:
            subject_candidates.append({'word': form, 'pos': pos, 'index': i})
        
        # 서술어: 동사(VV), 형용사(VA)
        if pos in ['VV', 'VA'] and len(form) >= 2:
            # 가장 가까운 주어 찾기 (최대 10토큰 이내)
            for subj in reversed(subject_candidates[-10:]):
                if i - subj['index'] <= 10:
                    pairs.append({
                        'subject': subj['word'],
                        'predicate': form,
                        'subject_pos': subj['pos'],
                        'predicate_pos': pos,
                        'distance': i - subj['index']
                    })
                    break
    
    return pairs


def get_word_vector_from_model(word, model):
    """
    Word2Vec 모델에서 단어 벡터 추출 (gensim 또는 dict 형식 지원)
    
    Args:
        word: 단어
        model: Word2Vec 모델 또는 dict
    
    Returns:
        numpy array 또는 None
    """
    if model is None:
        return None
    
    try:
        # gensim KeyedVectors 형식
        if hasattr(model, 'wv'):
            if word in model.wv:
                return model.wv[word]
        # gensim 구버전 또는 직접 접근
        elif hasattr(model, '__getitem__'):
            if word in model:
                return model[word]
        # dict 형식
        elif isinstance(model, dict):
            return model.get(word)
    except Exception:
        pass
    
    return None


def get_word_vector(word, model):
    """Word2Vec 모델에서 단어 벡터 가져오기 (gensim KeyedVectors 및 dict 지원)"""
    if model is None:
        return None
    try:
        # gensim KeyedVectors 형식 (우선순위)
        if hasattr(model, 'get_vector'):
            return model.get_vector(word)
        # 딕셔너리 형식
        elif hasattr(model, '__getitem__'):
            return model[word]
        else:
            return None
    except KeyError:
        # 단어가 어휘에 없음
        return None
    except Exception:
        return None


def extract_topic_vector(text, word2vec_model):
    """
    기사 제목과 설명에서 주제 벡터 추출
    
    Args:
        text: 제목 + 설명 텍스트
        word2vec_model: Word2Vec 모델
    
    Returns:
        numpy array: 주제의 평균 벡터
    """
    if word2vec_model is None or not text:
        return None
    
    import numpy as np
    from kiwipiepy import Kiwi
    
    k = Kiwi()
    try:
        result = k.tokenize(text)
        tokens = [(token.form, token.tag) for token in result]
        valid_tokens = [(form, pos) for form, pos in tokens if is_valid_token(form, pos)]
        
        if not valid_tokens:
            return None
        
        # 유효한 토큰의 벡터 수집
        vectors = []
        for form, pos in valid_tokens:
            vec = get_word_vector(form, word2vec_model)
            if vec is not None:
                vectors.append(vec)
        
        if not vectors:
            return None
        
        # 평균 벡터 반환
        return np.mean(vectors, axis=0)
    
    except Exception:
        return None


def filter_relevant_sentences(article_text, topic_vector, word2vec_model, threshold=0.3):
    """
    주제와 관련된 문장만 필터링 (본문 정제 강화)
    
    Args:
        article_text: 기사 전체 본문
        topic_vector: 주제 벡터 (제목+설명 기반)
        word2vec_model: Word2Vec 모델
        threshold: 유사도 임계값
    
    Returns:
        str: 주제 관련 문장만 포함된 정제 본문
    """
    if topic_vector is None or not article_text:
        return article_text
    
    import numpy as np
    from kiwipiepy import Kiwi
    
    k = Kiwi()
    
    # 문장 분리
    sentences = article_text.split('.')
    relevant_sentences = []
    
    for sent in sentences:
        sent = sent.strip()
        if len(sent) < 10:  # 너무 짧은 문장 제외
            continue
        
        try:
            # 문장 벡터 추출
            result = k.tokenize(sent)
            tokens = [(token.form, token.tag) for token in result]
            valid_tokens = [(form, pos) for form, pos in tokens if is_valid_token(form, pos)]
            
            if not valid_tokens:
                continue
            
            # 문장의 평균 벡터 계산
            sent_vectors = []
            for form, pos in valid_tokens:
                vec = get_word_vector(form, word2vec_model)
                if vec is not None:
                    sent_vectors.append(vec)
            
            if not sent_vectors:
                continue
            
            sent_vector = np.mean(sent_vectors, axis=0)
            
            # 주제 벡터와 코사인 유사도 계산
            similarity = np.dot(sent_vector, topic_vector) / (
                np.linalg.norm(sent_vector) * np.linalg.norm(topic_vector)
            )
            
            # 임계값 이상이면 관련 문장으로 간주
            if similarity >= threshold:
                relevant_sentences.append(sent)
        
        except Exception:
            continue
    
    # 관련 문장이 너무 적으면 원문 반환
    if len(relevant_sentences) < 2:
        return article_text
    
    return '. '.join(relevant_sentences) + '.'


def calculate_semantic_score(tokens, bias_words, word2vec_model, threshold=None):
    """
    Word2Vec 유사도 기반 의미론적 점수 계산 (한국어 정치 뉴스 최적화)
    
    Args:
        tokens: 기사의 토큰 리스트 [(형태소, 품사), ...]
        bias_words: 편향 단어 집합 (set)
        word2vec_model: 사전학습된 Word2Vec 모델
        threshold: 유사도 임계값 (None이면 WORD2VEC_INFO에서 가져옴)
    
    Returns:
        float: 의미론적 유사도 점수 (정규화됨)
    """
    if word2vec_model is None or not tokens:
        return 0.0
    
    import numpy as np
    
    # 동적 임계값 설정
    if threshold is None:
        threshold = WORD2VEC_INFO['threshold']
    
    score = 0.0
    match_count = 0  # 유사도 매칭 횟수
    forms = [form for form, pos in tokens]
    
    # 편향 단어들의 벡터 수집
    bias_vectors = []
    bias_words_with_vectors = []  # 벡터가 있는 편향 단어만 저장
    
    for bias_word in bias_words:
        vec = get_word_vector(bias_word, word2vec_model)
        if vec is not None:
            bias_vectors.append(vec)
            bias_words_with_vectors.append(bias_word)
    
    if not bias_vectors:
        return 0.0
    
    # 편향 단어들의 평균 벡터 계산
    avg_bias_vector = np.mean(bias_vectors, axis=0)
    
    # 각 토큰과 편향 벡터 간 코사인 유사도 계산
    for token in forms:
        # 이미 편향 단어 집합에 있는 경우 스킵 (중복 점수 방지)
        if token in bias_words_with_vectors:
            continue
        
        token_vec = get_word_vector(token, word2vec_model)
        if token_vec is not None:
            # 코사인 유사도 계산
            norm_product = np.linalg.norm(token_vec) * np.linalg.norm(avg_bias_vector)
            if norm_product > 0:
                similarity = np.dot(token_vec, avg_bias_vector) / norm_product
                
                # 임계값 이상인 경우만 점수에 추가
                if similarity >= threshold:
                    # 한국어 정치 뉴스 모델: 유사도를 제곱하여 강한 연관성에 가중치
                    if WORD2VEC_INFO['type'] == 'korean_political':
                        score += similarity ** 1.5
                    else:
                        score += similarity
                    match_count += 1
    
    # 정규화: 토큰 수가 많을수록 점수가 비례 증가하는 것을 방지
    # 루트 스케일링으로 긴 기사에서도 공정한 비교 가능
    if match_count > 0:
        score = score * np.sqrt(match_count) / max(1, np.log1p(len(forms)))
    
    return score


def classify_articles(input_path, lex_path, out_blue, out_red, verb_bonus=0.8, window=3, margin=0.5):
    """
    기사를 분류하는 메인 로직 함수
    매개변수: 입력파일, 사전파일, 출력파일(청/홍), 동사가중치, 윈도우크기, 점수마진
    """
    # 입력 파일이 존재하는지 확인
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # 입력 JSON 파일(기사 데이터)을 읽어옴
    with open(input_path, "r", encoding="utf-8") as f:
        articles = json.load(f)

    # 어휘 사전 로드 (진보/보수 단어셋)
    left_set, right_set = load_lexicon(lex_path)
    print(f"Loaded lexicon: {len(left_set)} left words, {len(right_set)} right words")

    # ---------- 1) 어휘 사전 + Kiwi를 이용한 약한 라벨링 (Weak Labeling) ----------

    # Kiwi 형태소 분석기 인스턴스 생성
    k = Kiwi()

    # ---- lexicon morph expansion: 각 편향 단어를 형태소로 분해하여 'morph' 집합 생성
    # 목적: 복합어/파생어에 대해서도 어휘 사전의 신호를 잡아낼 수 있게 함
    # 예: 사전에 '친환경'이 있어도 기사에 '친환경적'처럼 파생형이 나오면
    #      형태소 분해를 통해 '친환경' 신호를 잡을 수 있도록 함.
    left_morphs = set()
    right_morphs = set()
    try:
        # 원본 lex JSON도 필요하므로 로드(이미 loaded via load_lexicon, but open file for extra categories)
        with open(lex_path, 'r', encoding='utf-8') as lf:
            lex_full = json.load(lf)
    except Exception:
        lex_full = {}

    # for each bias token, extract morphemes and add to morph sets (helps matching compound tokens)
    for w in left_set:
        try:
            toks = k.tokenize(w)
            for t in toks:
                left_morphs.add(normalize_token(t[0]))
        except Exception:
            left_morphs.add(w)
    for w in right_set:
        try:
            toks = k.tokenize(w)
            for t in toks:
                right_morphs.add(normalize_token(t[0]))
        except Exception:
            right_morphs.add(w)

    # 또한 `public/wordcloud.json`에 있던 상위 이슈 키워드를 불러와
    # 약한 신호로서 점수에 약간의 보너스를 줄 수 있도록 함.
    # (워드클라우드에서 자주 나온 단어들을 이슈 키워드로 활용)
    issue_keywords = set()
    try:
        wcpath = os.path.join(os.getcwd(), 'public', 'wordcloud.json')
        if os.path.exists(wcpath):
            with open(wcpath, 'r', encoding='utf-8') as wf:
                wc = json.load(wf)
                # wc is list of [word, weight]
                for item in wc[:50]:
                    if isinstance(item, (list, tuple)) and len(item) >= 1:
                        issue_keywords.add(str(item[0]).strip())
    except Exception:
        issue_keywords = set()

    # Save expanded lexicon (morph lists) for inspection (디버깅/검토용)
    try:
        os.makedirs(os.path.join(os.getcwd(), 'public'), exist_ok=True)
        expanded = {
            'left_morphs': sorted(list(left_morphs))[:500],
            'right_morphs': sorted(list(right_morphs))[:500],
            'issue_keywords': sorted(list(issue_keywords))[:200]
        }
        with open(os.path.join(os.getcwd(), 'public', 'lexicon_expanded_preview.json'), 'w', encoding='utf-8') as ef:
            json.dump(expanded, ef, ensure_ascii=False, indent=2)
    except Exception:
        pass

    # 나중에 모델 학습에 사용할 텍스트와 라벨을 담을 리스트
    weak_texts = []
    weak_labels = []
    # 모든 기사의 처리 결과(기사 객체, 판정된 라벨)를 담을 리스트
    details = []

    print("[Step 1] Cleaning and analyzing articles...")
    # 기사들을 하나씩 순회하며 분석
    for idx, art in enumerate(articles):
        # 기사 내용 추출
        raw_text = art.get("full_text") or art.get("description") or art.get("title") or ""
        
        # 텍스트가 비어있으면 분석 건너뛰기
        if not raw_text or not raw_text.strip():
            details.append((art, None))
            continue

        # [개선] 본문 정제 - 기자명, 이미지 캡션, 메타정보 제거
        text = clean_article_text(raw_text)
        
        if not text.strip():
            details.append((art, None))
            continue

        # 형태소 분석 수행
        try:
            # Kiwi의 tokenize() 메서드 사용
            result = k.tokenize(text)
            # tokenize() 결과를 (형태소, 품사) 형태로 변환
            tokens = [(token.form, token.tag) for token in result]
        except Exception:
            tokens = []

        # [개선] 유효한 토큰만 추출 (품사 필터링 + 불용어 제거)
        valid_tokens = [(form, pos) for form, pos in tokens if is_valid_token(form, pos)]
        
        if not valid_tokens:
            details.append((art, None))
            continue
        
        forms = [form for form, pos in valid_tokens]
        poses = [pos for form, pos in valid_tokens]

        # 점수 초기화
        left_score = 0.0
        right_score = 0.0

        # [1단계 점수] 기본 어휘 및 형태소 일치 카운트
        # - 토큰이 어휘 사전에 정확히 있거나, 형태소 분해 결과에서 발견되면 점수 추가
        # - 이슈 키워드와 일치하면 작은 보너스를 부여하여 주제어가 신호로 작용하도록 함
        for f in forms:
            # 어휘 사전(정확 일치) 또는 형태소 확장셋에 포함되는지 체크
            if f in left_set or f in left_morphs:
                left_score += 1.0  # 진보 신호
            if f in right_set or f in right_morphs:
                right_score += 1.0  # 보수 신호
            # 워드클라우드 기반 이슈 키워드는 양쪽에 소량의 신호를 줘서
            # 주제 연관성을 반영하지만 편향을 강하게 뒤집지는 않음
            if f in issue_keywords:
                left_score += 0.15
                right_score += 0.15
        
        # [1.5단계] Word2Vec 의미론적 유사도 점수 추가 (동적 가중치)
        if WORD2VEC_MODEL is not None and HAS_NUMPY:
            try:
                semantic_left = calculate_semantic_score(valid_tokens, left_set, WORD2VEC_MODEL)
                semantic_right = calculate_semantic_score(valid_tokens, right_set, WORD2VEC_MODEL)
                
                # 모델 타입에 따른 동적 가중치 적용
                w2v_weight = WORD2VEC_INFO['weight']
                left_score += semantic_left * w2v_weight
                right_score += semantic_right * w2v_weight
                
                # 한국어 정치 뉴스 모델: 문맥 신호 강화
                if WORD2VEC_INFO['type'] == 'korean_political':
                    # 양쪽 모두 유사도가 높으면 중립적 이슈
                    if semantic_left > 0 and semantic_right > 0:
                        neutrality_factor = min(semantic_left, semantic_right) / max(semantic_left, semantic_right)
                        if neutrality_factor > 0.7:  # 70% 이상 유사하면
                            # 중립 보너스 (양쪽 점수를 약간 감소)
                            left_score *= 0.9
                            right_score *= 0.9
            
            except Exception as e:
                # Word2Vec 에러 발생 시 기본 분석만 사용
                pass

        # [2단계 점수] 동사 근접 보너스 (문맥 가중치)
        for i, f in enumerate(forms):
            # 현재 단어가 진보 단어라면
            if f in left_set:
                # 현재 위치 i를 기준으로 앞뒤 window 크기만큼 탐색
                for j in range(max(0, i - window), min(len(forms), i + window + 1)):
                    # 주변 단어의 품사가 'V'(동사)로 시작하면
                    if poses[j].startswith("V"):
                        left_score += float(verb_bonus) # 가중치 추가
            
            # 현재 단어가 보수 단어라면 (위와 동일 로직)
            if f in right_set:
                for j in range(max(0, i - window), min(len(forms), i + window + 1)):
                    if poses[j].startswith("V"):
                        right_score += float(verb_bonus)

        # [라벨 결정] 점수 비교
        label = None
        # 진보 점수가 보수 점수 + 마진보다 크면 'blue'
        if left_score > right_score + margin:
            label = 'blue'
        # 보수 점수가 진보 점수 + 마진보다 크면 'red'
        elif right_score > left_score + margin:
            label = 'red'
        else:
            # 점수 차이가 미미하면 중립(None) 처리
            label = None

        # 결과 저장
        details.append((art, label))
        
        # 확실하게 라벨링 된 데이터만 학습용 리스트에 추가
        if label in ('blue', 'red'):
            weak_texts.append(text)
            weak_labels.append(label)

        # 진행 상황 출력 (50개 단위)
        if (idx + 1) % 50 == 0:
            print(f"Weak-labeling progress {idx+1}/{len(articles)} - weak labeled: {len(weak_labels)}")

    print(f"Weak labeling complete: {len(weak_labels)} labelled articles")

    # ---------- 2) 약한 라벨링 데이터로 TF-IDF + 분류기 학습 (데이터 충분 시) ----------
    model = None
    vectorizer = None

    # scikit-learn이 없으면 학습 단계 스킵
    if TfidfVectorizer is None:
        print("scikit-learn not available — cannot train classifier. Falling back to rule-based outputs.")
    # 학습 데이터가 너무 적으면(10개 미만) 학습 스킵
    elif len(weak_labels) < 10:
        print("Not enough weak-labeled articles to train a classifier. Need more labeled examples.")
    else:
        # 학습 데이터 준비: 텍스트
        X = weak_texts
        # 학습 데이터 준비: 라벨 ('blue'는 1, 그 외 'red'는 0으로 변환)
        y = [1 if lab == 'blue' else 0 for lab in weak_labels]

        # 데이터를 학습용(Train)과 검증용(Validation)으로 분리 (85:15 비율)
        X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.15, random_state=42, stratify=y)

        # TF-IDF 벡터화 도구 설정 (최대 2만 단어, 1~2음절 n-gram 사용)
        vectorizer = TfidfVectorizer(max_features=20000, ngram_range=(1,2))
        # 학습 데이터를 벡터화 (fit + transform)
        Xtr = vectorizer.fit_transform(X_train)
        # 검증 데이터를 벡터화 (transform only)
        Xval = vectorizer.transform(X_val)

        # 분류 모델 학습 시도: 로지스틱 회귀 (LogisticRegression)
        try:
            # 모델 설정 (불균형 데이터 가중치 자동 조절, solver 지정)
            clf = LogisticRegression(solver='liblinear', class_weight='balanced', max_iter=1000)
            clf.fit(Xtr, y_train) # 학습 수행
            ypred = clf.predict(Xval) # 검증 데이터 예측
            print("Classifier trained (LogisticRegression). Validation report:")
            # 성능 평가 지표 출력
            print(classification_report(y_val, ypred, digits=3))
            model = clf # 학습된 모델 저장
        except Exception:
            # 로지스틱 회귀 실패 시 LinearSVC로 재시도
            svc = LinearSVC(class_weight='balanced', max_iter=2000)
            svc.fit(Xtr, y_train)
            ypred = svc.predict(Xval)
            print("Classifier trained (LinearSVC). Validation report:")
            print(classification_report(y_val, ypred, digits=3))
            model = svc

        # 학습된 모델과 벡터화 도구를 public 폴더에 파일로 저장 (서버 사용 목적)
        try:
            model_dir = os.path.join(os.getcwd(), 'public') # 저장 경로 설정
            os.makedirs(model_dir, exist_ok=True) # 폴더가 없으면 생성
            vec_path = os.path.join(model_dir, 'tfidf_vectorizer.pkl')
            model_path = os.path.join(model_dir, 'classifier_model.pkl')
            
            # pickle을 사용하여 객체 저장
            with open(vec_path, 'wb') as vf:
                pickle.dump(vectorizer, vf)
            with open(model_path, 'wb') as mf:
                pickle.dump(model, mf)
            print(f'Saved model -> {model_path} and {vec_path}')
        except Exception as e:
            print('Warning: failed to save model files:', e)

    # ---------- 3) 모델이 있으면 모델로 전체 분류, 없으면 규칙 기반 결과 사용 ----------
    blue = []
    red = []

    if model is not None and vectorizer is not None:
        # 모델이 성공적으로 학습되었다면, 전체 기사를 대상으로 재분류 수행
        all_texts = [ (art.get('full_text') or art.get('description') or art.get('title') or '') for art in articles ]
        # 전체 텍스트 벡터화
        Xall = vectorizer.transform(all_texts)
        # 모델 예측 수행
        preds = model.predict(Xall)
        
        # 예측 결과에 따라 기사 분류
        for art, p in zip(articles, preds):
            if p == 1:
                blue.append(art) # 1이면 Blue
            else:
                red.append(art)  # 0이면 Red
        print(f"Model classification complete: blue={len(blue)} red={len(red)}")
    else:
        # 모델 학습에 실패했거나 데이터가 부족하면, 앞서 수행한 규칙 기반 라벨링 결과 사용
        for art, label in details:
            if label == 'blue':
                blue.append(art)
            elif label == 'red':
                red.append(art)
        print(f"Rule-based output: blue={len(blue)} red={len(red)} neutral={len([1 for _,l in details if l is None])}")

    # 분류 결과 파일 저장
    with open(out_blue, "w", encoding="utf-8") as f:
        json.dump(blue, f, ensure_ascii=False, indent=2) # Blue 기사 저장
    with open(out_red, "w", encoding="utf-8") as f:
        json.dump(red, f, ensure_ascii=False, indent=2)  # Red 기사 저장

    # 중립 기사 개수 계산
    neutral_count = len(articles) - len(blue) - len(red)
    print("Classification complete:")
    print(f"  blue (진보) articles: {len(blue)} -> {out_blue}")
    print(f"  red  (보수) articles: {len(red)} -> {out_red}")
    print(f"  neutral articles: {neutral_count}")


def calculate_ideological_score(sent_vector, progressive_vector, conservative_vector, fact_threshold=0.2):
    """
    문장 벡터의 이념적 성향 분석 (3분류)
    
    Args:
        sent_vector: 문장의 평균 벡터
        progressive_vector: 진보 개념 벡터
        conservative_vector: 보수 개념 벡터
        fact_threshold: 사실보도 임계값
    
    Returns:
        dict: {'type': 'progressive'|'conservative'|'factual', 'progressive_score': float, 'conservative_score': float}
    """
    import numpy as np
    
    # 진보 개념과의 유사도
    prog_sim = np.dot(sent_vector, progressive_vector) / (
        np.linalg.norm(sent_vector) * np.linalg.norm(progressive_vector) + 1e-10
    )
    
    # 보수 개념과의 유사도
    cons_sim = np.dot(sent_vector, conservative_vector) / (
        np.linalg.norm(sent_vector) * np.linalg.norm(conservative_vector) + 1e-10
    )
    
    # 두 유사도 모두 낮으면 사실보도
    if prog_sim < fact_threshold and cons_sim < fact_threshold:
        return {
            'type': 'factual',
            'progressive_score': float(max(0, prog_sim)),
            'conservative_score': float(max(0, cons_sim))
        }
    
    # 유사도 차이가 크지 않으면 사실보도
    diff = abs(prog_sim - cons_sim)
    if diff < 0.1:
        return {
            'type': 'factual',
            'progressive_score': float(max(0, prog_sim)),
            'conservative_score': float(max(0, cons_sim))
        }
    
    # 진보 vs 보수 판단
    if prog_sim > cons_sim:
        return {
            'type': 'progressive',
            'progressive_score': float(max(0, prog_sim)),
            'conservative_score': float(max(0, cons_sim))
        }
    else:
        return {
            'type': 'conservative',
            'progressive_score': float(max(0, prog_sim)),
            'conservative_score': float(max(0, cons_sim))
        }


def calculate_logical_structure_score(sp_pairs, progressive_model, conservative_model, fact_threshold=0.2):
    """
    주어-서술어 쌍의 논리 구조를 진보/보수 모델과 비교 (3분류)
    
    Args:
        sp_pairs: 주어-서술어 쌍 리스트
        progressive_model: 진보 논리 구조 모델
        conservative_model: 보수 논리 구조 모델
        fact_threshold: 사실보도 임계값
    
    Returns:
        dict: {'type': 'progressive'|'conservative'|'factual', 'progressive_score': float, 'conservative_score': float}
    """
    if not sp_pairs or progressive_model is None or conservative_model is None:
        return {'type': 'factual', 'progressive_score': 0.0, 'conservative_score': 0.0}
    
    import numpy as np
    
    prog_scores = []
    cons_scores = []
    
    for pair in sp_pairs:
        subj = pair['subject']
        pred = pair['predicate']
        
        # 주어와 서술어의 벡터 추출
        subj_prog_vec = get_word_vector_from_model(subj, progressive_model)
        pred_prog_vec = get_word_vector_from_model(pred, progressive_model)
        
        subj_cons_vec = get_word_vector_from_model(subj, conservative_model)
        pred_cons_vec = get_word_vector_from_model(pred, conservative_model)
        
        # 진보 모델과의 유사도 (주어-서술어 조합)
        if subj_prog_vec is not None and pred_prog_vec is not None:
            # 주어와 서술어의 평균 벡터
            pair_prog_vec = (subj_prog_vec + pred_prog_vec) / 2
            # 문맥 벡터와의 코사인 유사도
            prog_sim = np.dot(subj_prog_vec, pred_prog_vec) / (
                np.linalg.norm(subj_prog_vec) * np.linalg.norm(pred_prog_vec) + 1e-10
            )
            prog_scores.append(max(0, prog_sim))  # 음수 제거
        
        # 보수 모델과의 유사도
        if subj_cons_vec is not None and pred_cons_vec is not None:
            cons_sim = np.dot(subj_cons_vec, pred_cons_vec) / (
                np.linalg.norm(subj_cons_vec) * np.linalg.norm(pred_cons_vec) + 1e-10
            )
            cons_scores.append(max(0, cons_sim))
    
    # 평균 유사도 계산
    prog_score = np.mean(prog_scores) if prog_scores else 0.0
    cons_score = np.mean(cons_scores) if cons_scores else 0.0
    
    # 두 유사도 모두 낮으면 사실보도
    if prog_score < fact_threshold and cons_score < fact_threshold:
        return {
            'type': 'factual',
            'progressive_score': float(prog_score),
            'conservative_score': float(cons_score)
        }
    
    # 유사도 차이가 크지 않으면 사실보도
    diff = abs(prog_score - cons_score)
    if diff < 0.1:
        return {
            'type': 'factual',
            'progressive_score': float(prog_score),
            'conservative_score': float(cons_score)
        }
    
    # 진보 vs 보수 판단
    if prog_score > cons_score:
        return {
            'type': 'progressive',
            'progressive_score': float(prog_score),
            'conservative_score': float(cons_score)
        }
    else:
        return {
            'type': 'conservative',
            'progressive_score': float(prog_score),
            'conservative_score': float(cons_score)
        }


def analyze_single_article(text, lex_path=None, verb_bonus=0.8, window=3, margin=0.5):
    """
    단일 기사에 대한 상세 분석 (Insight 페이지용)
    주어-서술어 논리 구조 기반 분석 (fallback: Word2Vec 의미론적 분석)
    
    반환값:
        {
            "total_left_score": float,
            "total_right_score": float,
            "bias_label": "blue" | "red" | "factual",
            "left_keywords": [{"word": str, "count": int, "score": float}],
            "right_keywords": [{"word": str, "count": int, "score": float}],
            "subject_predicate_pairs": [{"subject": str, "predicate": str, "type": str}],
            "sentences": [{"text": str, "type": str, "progressive_score": float, "conservative_score": float}]
        }
    """
    import numpy as np
    
    # 분석 모드 결정: 논리 구조 모델 또는 Word2Vec 모델
    use_logical_structure = (PROGRESSIVE_MODEL is not None and CONSERVATIVE_MODEL is not None)
    use_word2vec = (WORD2VEC_MODEL is not None and not use_logical_structure)
    
    if not use_logical_structure and not use_word2vec:
        return {"error": "No analysis model available (neither logical structure nor Word2Vec)"}
    
    # Kiwi 형태소 분석기 초기화
    k = Kiwi()
    
    # [개선] 본문 정제 (텍스트 분석용)
    clean_text = clean_article_text(text)
    
    # HTML 구조 보존 버전 (표시용)
    clean_text_html = clean_article_text_preserve_html(text)
    
    if not clean_text.strip():
        return {"error": "No valid text after cleaning"}
    
    # 형태소 분석
    try:
        result = k.tokenize(clean_text)
        tokens = [(token.form, token.tag) for token in result]
    except:
        tokens = []
    
    # [개선] 유효한 토큰만 추출 (품사 필터링 + 불용어 제거)
    valid_tokens = [(form, pos) for form, pos in tokens if is_valid_token(form, pos)]
    
    if not valid_tokens:
        return {"error": "No valid tokens after filtering"}
    
    # [분석 방식 1] 논리 구조 모델 사용
    if use_logical_structure:
        # 주어-서술어 쌍 추출
        sp_pairs = extract_subject_predicate_pairs(valid_tokens)
        
        if not sp_pairs:
            return {"error": "No subject-predicate pairs found"}
        
        # 논리 구조 점수 계산
        logical_score = calculate_logical_structure_score(sp_pairs, PROGRESSIVE_MODEL, CONSERVATIVE_MODEL)
    
    # [분석 방식 2] Word2Vec 모델 사용 (fallback)
    else:
        # 진보/보수 개념 벡터 생성
        progressive_vectors = []
        for seed in PROGRESSIVE_SEEDS:
            vec = get_word_vector(seed, WORD2VEC_MODEL)
            if vec is not None:
                progressive_vectors.append(vec)
        
        conservative_vectors = []
        for seed in CONSERVATIVE_SEEDS:
            vec = get_word_vector(seed, WORD2VEC_MODEL)
            if vec is not None:
                conservative_vectors.append(vec)
        
        if not progressive_vectors or not conservative_vectors:
            return {"error": "Failed to create concept vectors from Word2Vec model"}
        
        progressive_vector = np.mean(progressive_vectors, axis=0)
        conservative_vector = np.mean(conservative_vectors, axis=0)
        
        # Word2Vec 의미론적 점수 계산
        left_score = calculate_semantic_score(valid_tokens, set(PROGRESSIVE_SEEDS), WORD2VEC_MODEL)
        right_score = calculate_semantic_score(valid_tokens, set(CONSERVATIVE_SEEDS), WORD2VEC_MODEL)
        
        # 유사 논리 구조 점수 형식으로 변환
        logical_score = {
            'progressive_score': left_score,
            'conservative_score': right_score,
            'type': 'progressive' if left_score > right_score else ('conservative' if right_score > left_score else 'factual')
        }
        
        # Word2Vec 방식에서는 주어-서술어 쌍을 명사 키워드로 대체
        sp_pairs = []
    
    # 키워드 분류
    progressive_sp = []
    conservative_sp = []
    factual_sp = []
    
    progressive_subjects = Counter()
    conservative_subjects = Counter()
    progressive_predicates = Counter()
    conservative_predicates = Counter()
    
    if use_logical_structure and sp_pairs:
        # 논리 구조 모델: 주어-서술어 쌍 분류
        for pair in sp_pairs:
            pair_score = calculate_logical_structure_score([pair], PROGRESSIVE_MODEL, CONSERVATIVE_MODEL)
            pair_type = pair_score['type']
            
            if pair_type == 'progressive':
                progressive_sp.append(pair)
                progressive_subjects[pair['subject']] += 1
                progressive_predicates[pair['predicate']] += 1
            elif pair_type == 'conservative':
                conservative_sp.append(pair)
                conservative_subjects[pair['subject']] += 1
                conservative_predicates[pair['predicate']] += 1
            else:
                factual_sp.append(pair)
    
    elif use_word2vec:
        # Word2Vec 모델: 명사 키워드 분류
        for form, pos in valid_tokens:
            if pos not in ['NNG', 'NNP', 'NNB']:  # 명사만
                continue
            
            token_vec = get_word_vector(form, WORD2VEC_MODEL)
            if token_vec is None:
                continue
            
            # 진보/보수 개념과의 유사도
            prog_sim = np.dot(token_vec, progressive_vector) / (
                np.linalg.norm(token_vec) * np.linalg.norm(progressive_vector) + 1e-10
            )
            cons_sim = np.dot(token_vec, conservative_vector) / (
                np.linalg.norm(token_vec) * np.linalg.norm(conservative_vector) + 1e-10
            )
            
            threshold = 0.3
            if prog_sim > threshold and prog_sim > cons_sim:
                progressive_subjects[form] += 1
            elif cons_sim > threshold and cons_sim > prog_sim:
                conservative_subjects[form] += 1
    
    # 전체 기사의 논리 구조 성향
    label = logical_score['type']
    if label == 'progressive':
        label = 'blue'
    elif label == 'conservative':
        label = 'red'
    else:
        label = 'factual'
    
    # 키워드 목록 생성 (주어 + 서술어)
    left_kw_list = []
    for word, count in progressive_subjects.most_common(10):
        left_kw_list.append({"word": word, "count": count, "score": round(count * 0.6, 2), "type": "subject"})
    for word, count in progressive_predicates.most_common(10):
        left_kw_list.append({"word": word, "count": count, "score": round(count * 0.4, 2), "type": "predicate"})
    
    right_kw_list = []
    for word, count in conservative_subjects.most_common(10):
        right_kw_list.append({"word": word, "count": count, "score": round(count * 0.6, 2), "type": "subject"})
    for word, count in conservative_predicates.most_common(10):
        right_kw_list.append({"word": word, "count": count, "score": round(count * 0.4, 2), "type": "predicate"})
    
    # 사실보도 키워드는 주어만 (동사는 표시 안 함)
    factual_subjects = Counter()
    for pair in factual_sp:
        factual_subjects[pair['subject']] += 1
    
    factual_kw_list = [
        {"word": w, "count": count, "score": 0, "type": "subject"}
        for w, count in factual_subjects.most_common(20)
    ]
    
    # 문장별 분석
    sentences = []
    sentence_parts = clean_text.split('.')
    for sent in sentence_parts[:50]:
        sent = sent.strip()
        if len(sent) < 10:
            continue
        
        try:
            result = k.tokenize(sent)
            sent_tokens = [(token.form, token.tag) for token in result]
            sent_valid_tokens = [(form, pos) for form, pos in sent_tokens if is_valid_token(form, pos)]
            
            if not sent_valid_tokens:
                continue
            
            if use_logical_structure:
                # 논리 구조 모델: 주어-서술어 분석
                sent_sp_pairs = extract_subject_predicate_pairs(sent_valid_tokens)
                
                if not sent_sp_pairs:
                    sentences.append({
                        "text": sent,
                        "type": "factual",
                        "progressive_score": 0.0,
                        "conservative_score": 0.0
                    })
                    continue
                
                sent_analysis = calculate_logical_structure_score(sent_sp_pairs, PROGRESSIVE_MODEL, CONSERVATIVE_MODEL)
                
                sentences.append({
                    "text": sent,
                    "type": sent_analysis['type'],
                    "progressive_score": float(round(sent_analysis['progressive_score'], 2)),
                    "conservative_score": float(round(sent_analysis['conservative_score'], 2))
                })
            
            elif use_word2vec:
                # Word2Vec 모델: 의미론적 분석
                sent_vectors = []
                for form, pos in sent_valid_tokens:
                    vec = get_word_vector(form, WORD2VEC_MODEL)
                    if vec is not None:
                        sent_vectors.append(vec)
                
                if not sent_vectors:
                    sentences.append({
                        "text": sent,
                        "type": "factual",
                        "progressive_score": 0.0,
                        "conservative_score": 0.0
                    })
                    continue
                
                sent_vector = np.mean(sent_vectors, axis=0)
                sent_analysis = calculate_ideological_score(sent_vector, progressive_vector, conservative_vector)
                
                sentences.append({
                    "text": sent,
                    "type": sent_analysis['type'],
                    "progressive_score": float(round(sent_analysis['progressive_score'], 2)),
                    "conservative_score": float(round(sent_analysis['conservative_score'], 2))
                })
        
        except Exception:
            continue
    
    # 주어-서술어 쌍을 타입 정보와 함께 반환
    sp_pairs_with_type = []
    for pair in progressive_sp[:20]:  # 상위 20개만
        sp_pairs_with_type.append({
            "subject": pair['subject'],
            "predicate": pair['predicate'],
            "type": "progressive"
        })
    for pair in conservative_sp[:20]:
        sp_pairs_with_type.append({
            "subject": pair['subject'],
            "predicate": pair['predicate'],
            "type": "conservative"
        })
    
    return {
        "total_left_score": float(round(logical_score['progressive_score'], 2)),
        "total_right_score": float(round(logical_score['conservative_score'], 2)),
        "bias_label": label,
        "progressive_keywords": left_kw_list[:20],
        "conservative_keywords": right_kw_list[:20],
        "factual_keywords": factual_kw_list[:20],
        "subject_predicate_pairs": sp_pairs_with_type,
        "sentences": sentences,
        "cleaned_text": clean_text[:1000],
        "cleaned_text_html": clean_text_html[:3000],
        "analysis_method": "subject_predicate_logical_structure" if use_logical_structure else "word2vec_semantic",
        "logical_structure_info": {
            "progressive_model_loaded": LOGICAL_STRUCTURE_INFO['progressive_loaded'],
            "conservative_model_loaded": LOGICAL_STRUCTURE_INFO['conservative_loaded'],
            "analysis_method": "logical_structure" if use_logical_structure else "word2vec_fallback",
            "progressive_score": float(round(logical_score['progressive_score'], 2)),
            "conservative_score": float(round(logical_score['conservative_score'], 2)),
            "classification": "3-way: progressive/conservative/factual",
            "progressive_pairs": len(progressive_sp),
            "conservative_pairs": len(conservative_sp),
            "factual_pairs": len(factual_sp)
        } if use_logical_structure else {
            "progressive_model_loaded": False,
            "conservative_model_loaded": False,
            "analysis_method": "word2vec_fallback",
            "progressive_score": float(round(logical_score['progressive_score'], 2)),
            "conservative_score": float(round(logical_score['conservative_score'], 2)),
            "classification": "3-way: progressive/conservative/factual (Word2Vec)",
            "model_type": WORD2VEC_INFO['type'],
            "semantic_threshold": WORD2VEC_INFO['threshold']
        }
    }


def main():
    # 커맨드 라인 인자 파서 생성
    parser = argparse.ArgumentParser(description="Classify news into blue/red using Kiwi and lexicon")
    # --mode 인자: 배치 분류 또는 단일 기사 분석
    parser.add_argument("--mode", choices=["batch", "single"], default="batch", help="Batch classification or single article analysis")
    # --text 인자: 단일 기사 분석 시 텍스트
    parser.add_argument("--text", help="Article text for single analysis mode")
    # --input 인자: 입력 기사 파일 경로 (기본값 설정)
    parser.add_argument("--input", default="news_500_정치.json", help="Input JSON file with articles")
    # --lexicon 인자: 정치 어휘 사전 파일 경로
    parser.add_argument("--lexicon", default="political_lexicon_expanded.json", help="Lexicon JSON path")
    # --blue-out 인자: 진보 기사 출력 파일명
    parser.add_argument("--blue-out", default="blue_news_set.json", help="Output file for blue articles")
    # --red-out 인자: 보수 기사 출력 파일명
    parser.add_argument("--red-out", default="red_news_set.json", help="Output file for red articles")
    # --verb-bonus 인자: 주변 동사 존재 시 추가 가중치
    parser.add_argument("--verb-bonus", type=float, default=0.8, help="Bonus added per nearby verb")
    # --window 인자: 동사를 탐색할 주변 단어 범위
    parser.add_argument("--window", type=int, default=3, help="Token window size to search for verbs near lexicon words")
    # --margin 인자: 진보/보수 판정을 위한 최소 점수 차이
    parser.add_argument("--margin", type=float, default=0.5, help="Minimum score margin to classify (avoid ties)")

    # 인자 파싱 실행
    args = parser.parse_args()

    if args.mode == "single":
        # 단일 기사 분석 모드
        if not args.text:
            print(json.dumps({"error": "Text is required for single analysis mode"}, ensure_ascii=False))
            sys.exit(1)
        
        result = analyze_single_article(args.text, args.lexicon, args.verb_bonus, args.window, args.margin)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        # 배치 분류 모드 (기존 로직)
        classify_articles(args.input, args.lexicon, args.blue_out, args.red_out, args.verb_bonus, args.window, args.margin)


# 스크립트가 직접 실행될 때만 main() 함수 실행 (import 시 실행 방지)
if __name__ == "__main__":
    main()