"""알고리슈 클러스터링 테스트"""
import requests
import json

articles = [
    {"title": "미국 이란 전쟁 위기 고조", "description": "미국과 이란 간 군사 긴장이 고조되고 있다"},
    {"title": "미국 이란에 대해 추가 제재 발표", "description": "미국 정부가 이란에 새로운 경제 제재를 가했다"},
    {"title": "이란 미국에 보복 경고 성명", "description": "이란이 미국의 제재에 강력히 반발하고 보복을 경고했다"},
    {"title": "미국 관세 정책 변화에 한국 수출 영향", "description": "트럼프 정부의 관세 정책이 한국 경제에 미치는 영향"},
    {"title": "트럼프 관세 인상 발표 주가 하락", "description": "관세 인상 발표 후 한국 증시가 급락했다"},
    {"title": "한국 수출기업 관세 충격 대비", "description": "관세 인상에 따른 수출기업 대응 방안이 논의되고 있다"},
    {"title": "국회 탄핵 소추안 표결 예정", "description": "야당이 대통령 탄핵 소추안을 발의했다"},
    {"title": "대통령 탄핵 찬반 여론조사 결과", "description": "탄핵에 대한 국민 여론이 갈리고 있다"},
    {"title": "탄핵 심판 결과 발표 예정일 공개", "description": "헌법재판소가 탄핵 심판 결과 발표 일정을 공개했다"},
]

r = requests.post("http://localhost:8100/cluster", json={"articles": articles}, timeout=60)
data = r.json()

print(f"클러스터 수: {len(data['clusters'])}")
print(f"노이즈: {data['noise_articles']}건")
for c in data["clusters"]:
    titles = [a["title"] for a in c["articles"]]
    print(f"  [{c['keyword']}] ({c['size']}건): {titles}")
