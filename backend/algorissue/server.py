"""
알고리슈 클러스터링 — FastAPI 서버
──────────────────────────────────
Node.js 백엔드에서 HTTP로 호출하여 뉴스 클러스터링 수행.

엔드포인트:
  POST /cluster    — 기사 목록 → 이슈 클러스터 반환 + 점진적 학습 데이터 추가
  GET  /status     — 엔진 상태 조회
  POST /train-now  — 즉시 점진적 학습 트리거
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from engine import AlgorissueEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [알고리슈API] %(message)s")
logger = logging.getLogger("algorissue_api")

# ─── 엔진 인스턴스 (서버 수명주기와 동일) ───
engine: AlgorissueEngine = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    logger.info("🚀 알고리슈 엔진 초기화 중...")
    engine = AlgorissueEngine()
    logger.info("✅ 알고리슈 엔진 준비 완료 (%s)", engine.device)
    yield
    logger.info("🛑 알고리슈 엔진 종료")


app = FastAPI(title="알고리슈 클러스터링 API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── 요청/응답 스키마 ───
class Article(BaseModel):
    title: str = ""
    description: str = ""
    full_text: str = ""
    link: str = ""
    originallink: str = ""
    pubDate: str = ""
    category: str = ""
    imageUrl: str = ""
    image_url: str = ""
    _source: str = ""


class ClusterRequest(BaseModel):
    articles: list[Article]


class RelatedKeyword(BaseModel):
    word: str
    count: int


class ClusterItem(BaseModel):
    keyword: str
    articles: list[dict]
    relatedKeywords: list[RelatedKeyword]
    size: int


class ClusterResponse(BaseModel):
    clusters: list[ClusterItem]
    total_articles: int
    noise_articles: int


# ─── API 엔드포인트 ───

@app.post("/cluster", response_model=ClusterResponse)
async def cluster_articles(req: ClusterRequest):
    """
    기사 목록을 받아 의미 기반 이슈 클러스터를 반환.
    동시에 학습 버퍼에 기사 데이터를 추가하여 점진적 학습을 준비.
    """
    articles_raw = [art.model_dump() for art in req.articles]

    # 점진적 학습 비활성화 — 자기지도 학습이 임베딩 공간을 붕괴시키는 문제 확인됨
    # engine.add_training_data(articles_raw)

    # 2) 클러스터링 수행
    clusters = engine.cluster_articles(articles_raw)

    # 노이즈 기사 수 계산
    clustered_count = sum(c["size"] for c in clusters)
    noise_count = len(articles_raw) - clustered_count

    return ClusterResponse(
        clusters=[
            ClusterItem(
                keyword=c["keyword"],
                articles=c["articles"],
                relatedKeywords=[RelatedKeyword(**rk) for rk in c["relatedKeywords"]],
                size=c["size"],
            )
            for c in clusters
        ],
        total_articles=len(articles_raw),
        noise_articles=noise_count,
    )


@app.get("/status")
async def get_status():
    """엔진 상태 조회"""
    return engine.get_status()


@app.post("/train-now")
async def train_now():
    """즉시 점진적 학습 트리거 (학습 버퍼가 비어있으면 건너뜀)"""
    engine._run_incremental_training()
    return {"message": "학습 완료 또는 버퍼 부족으로 건너뜀"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8100, reload=False)
