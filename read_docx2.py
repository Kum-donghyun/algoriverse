from docx import Document

doc = Document(r'C:\Users\smhrd\Desktop\back\01. 실시간 이슈 추적 및 요약 서비스.docx')

print("=== ALL TABLE CELLS (FULL TEXT) ===")
for i, table in enumerate(doc.tables):
    print(f"\n{'='*80}")
    print(f"TABLE {i}")
    print(f"{'='*80}")
    for j, row in enumerate(table.rows):
        for k, cell in enumerate(row.cells):
            text = cell.text.strip()
            if text and len(text) > 5:
                print(f"\n[Row {j}, Col {k}]")
                print(text)
