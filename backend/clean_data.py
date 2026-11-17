
"""Nimbus AI data cleaning pipeline.

Reads data/raw, standardizes all three datasets,
writes data/clean and outputs/changelog.md.
"""

import csv
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw"
CLEAN = DATA / "clean"
OUTPUTS = ROOT / "outputs"

CHANGELOG = []


def log(message):
    CHANGELOG.append(f"- {message}")


def normalize_id(value):
    return str(value).strip().upper()


def parse_date(value):
    value = str(value).strip()

    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(value, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass

    raise ValueError(f"Invalid date: {value}")


def read_csv(path):
    with path.open("r", newline="", encoding="utf-8-sig") as file:
        return list(csv.DictReader(file))


def write_csv(path, fieldnames, rows):
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def clean_initiatives():
    rows = read_csv(RAW / "initiatives.csv")
    cleaned = []

    for row in rows:
        old_id = row["initiative_id"]
        iid = normalize_id(old_id)

        if old_id != iid:
            log(f"Initiatives: normalized ID '{old_id}' to '{iid}'.")

        old_date = row["go_live_date"]
        new_date = parse_date(old_date)

        if old_date != new_date:
            log(f"Initiatives {iid}: standardized date '{old_date}' to '{new_date}'.")

        cleaned.append({
            "initiative_id": iid,
            "name": row["name"].strip(),
            "type": row["type"].strip().lower(),
            "go_live_date": new_date,
            "licensed_users": int(row["licensed_users"]),
            "planned_annual_benefit": float(row["planned_annual_benefit"]),
        })

    write_csv(
        CLEAN / "initiatives.csv",
        [
            "initiative_id", "name", "type", "go_live_date",
            "licensed_users", "planned_annual_benefit"
        ],
        cleaned,
    )

    return cleaned


def clean_usage():
    rows = read_csv(RAW / "usage.csv")
    records = {}
    metric_names = {"WAU", "weekly_active_users", "active_users_wk"}

    for row in rows:
        iid = normalize_id(row["initiative_id"])
        week = int(row["week"])
        metric = row["metric"].strip()

        if metric not in metric_names:
            raise ValueError(f"Unknown usage metric: {metric}")

        if metric != "WAU":
            log(f"Usage {iid}, week {week}: standardized metric '{metric}' to 'WAU'.")

        raw_value = str(row.get("value", "")).strip()
        value = float(raw_value) if raw_value else None

        key = (iid, week)

        if key in records:
            if records[key] == value:
                log(f"Usage {iid}, week {week}: removed duplicate record.")
                continue
            raise ValueError(f"Conflicting duplicate usage record: {key}")

        records[key] = value

    # Interpolate missing values between known weeks.
    for iid in sorted({key[0] for key in records}):
        weeks = sorted(
            week for (record_iid, week) in records if record_iid == iid
        )

        for week in weeks:
            key = (iid, week)

            if records[key] is not None:
                continue

            previous = [
                w for w in weeks
                if w < week and records[(iid, w)] is not None
            ]
            following = [
                w for w in weeks
                if w > week and records[(iid, w)] is not None
            ]

            if not previous or not following:
                raise ValueError(
                    f"Cannot safely interpolate missing usage for {iid}, week {week}"
                )

            left = max(previous)
            right = min(following)

            left_value = records[(iid, left)]
            right_value = records[(iid, right)]

            interpolated = left_value + (
                (right_value - left_value) * (week - left) / (right - left)
            )

            records[key] = round(interpolated)

            log(
                f"Usage {iid}, week {week}: imputed missing WAU "
                f"as {records[key]} by linear interpolation."
            )

    cleaned = [
        {
            "initiative_id": iid,
            "week": week,
            "weekly_active_users": int(value),
        }
        for (iid, week), value in sorted(records.items())
    ]

    write_csv(
        CLEAN / "usage.csv",
        ["initiative_id", "week", "weekly_active_users"],
        cleaned,
    )

    return cleaned


def clean_finance():
    path = RAW / "finance.csv"

    with path.open("r", newline="", encoding="utf-8-sig") as file:
        raw_rows = list(csv.reader(file))

    if not raw_rows:
        raise ValueError("Finance CSV is empty.")

    expected_header = [
        "initiative_id", "cost_to_date",
        "realised_benefit_to_date", "currency"
    ]

    first = [value.strip().lower() for value in raw_rows[0]]

    if first and first[0] == "initiative_id":
        data_rows = raw_rows[1:]
    else:
        data_rows = raw_rows
        log("Finance: detected missing header row; restored standard column names.")

    cleaned = []

    for row in data_rows:
        if len(row) < 4:
            raise ValueError(f"Invalid finance row: {row}")

        iid = normalize_id(row[0])
        cost = float(row[1].strip())
        benefit = float(row[2].strip())
        currency = row[3].strip().upper()

        if currency == "INR_LAKH":
            cost *= 100000
            benefit *= 100000
            log(f"Finance {iid}: converted INR lakh values to INR.")
        elif currency != "INR":
            raise ValueError(f"Unsupported currency '{currency}' for {iid}.")

        if cost < 0:
            log(f"Finance {iid}: corrected negative cost sign; used absolute value.")
            cost = abs(cost)

        cleaned.append({
            "initiative_id": iid,
            "cost_to_date": round(cost, 2),
            "realised_benefit_to_date": round(benefit, 2),
        })

    write_csv(
        CLEAN / "finance.csv",
        ["initiative_id", "cost_to_date", "realised_benefit_to_date"],
        cleaned,
    )

    return cleaned


def clean_data():
    global CHANGELOG
    CHANGELOG = []

    CLEAN.mkdir(parents=True, exist_ok=True)
    OUTPUTS.mkdir(parents=True, exist_ok=True)

    initiatives = clean_initiatives()
    usage = clean_usage()
    finance = clean_finance()

    report = [
        "# Nimbus AI — Data Cleaning Changelog",
        "",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "## Summary",
        "",
        f"- Initiatives processed: {len(initiatives)}",
        f"- Usage records processed: {len(usage)}",
        f"- Finance records processed: {len(finance)}",
        f"- Data-quality corrections logged: {len(CHANGELOG)}",
        "",
        "## Corrections",
        "",
    ]

    report.extend(CHANGELOG or ["- No corrections were required."])

    report.extend([
        "",
        "## Output Files",
        "",
        "- data/clean/initiatives.csv",
        "- data/clean/usage.csv",
        "- data/clean/finance.csv",
        "",
        "All financial values are standardized to INR.",
    ])

    changelog_path = OUTPUTS / "changelog.md"
    changelog_path.write_text("\n".join(report), encoding="utf-8")

    return {
        "status": "success",
        "initiatives": len(initiatives),
        "usage_records": len(usage),
        "finance_records": len(finance),
        "corrections": len(CHANGELOG),
        "changelog": str(changelog_path),
    }


def get_changelog():
    path = OUTPUTS / "changelog.md"

    if not path.exists():
        return {
            "available": False,
            "message": "Changelog has not been generated yet.",
            "content": "",
        }

    return {
        "available": True,
        "content": path.read_text(encoding="utf-8"),
    }


if __name__ == "__main__":
    print(clean_data())
