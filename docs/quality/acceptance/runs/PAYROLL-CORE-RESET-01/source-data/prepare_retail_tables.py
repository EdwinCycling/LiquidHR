from __future__ import annotations

import csv
import hashlib
import json
import re
from decimal import Decimal, ROUND_HALF_UP, getcontext
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent
PDF_PATH = ROOT / "cao-retail-non-food-2026-07.pdf"
SOURCE_URL = "https://www.inretail.nl/wp-content/uploads/2026/05/260527-Cao-Retail-Non-Food-juli-2026-def.pdf"
EXPECTED_PDF_SHA256 = "ec6fd7a8ee7c3b1f18f58ac6cc5081d6a72e053405480e346eb8a4c7d1e1d2cc"
EFFECTIVE_FROM = "2026-07-01"
EFFECTIVE_TO = "2026-12-31"
RULE_CODE = "RETAIL_NONFOOD_REVIEWED_STEP_2_PERCENT"
RULE_DESCRIPTION = "Beoordelingsafhankelijke tredeverhoging van 2%"
RULE_CONDITION = (
    "Zeer goed of uitmuntend functioneren: 1 of 2 treden van 2%; voldoende: geen tredeverhoging; "
    "matig of onvoldoende: geen cao- of tredeverhoging; medewerkers jonger dan 21 jaar ontvangen alleen leeftijdsverhogingen."
)
RULE_SOURCE = "Cao Retail Non-Food 2026-2027, Bijlage 1a, p. 29"
CENT = Decimal("0.01")
getcontext().prec = 40

TABLES = [
    (30, "MODE", "Mode, Juweliers, Parfumerieën, Verf en Woninginrichting, Tabaks- en Gemakswinkels", "cao-retail-mode-2026-07.csv"),
    (31, "SPORT_SCHOENEN", "Sport en Schoenen", "cao-retail-sport-en-schoenen-2026-07.csv"),
    (32, "TUINCENTRA", "Tuincentra", "cao-retail-tuincentra-2026-07.csv"),
    (33, "WONEN", "Wonen", "cao-retail-wonen-2026-07.csv"),
]
FIELDS = [
    "scale_code",
    "scale_name",
    "step_code",
    "step_name",
    "step_order",
    "amount",
    "scale_order",
    "progression_type",
    "step_kind",
    "source_rule_code",
    "source_rule_percent",
    "source_rule_description",
    "source_rule_condition",
    "source_rule_reference",
]


def group_columns(table: list[list[str | None]]) -> tuple[int, list[tuple[str, int]]]:
    for row in table[:5]:
        for index, cell in enumerate(row):
            normalized = (cell or "").strip().upper()
            if normalized in {"A", "A EN B"}:
                groups: list[tuple[str, int]] = []
                for column in range(index, len(row)):
                    label = (row[column] or "").strip().upper()
                    if label in {"A", "A EN B", "B", "C", "D", "E", "F", "G", "H", "I"}:
                        if label == "A EN B":
                            groups.extend([("A", column), ("B", column)])
                        else:
                            groups.append((label, column))
                if groups:
                    return index, groups
    raise ValueError("RETAIL_TABLE_FUNCTION_GROUPS_NOT_FOUND")


def step_identity(cells: list[str | None], value_start: int) -> tuple[int, str, str] | None:
    label_text = " ".join((cell or "").strip() for cell in cells[:value_start] if (cell or "").strip())
    age_zero = re.search(r"\b21\s+jaar\s*/\s*0\b", label_text, re.IGNORECASE)
    if age_zero:
        return (6, "EXP_00", "21 jaar / 0")
    age = re.search(r"\b(1[5-9]|20)\s+jaar\b", label_text, re.IGNORECASE)
    if age:
        years = int(age.group(1))
        return (years - 15, f"AGE_{years}", f"{years} jaar")
    for cell in cells[:value_start]:
        value = (cell or "").strip()
        if re.fullmatch(r"(?:[1-9]|1[0-5])", value):
            years = int(value)
            return (6 + years, f"EXP_{years:02d}", f"{years} ervaringsjaar" if years == 1 else f"{years} ervaringsjaren")
    return None


def amount_decimal(cell: str) -> Decimal:
    return Decimal(cell.strip().replace(".", "").replace(",", "."))


def prepare_table(page: pdfplumber.page.Page, branch_code: str, branch_name: str) -> tuple[list[dict[str, str]], dict[str, object]]:
    tables = page.extract_tables()
    if len(tables) != 1:
        raise ValueError(f"RETAIL_EXPECTED_ONE_TABLE_{branch_code}_{len(tables)}")
    table = tables[0]
    value_start, groups = group_columns(table)
    distinct_groups: dict[str, int] = {}
    for letter, column in groups:
        distinct_groups.setdefault(letter, column)

    steps: list[tuple[int, str, str, list[str | None]]] = []
    for row in table:
        identity = step_identity(row, value_start)
        if identity is None:
            continue
        sequence, step_code, step_name = identity
        source_cells = row[distinct_groups["A"] : distinct_groups["I"] + 1]
        if not any((cell or "").strip() for cell in source_cells):
            continue
        steps.append((sequence, step_code, step_name, row))
    steps.sort(key=lambda item: item[0])
    if len({item[0] for item in steps}) != len(steps):
        raise ValueError(f"RETAIL_DUPLICATE_STEP_SEQUENCE_{branch_code}")

    output: list[dict[str, str]] = []
    rule_rows: list[dict[str, str]] = []
    derived_rows: list[dict[str, str]] = []
    letters = list("ABCDEFGHI")
    for scale_order, letter in enumerate(letters):
        if letter not in distinct_groups:
            raise ValueError(f"RETAIL_FUNCTION_GROUP_MISSING_{branch_code}_{letter}")
        column = distinct_groups[letter]
        scale_code = f"{branch_code}_{letter}"
        scale_name = f"Functiegroep {letter}"
        previous_exact: Decimal | None = None
        previous_step_code: str | None = None
        scale_rows: list[dict[str, str]] = []
        for sequence, step_code, step_name, row in steps:
            raw = (row[column] or "").strip()
            if not raw:
                continue
            if raw.endswith("%"):
                percent = amount_decimal(raw[:-1])
                if percent != Decimal("2") or previous_exact is None or previous_step_code is None:
                    raise ValueError(f"RETAIL_PERCENT_RULE_INVALID_{branch_code}_{letter}_{step_code}")
                amount = (previous_exact * (Decimal(1) + percent / Decimal(100))).quantize(CENT, rounding=ROUND_HALF_UP)
                previous_exact *= Decimal(1) + percent / Decimal(100)
                row_data = {
                    "scale_code": scale_code,
                    "scale_name": scale_name,
                    "step_code": step_code,
                    "step_name": step_name,
                    "step_order": str(sequence),
                    "amount": raw,
                    "scale_order": str(scale_order),
                    "progression_type": "MANUAL",
                    "step_kind": "REGULAR",
                    "source_rule_code": RULE_CODE,
                    "source_rule_percent": "2.00",
                    "source_rule_description": RULE_DESCRIPTION,
                    "source_rule_condition": RULE_CONDITION,
                    "source_rule_reference": RULE_SOURCE,
                }
                rule_rows.append({
                    "scaleCode": scale_code,
                    "stepCode": step_code,
                    "basedOnStepCode": previous_step_code,
                    "sourceCell": raw,
                    "percentage": "2.00",
                    "calculatedAmount": f"{amount:.2f}",
                    "ruleCode": RULE_CODE,
                })
                derived_rows.append({"scaleCode": scale_code, "stepCode": step_code, "amount": f"{amount:.2f}"})
            else:
                amount = amount_decimal(raw)
                previous_exact = amount
                row_data = {
                    "scale_code": scale_code,
                    "scale_name": scale_name,
                    "step_code": step_code,
                    "step_name": step_name,
                    "step_order": str(sequence),
                    "amount": f"{amount:.2f}",
                    "scale_order": str(scale_order),
                    "progression_type": "MANUAL",
                    "step_kind": "START" if not scale_rows else "MAXIMUM" if sequence == steps[-1][0] else "REGULAR",
                    "source_rule_code": "",
                    "source_rule_percent": "",
                    "source_rule_description": "",
                    "source_rule_condition": "",
                    "source_rule_reference": "",
                }
            if raw.endswith("%"):
                # The percentage is kept in the input cell; the displayed rate is a preview-derived result.
                row_data["step_kind"] = "MAXIMUM" if sequence == steps[-1][0] else "REGULAR"
            scale_rows.append(row_data)
            previous_step_code = step_code
        if not scale_rows:
            raise ValueError(f"RETAIL_SCALE_EMPTY_{branch_code}_{letter}")
        scale_rows[-1]["step_kind"] = "MAXIMUM"
        output.extend(scale_rows)

    report: dict[str, object] = {
        "branchCode": branch_code,
        "branch": branch_name,
        "pdfPage": page.page_number,
        "scaleCount": len(letters),
        "salaryRows": len(output),
        "explicitEuroCells": len(output) - len(rule_rows),
        "percentageRuleCells": len(rule_rows),
        "stepAdjustments": rule_rows,
        "calculatedRuleAmounts": derived_rows,
        "scaleCodes": [f"{branch_code}_{letter}" for letter in letters],
    }
    return output, report


def main() -> None:
    source_bytes = PDF_PATH.read_bytes()
    digest = hashlib.sha256(source_bytes).hexdigest()
    if digest != EXPECTED_PDF_SHA256:
        raise SystemExit(f"RETAIL_SOURCE_HASH_MISMATCH:{digest}")

    outputs: list[dict[str, object]] = []
    with pdfplumber.open(PDF_PATH) as pdf:
        for page_number, branch_code, branch_name, file_name in TABLES:
            rows, report = prepare_table(pdf.pages[page_number], branch_code, branch_name)
            output_path = ROOT / file_name
            if output_path.exists():
                raise SystemExit(f"PRESERVING_EXISTING_SOURCE_FILE:{output_path.name}")
            with output_path.open("w", encoding="utf-8", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=FIELDS, lineterminator="\n")
                writer.writeheader()
                writer.writerows(rows)
            report["csvFileName"] = file_name
            report["csvSha256"] = hashlib.sha256(output_path.read_bytes()).hexdigest()
            outputs.append(report)

    verification = {
        "title": "CAO Retail Non-Food 2026-2027, bijlage 1b - loonregels per branche",
        "officialSourceUrl": SOURCE_URL,
        "sourceFileName": PDF_PATH.name,
        "sourceSha256": digest,
        "sourceBytes": len(source_bytes),
        "sourceVersion": "2026-07",
        "effectiveFrom": EFFECTIVE_FROM,
        "effectiveTo": EFFECTIVE_TO,
        "salaryBasis": "HOURLY",
        "currencyCode": "EUR",
        "fulltimeHoursPerWeek": {"default": 38, "wonen": 37},
        "progressionRule": {
            "code": RULE_CODE,
            "sourceCellIsRule": True,
            "percentage": "2.00",
            "description": RULE_DESCRIPTION,
            "condition": RULE_CONDITION,
            "sourceReference": RULE_SOURCE,
            "derivedStepDisplay": "Previous exact hourly rate multiplied by 1.02, then rounded half-up to cents for the displayed table rate.",
            "progressionType": "MANUAL",
            "employerSelectionRequired": "Choose the applicable progression approach: performance-dependent or non-performance-dependent, per Appendix 1a.",
            "payrollApplication": "Do not advance a person to a percentage-derived step without a verified, approved evaluation result. Under-21 employees use only the age scale.",
        },
        "branches": outputs,
        "checks": {
            "branchTables": len(outputs),
            "totalScales": sum(int(item["scaleCount"]) for item in outputs),
            "totalSalaryRowsIncludingRules": sum(int(item["salaryRows"]) for item in outputs),
            "totalExplicitEuroCells": sum(int(item["explicitEuroCells"]) for item in outputs),
            "totalPercentageRuleCells": sum(int(item["percentageRuleCells"]) for item in outputs),
            "retailModeGroupIExperience15": next(
                item["amount"] for item in csv.DictReader((ROOT / "cao-retail-mode-2026-07.csv").open(encoding="utf-8"))
                if item["scale_code"] == "MODE_I" and item["step_code"] == "EXP_15"
            ),
            "retailModeGroupCExperience1": next(
                item["amount"] for item in csv.DictReader((ROOT / "cao-retail-mode-2026-07.csv").open(encoding="utf-8"))
                if item["scale_code"] == "MODE_C" and item["step_code"] == "EXP_01"
            ),
            "retailTuincentraGroupIExperience15": next(
                item["amount"] for item in csv.DictReader((ROOT / "cao-retail-tuincentra-2026-07.csv").open(encoding="utf-8"))
                if item["scale_code"] == "TUINCENTRA_I" and item["step_code"] == "EXP_15"
            ),
        },
    }
    (ROOT / "retail-non-food-2026-07-verification.json").write_text(
        json.dumps(verification, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(verification["checks"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
