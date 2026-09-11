import csv
import re
import sys
from pathlib import Path

from zhconv import convert

TAIWAN_TERMS = {
    "軟件": "軟體", "硬件": "硬體", "視頻": "影片", "信息": "資訊",
    "網絡": "網路", "程序": "程式", "數據": "資料", "打印": "列印", "鼠標": "滑鼠",
}


def to_taiwan(text: str) -> str:
    result = convert(text, "zh-tw")
    for source, target in TAIWAN_TERMS.items():
        result = result.replace(source, target)
    return result


def load_ceec_rows(export_path: Path) -> tuple[list[dict[str, str]], int]:
    value_pattern = re.compile(
        r'^INSERT INTO "words" .* VALUES\(\d+,\'((?:\'\'|[^\'])*)\','
        r'\'((?:\'\'|[^\'])*)\',\'((?:\'\'|[^\'])*)\',(\d+),\'CEEC-108\'\);$'
    )
    rows = []
    changed = 0
    for line in export_path.read_text(encoding="utf-8").splitlines():
        match = value_pattern.match(line)
        if not match:
            continue
        word, pos, meaning, level = (value.replace("''", "'") for value in match.groups())
        converted = to_taiwan(meaning)
        changed += converted != meaning
        rows.append({"word": word, "pos": pos, "meaning": converted, "level": level, "source": "CEEC-108"})
    return rows, changed


def write_csv(csv_path: Path, rows: list[dict[str, str]]) -> None:
    with csv_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=["word", "pos", "meaning", "level", "source"])
        writer.writeheader()
        writer.writerows(rows)


def write_seed(seed_path: Path, rows: list[dict[str, str]]) -> None:
    def sql(value: str) -> str:
        return value.replace("'", "''")

    lines = [
        "-- Generated from the CEEC senior-high reference vocabulary list (108 curriculum).",
        "-- Non-commercial academic use; source: https://www.ceec.edu.tw/xmdoc?xsmsid=0K213553204833715309",
        "",
    ]
    for offset in range(0, len(rows), 200):
        lines.append("INSERT INTO words (word, pos, meaning, level, source) VALUES")
        chunk = rows[offset:offset + 200]
        for index, row in enumerate(chunk):
            suffix = "," if index < len(chunk) - 1 else ";"
            lines.append(
                f"  ('{sql(row['word'])}', '{sql(row['pos'])}', '{sql(row['meaning'])}', "
                f"{row['level']}, 'CEEC-108'){suffix}"
            )
        lines.append("")
    seed_path.write_text("\n".join(lines), encoding="utf-8")


def build_remote_updates(export_path: Path, output_path: Path, repaired: dict[str, str]) -> int:
    pattern = re.compile(r'^INSERT INTO "words" .* VALUES\((\d+),\'((?:\'\'|[^\'])*)\',\'(?:\'\'|[^\'])*\',\'((?:\'\'|[^\'])*)\',')
    updates = ["-- Convert existing meanings to Traditional Chinese (Taiwan)"]
    changed = 0
    for line in export_path.read_text(encoding="utf-8").splitlines():
        match = pattern.match(line)
        if not match:
            continue
        word_id = int(match.group(1))
        word = match.group(2).replace("''", "'").lower()
        meaning = match.group(3).replace("''", "'")
        converted = repaired.get(word, to_taiwan(meaning)) if "�" in meaning else to_taiwan(meaning)
        if converted == meaning:
            continue
        escaped = converted.replace("'", "''")
        updates.append(f"UPDATE words SET meaning='{escaped}' WHERE id={word_id};")
        changed += 1
    output_path.write_text("\n".join(updates) + "\n", encoding="utf-8")
    return changed


if __name__ == "__main__":
    project_root = Path(__file__).resolve().parent.parent
    export_file = Path(sys.argv[1])
    output_file = Path(sys.argv[2])
    csv_path = project_root / "data" / "words.utf8.csv"
    with csv_path.open("r", encoding="utf-8", newline="") as file:
        rows = list(csv.DictReader(file))
    local_changes = 0
    for row in rows:
        converted = to_taiwan(row["meaning"])
        local_changes += converted != row["meaning"]
        row["meaning"] = converted
    write_csv(project_root / "data" / "words.utf8.csv", rows)
    write_seed(project_root / "data" / "seed-words.sql", rows)
    repaired = {row["word"].lower(): row["meaning"] for row in rows}
    remote_changes = build_remote_updates(export_file, output_file, repaired)
    print(f"Local CSV changes: {local_changes}; remote updates: {remote_changes}")
