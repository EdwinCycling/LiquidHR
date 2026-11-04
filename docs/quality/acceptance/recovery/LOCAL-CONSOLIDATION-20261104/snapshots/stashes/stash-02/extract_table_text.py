import sys
from pathlib import Path
from pypdf import PdfReader

name = sys.argv[1]
pages = [int(value) for value in sys.argv[2:]]
reader = PdfReader(Path(__file__).parent / name)
for number in pages:
    text = reader.pages[number - 1].extract_text() or ""
    print(f"--- PAGE {number} ---")
    print(text.encode("ascii", "replace").decode())
