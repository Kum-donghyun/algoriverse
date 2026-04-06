import json

with open("backend/data/realtime_issues_cache.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for issue in data["issues"]:
    print(f'  #{issue["rank"]:2d}  {issue["articleCount"]:4d}건  [{issue["keyword"]}] {issue["title"][:60]}')

total_in = sum(i["articleCount"] for i in data["issues"])
print(f'\n총 이슈: {len(data["issues"])}개')
print(f'총 수집 기사: {data["totalArticles"]}건')
print(f'클러스터 포함: {total_in}건')
print(f'노이즈 추정: {data["totalArticles"] - total_in}건')