import sys
import json
import torch
import torch.nn.functional as F
import os
import io
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# [핵심] 표준 입출력을 UTF-8로 강제 설정하여 Node.js와의 한글 통신 깨짐 방지
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "my_bias_model")

tokenizer = None
model = None
try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
    model.eval()
except Exception as e:
    # 에러 발생 시에도 JSON 형태로 안전하게 출력
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)

def get_bias(title, content):
    # 특수 문자 및 깨진 유니코드 제거
    t = str(title).encode('utf-8', 'ignore').decode('utf-8') if title else ""
    c = str(content).encode('utf-8', 'ignore').decode('utf-8') if content else ""
    
    processed_content = f"{t} {c}".strip()
    if len(processed_content) < 2: return "중립", 50.0

    try:
        inputs = tokenizer(processed_content, return_tensors="pt", truncation=True, padding=True, max_length=512)
        with torch.no_grad():
            outputs = model(**inputs)
            probs = F.softmax(outputs.logits, dim=-1)

        p_lib = probs[0][0].item()
        p_con = probs[0][1].item()
        
        # 정확한 한글 레이블 반환
        return ("보수", round(p_con * 100, 2)) if p_con > p_lib else ("진보", round(p_lib * 100, 2))
    except Exception:
        return "중립", 50.0

def main():
    try:
        input_data = sys.stdin.read()
        if not input_data.strip(): return

        articles = json.loads(input_data)
        results = []

        for article in articles:
            # 기존 article 정보(이미지 포함)를 유지하며 분석 결과 추가
            bias, score = get_bias(article.get('title'), article.get('content'))
            article['bias'] = bias
            article['bias_score'] = score
            results.append(article)
            
        # [핵심] ensure_ascii=False 설정으로 \uXXXX가 아닌 한글 그대로 출력
        print(json.dumps(results, ensure_ascii=False))
        sys.stdout.flush()
    except Exception as e:
        err_msg = str(e).encode('utf-8', 'ignore').decode('utf-8')
        print(json.dumps({"error": err_msg}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()