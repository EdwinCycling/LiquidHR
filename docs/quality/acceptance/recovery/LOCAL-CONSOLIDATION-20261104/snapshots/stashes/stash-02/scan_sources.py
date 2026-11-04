from pathlib import Path
from pypdf import PdfReader
root = Path('tmp/pdfs')
for name in ['kinderopvang-salarisschalen.pdf','retail-non-food-2026-2027.pdf','bpf-detailhandel-premieoverzicht-2026.pdf']:
    path = root / name
    reader = PdfReader(str(path))
    print(f'FILE {name} pages={len(reader.pages)} bytes={path.stat().st_size}')
    if name.startswith('kinderopvang'):
        selected = {1,4,5,6,7,8,9}
        for index in sorted(selected):
            text = reader.pages[index].extract_text() or ''
            clean = ' '.join(text.split()).encode('ascii','replace').decode('ascii')
            print(f'PAGE {index+1}: {clean[:1500]}')
    elif name.startswith('retail'):
        for index,page in enumerate(reader.pages):
            text = page.extract_text() or ''
            low = text.lower()
            if any(term in low for term in ['functiegroep','loontabel','uurloon','per 1 juli 2026']):
                clean = ' '.join(text.split()).encode('ascii','replace').decode('ascii')
                print(f'PAGE {index+1}: {clean[:1000]}')
    else:
        text = reader.pages[0].extract_text() or ''
        print('PAGE 1:', ' '.join(text.split()).encode('ascii','replace').decode('ascii'))
