"""
알고리슈 클러스터링 (Algorissue Clustering)
─────────────────────────────────────────────
한국어 문장 임베딩 기반 뉴스 이슈 클러스터링 엔진

- 한국어 사전학습 Sentence-BERT 모델 (ko-sroberta-multitask)
- HDBSCAN 밀도 기반 클러스터링
- 점진적 학습: 수집된 뉴스로 모델을 지속적으로 파인튜닝
"""

import os
import json
import time
import logging
import threading
from datetime import datetime
from pathlib import Path

import numpy as np
import torch
from sentence_transformers import SentenceTransformer, InputExample, losses
from torch.utils.data import DataLoader
from sklearn.metrics.pairwise import cosine_similarity
import hdbscan

logging.basicConfig(level=logging.INFO, format="%(asctime)s [알고리슈] %(message)s")
logger = logging.getLogger("algorissue")

# ─── 경로 설정 ───
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model_store"
TRAINING_BUFFER_FILE = BASE_DIR / "training_buffer.json"
MODEL_DIR.mkdir(exist_ok=True)

# ─── 설정 ───
BASE_MODEL_NAME = "jhgan/ko-sroberta-multitask"  # 한국어 Sentence-BERT
MIN_CLUSTER_SIZE = 3          # HDBSCAN 최소 클러스터 크기
MIN_SAMPLES = 1               # HDBSCAN 최소 샘플 수
CLUSTER_EPSILON = 0.3         # HDBSCAN epsilon (0에 가까울수록 엄격)
INCREMENTAL_BATCH_SIZE = 32   # 점진적 학습 배치 크기
INCREMENTAL_EPOCHS = 1        # 점진적 학습 에폭 수
TRAINING_BUFFER_LIMIT = 200   # 학습 버퍼 최대 크기 (이 이상이면 학습 트리거)


class AlgorissueEngine:
    """알고리슈 클러스터링 엔진 — 문장 임베딩 + HDBSCAN 기반"""

    def __init__(self):
        self.model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.training_buffer = []  # 점진적 학습용 데이터 버퍼
        self._lock = threading.Lock()
        self._load_model()
        self._load_training_buffer()

    # ═══════════════════════════════════════════
    #  모델 로드 / 저장
    # ═══════════════════════════════════════════
    def _load_model(self):
        """파인튜닝된 모델이 있으면 최신 모델을 로드, 없으면 기본 모델 다운로드"""
        import os
        active_pointer = MODEL_DIR / "active_model.txt"
        
        # 최신 모델 추적 포인터가 있으면 그 경로를 사용
        if active_pointer.exists():
            active_model_name = active_pointer.read_text(encoding="utf-8").strip()
            local_model_path = MODEL_DIR / active_model_name
        else:
            local_model_path = MODEL_DIR / "algorissue_model"

        if local_model_path.exists():
            logger.info("📦 파인튜닝된 알고리슈 모델 로드: %s", local_model_path)
            self.model = SentenceTransformer(str(local_model_path), device=self.device)
        else:
            logger.info("🌐 기본 한국어 SBERT 모델 다운로드: %s", BASE_MODEL_NAME)
            self.model = SentenceTransformer(BASE_MODEL_NAME, device=self.device)
            # 기본 역시 임시 타임스탬프로 저장하지 않고 기본 이름으로 저장
            self.model.save(str(local_model_path), safe_serialization=False)
            logger.info("💾 기본 모델 로컬 저장 완료")
            active_pointer.write_text("algorissue_model", encoding="utf-8")

    def _save_model(self):
        """현재 모델 저장: Windows OS Error(파일 매핑 락) 방지를 위해 매번 새 버전에 저장 후, 이전 버전 삭제 시도"""
        import os
        import shutil
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        new_model_name = f"algorissue_model_{timestamp}"
        target_dir = MODEL_DIR / new_model_name
        
        # 모델 저장 (safe_serialization=False 시 mmap 문제 일부 회피 가능, 타임스탬프 방식 병행으로 완벽 차단)
        self.model.save(str(target_dir), safe_serialization=False)
        logger.info("💾 파인튜닝 모델 새 버전 저장 완료: %s", target_dir)
        
        active_pointer = MODEL_DIR / "active_model.txt"
        active_pointer.write_text(new_model_name, encoding="utf-8")
        
        # 이전 모델들 정리 (최신 1개 제외 나머지 삭제 시도)
        try:
            for item in MODEL_DIR.iterdir():
                if item.is_dir() and item.name.startswith("algorissue_model") and item.name != new_model_name:
                    try:
                        shutil.rmtree(item)
                        logger.info("🗑️ 이전 버전 모델 디렉토리 삭제: %s", item.name)
                    except Exception as e:
                        # Windows 락이 잡혀있을 수 있으므로 무시
                        pass
        except Exception:
            pass

    # ═══════════════════════════════════════════
    #  학습 버퍼 관리
    # ═══════════════════════════════════════════
    def _load_training_buffer(self):
        """디스크에 저장된 학습 버퍼 복원"""
        if TRAINING_BUFFER_FILE.exists():
            try:
                with open(TRAINING_BUFFER_FILE, "r", encoding="utf-8") as f:
                    self.training_buffer = json.load(f)
                logger.info("📂 학습 버퍼 복원: %d건", len(self.training_buffer))
            except Exception:
                self.training_buffer = []

    def _save_training_buffer(self):
        """학습 버퍼를 디스크에 저장"""
        with open(TRAINING_BUFFER_FILE, "w", encoding="utf-8") as f:
            json.dump(self.training_buffer[-TRAINING_BUFFER_LIMIT * 2:], f, ensure_ascii=False)

    # ═══════════════════════════════════════════
    #  점진적 학습 (Incremental Learning)
    # ═══════════════════════════════════════════
    def add_training_data(self, articles):
        """
        수집된 뉴스 기사들을 학습 버퍼에 추가.
        같은 클러스터 내 기사 쌍 → 유사도 높음(1.0)
        다른 클러스터 기사 쌍 → 유사도 낮음(0.0)
        버퍼가 충분히 쌓이면 자동으로 학습 트리거.
        """
        texts = []
        for art in articles:
            title = art.get("title", "")
            desc = art.get("description", "") or art.get("full_text", "")
            combined = f"{title} {desc}".strip()
            if len(combined) > 10:
                texts.append(combined)

        with self._lock:
            self.training_buffer.extend(texts)
            self._save_training_buffer()
            buffer_size = len(self.training_buffer)

        logger.info("📝 학습 버퍼에 %d건 추가 (총 %d건)", len(texts), buffer_size)

        if buffer_size >= TRAINING_BUFFER_LIMIT:
            threading.Thread(target=self._run_incremental_training, daemon=True).start()

    def _run_incremental_training(self):
        """
        점진적 학습 실행 — 버퍼 내 텍스트들로 대조 학습(Contrastive Learning).
        같은 뉴스 기사의 제목/본문 앞부분과 뒷부분을 양성 쌍으로 구성.
        """
        with self._lock:
            if len(self.training_buffer) < INCREMENTAL_BATCH_SIZE:
                return
            batch_texts = self.training_buffer[:TRAINING_BUFFER_LIMIT]
            self.training_buffer = self.training_buffer[TRAINING_BUFFER_LIMIT:]
            self._save_training_buffer()

        logger.info("🧠 점진적 학습 시작 (%d건)", len(batch_texts))
        start_time = time.time()

        try:
            # 자기 지도 학습: 문장을 반으로 나누어 양성 쌍 생성
            train_examples = []
            for text in batch_texts:
                if len(text) < 20:
                    continue
                mid = len(text) // 2
                part_a = text[:mid].strip()
                part_b = text[mid:].strip()
                if part_a and part_b:
                    train_examples.append(InputExample(texts=[part_a, part_b], label=1.0))

            if len(train_examples) < 4:
                logger.warning("⚠️ 학습 예제 부족, 건너뜀")
                return

            loader = DataLoader(train_examples, shuffle=True, batch_size=INCREMENTAL_BATCH_SIZE)
            loss_fn = losses.CosineSimilarityLoss(self.model)

            # Windows OS Error 1224 방지:
            # model.fit() 내부 Trainer가 원래 모델 경로에 저장 시도 → 메모리 매핑 충돌
            # → 새 타임스탬프 디렉토리를 output_path로 직접 지정하여 우회
            import shutil
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            new_model_name = f"algorissue_model_{timestamp}"
            output_dir = str(MODEL_DIR / new_model_name)

            self.model.fit(
                train_objectives=[(loader, loss_fn)],
                epochs=INCREMENTAL_EPOCHS,
                warmup_steps=0,
                show_progress_bar=False,
                output_path=output_dir,
            )

            # 포인터 업데이트 및 이전 모델 정리
            active_pointer = MODEL_DIR / "active_model.txt"
            active_pointer.write_text(new_model_name, encoding="utf-8")
            logger.info("💾 파인튜닝 모델 새 버전 저장 완료: %s", new_model_name)

            try:
                for item in MODEL_DIR.iterdir():
                    if item.is_dir() and item.name.startswith("algorissue_model") and item.name != new_model_name:
                        try:
                            shutil.rmtree(item)
                        except Exception:
                            pass
            except Exception:
                pass

            elapsed = time.time() - start_time
            logger.info("✅ 점진적 학습 완료 (%.1f초, %d 예제)", elapsed, len(train_examples))

        except Exception as e:
            logger.error("❌ 점진적 학습 실패: %s", e)

    # ═══════════════════════════════════════════
    #  뉴스 임베딩
    # ═══════════════════════════════════════════
    def encode_articles(self, articles):
        """기사 리스트 → 문장 임베딩 벡터 배열"""
        texts = []
        for art in articles:
            title = art.get("title", "")
            desc = art.get("description", "") or art.get("full_text", "")
            combined = f"{title} {desc}".strip()
            texts.append(combined if combined else "빈 기사")

        embeddings = self.model.encode(
            texts,
            batch_size=64,
            show_progress_bar=False,
            normalize_embeddings=True,
        )
        return np.array(embeddings)

    # ═══════════════════════════════════════════
    #  이슈 클러스터링 (HDBSCAN)
    # ═══════════════════════════════════════════
    def cluster_articles(self, articles):
        """
        기사 리스트를 의미 기반으로 클러스터링.
        
        반환 형식:
        [
            {
                "keyword": "대표 키워드",
                "articles": [...],           # 원본 기사 목록
                "relatedKeywords": [...],    # 관련 키워드
                "size": N
            },
            ...
        ]
        """
        if not articles or len(articles) < 2:
            return []

        logger.info("🔍 %d개 기사 임베딩 생성 중...", len(articles))
        embeddings = self.encode_articles(articles)
        logger.info("✅ 임베딩 완료 (shape: %s)", embeddings.shape)

        # HDBSCAN 클러스터링 (코사인 거리 기반)
        # 임베딩이 이미 정규화되어 있으므로 유클리디안 거리 ≈ 코사인 거리
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=MIN_CLUSTER_SIZE,
            min_samples=MIN_SAMPLES,
            cluster_selection_epsilon=CLUSTER_EPSILON,
            metric="euclidean",
            cluster_selection_method="eom",
        )
        labels = clusterer.fit_predict(embeddings)

        num_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        noise_count = (labels == -1).sum()
        logger.info("🏷️ 클러스터 %d개 발견 (노이즈: %d건)", num_clusters, noise_count)

        # 클러스터별 기사 그룹화
        cluster_map = {}
        for idx, label in enumerate(labels):
            if label == -1:
                continue  # 노이즈(어디에도 속하지 않는 기사) 제외
            if label not in cluster_map:
                cluster_map[label] = []
            cluster_map[label].append(idx)

        # 클러스터별 대표 키워드 추출 및 구조화
        clusters = []
        for label, indices in cluster_map.items():
            cluster_articles = [articles[i] for i in indices]
            cluster_embeddings = embeddings[indices]

            # 대표 키워드: 클러스터 중심에 가장 가까운 기사의 핵심 명사
            keyword = self._extract_cluster_keyword(cluster_articles, cluster_embeddings)
            related = self._extract_related_keywords(cluster_articles, keyword)

            clusters.append({
                "keyword": keyword,
                "articles": cluster_articles,
                "relatedKeywords": related,
                "size": len(cluster_articles),
            })

        # 기사 수 기준 내림차순 정렬
        clusters.sort(key=lambda c: c["size"], reverse=True)

        # 상위 15개만 반환
        return clusters[:15]

    # ═══════════════════════════════════════════
    #  대표 키워드 추출
    # ═══════════════════════════════════════════
    def _extract_cluster_keyword(self, articles, embeddings):
        """
        클러스터의 대표 키워드를 추출.
        1) 클러스터 중심(centroid) 계산
        2) 중심에 가장 가까운 기사(medoid) 선택
        3) 해당 기사 제목에서 가장 빈번한 2~5글자 한국어 명사 추출
        """
        import re

        STOP_WORDS = {
            '것', '등', '및', '또', '더', '수', '때', '곳', '중', '등이',
            '이', '그', '저', '것이', '수가', '일', '년', '월', '일이',
            '위해', '대한', '통해', '대해', '관련', '이후', '이번', '지난',
            '올해', '내년', '최근', '현재', '앞서', '이날', '오늘', '내일',
            '한편', '또한', '하지만', '그러나', '따라서', '한다', '됐다',
            '했다', '있다', '없다', '말했다', '밝혔다', '전했다',
            '보도', '기자', '뉴스', '속보', '특종', '단독', '종합',
            '대해서', '에서는', '라며', '라고', '했습니다', '입니다',
            '것으로', '것이다', '위한', '때문', '가운데', '하고',
            '오전', '오후', '전국', '우리',
        }

        # 클러스터 중심 계산
        centroid = np.mean(embeddings, axis=0, keepdims=True)
        sims = cosine_similarity(centroid, embeddings)[0]
        medoid_idx = int(np.argmax(sims))

        # 전체 기사 제목에서 명사 빈도 집계
        all_titles = " ".join(a.get("title", "") for a in articles)
        nouns = re.findall(r"[가-힣]{2,5}", all_titles)
        freq = {}
        for n in nouns:
            if n not in STOP_WORDS:
                freq[n] = freq.get(n, 0) + 1

        if freq:
            # 가장 빈번한 명사를 대표 키워드로
            keyword = max(freq, key=freq.get)
            return keyword

        # 빈도 분석 실패 시 medoid 기사 제목의 첫 명사
        medoid_title = articles[medoid_idx].get("title", "이슈")
        nouns = re.findall(r"[가-힣]{2,5}", medoid_title)
        return nouns[0] if nouns else "이슈"

    def _extract_related_keywords(self, articles, main_keyword):
        """클러스터 내 기사들에서 관련 키워드 상위 8개 추출"""
        import re

        STOP_WORDS = {
            '것', '등', '및', '또', '더', '수', '때', '곳', '중', '등이',
            '이', '그', '저', '것이', '수가', '일', '년', '월', '일이',
            '위해', '대한', '통해', '대해', '관련', '이후', '이번', '지난',
            '올해', '내년', '최근', '현재', '앞서', '이날', '오늘', '내일',
            '한편', '또한', '하지만', '그러나', '따라서', '한다', '됐다',
            '했다', '있다', '없다', '말했다', '밝혔다', '전했다',
            '보도', '기자', '뉴스', '속보', '특종', '단독', '종합',
        }

        freq = {}
        for a in articles:
            text = f"{a.get('title', '')} {a.get('description', '')}"
            nouns = re.findall(r"[가-힣]{2,5}", text)
            for n in nouns:
                if n != main_keyword and n not in STOP_WORDS:
                    freq[n] = freq.get(n, 0) + 1

        sorted_kw = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:8]
        return [{"word": w, "count": c} for w, c in sorted_kw]

    # ═══════════════════════════════════════════
    #  상태 조회
    # ═══════════════════════════════════════════
    def get_status(self):
        """엔진 상태 반환"""
        return {
            "model_loaded": self.model is not None,
            "device": self.device,
            "training_buffer_size": len(self.training_buffer),
            "model_path": str(MODEL_DIR / "algorissue_model"),
            "model_exists": (MODEL_DIR / "algorissue_model").exists(),
        }
