from pathlib import Path
from openpyxl import load_workbook

for path in sorted(Path(__file__).parent.glob("retail-jan-*.xlsx")):
    workbook = load_workbook(path, data_only=True, read_only=True)
    print(f"=== {path.name} ===")
    for sheet in workbook.worksheets:
        print(f"-- {sheet.title} ({sheet.max_row}x{sheet.max_column})")
        for row in sheet.iter_rows(values_only=True):
            values = [value for value in row]
            if any(value is not None for value in values):
                print(" | ".join("" if value is None else str(value) for value in values).rstrip())
