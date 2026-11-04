from pathlib import Path
import re
from pypdf import PdfReader

root = Path(__file__).parent
for name in ["kinderopvang-salarisschalen.pdf", "retail-non-food-2026-2027.pdf"]:
    reader = PdfReader(root / name)
    print(f"=== {name}: {len(reader.pages)} pages ===")
    for number, page in enumerate(reader.pages, 1):
        text = page.extract_text() or ""
        folded = text.casefold()
        if name.startswith("kinder"):
            relevant = number <= 2 or number >= 5
        else:
            relevant = any(term in folded for term in ["loontabel", "functiegroep", "salaristabel", "uurloon", "trede"])
        if relevant:
            condensed = re.sub(r"\s+", " ", text).strip()
            if name.startswith("retail") and 31 <= number <= 34:
                print(f"PAGE {number}: {text.encode('ascii', 'replace').decode()}")
            else:
                print(f"PAGE {number} len={len(text)}: {condensed[:350].encode('ascii', 'replace').decode()}")
