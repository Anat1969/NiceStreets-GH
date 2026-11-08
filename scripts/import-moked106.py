#!/usr/bin/env python3
"""
פניות מוקד 106 (call_center_inquiries.shp) -> ספירות לרחוב, לנושא ולחודש.

    pip install pyshp
    python3 -I scripts/import-moked106.py <call_center_inquiries.shp> <codes> > /tmp/moked106.sql

<codes>: סמלי הרחובות שבמסד, מופרדים בפסיק (select string_agg(code, ',') from streets).

הפלט הוא SQL שממלא את public.moked106_street_counts, ומריצים אותו בכלי ה-SQL של Supabase.

פרטיות: הקובץ המקורי כולל שם, טלפון ומייל של המדווחים. הסקריפט קורא רק
סוג פנייה, תיאור (לסינון פניות בדיקה), תאריך וכתובת, ומוציא ספירות בלבד.
הקובץ המקורי לעולם אינו נכנס למאגר. הטבלה עצמה לצוות בלבד (RLS).

- הרחוב: לפי שם הכתובת מול המרשם (data/ashdod-streets.json, עם שמות נרדפים).
  כתובת של צומת ("מנחם בגין הרצל") נספרת לרחוב הראשון בשמה.
- הנושא: data/moked106-topics.json.
- החודשים: מכל חודש מלא שבקובץ. החודש האחרון, כשהוא חלקי, לא נכלל.
- לכל רחוב במסד נכתבת שורה לכל חודש, גם כשאין פניות (0): אפס הוא נתון, לא "אין נתון".
"""

import collections
import datetime as dt
import json
import re
import sys
from pathlib import Path

import shapefile

ROOT = Path(__file__).resolve().parent.parent
FIELDS = ["EventTypeD", "EventDetai", "EventCreat", "EventAddre"]
TEST = re.compile(r"^\s*(test|בדיקה|בדיקת מערכת)\b", re.I)


def norm(s: str) -> str:
    s = (s or "").replace("״", '"').replace("׳", "'").replace("''", '"')
    s = re.sub(r"^שדרות ", "שד ", s)
    s = re.sub(r"^שד' ", "שד ", s)
    s = re.sub(r"[-–.,()]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def registry():
    data = json.loads((ROOT / "data/ashdod-streets.json").read_text("utf8"))
    index = {}
    for st in data["streets"]:
        for name in [st["name"], *st.get("synonyms", [])]:
            index.setdefault(norm(name), st["code"])
    return index, sorted(index, key=len, reverse=True)


def street_code(index, names, address):
    a = re.sub(r"\s*\d.*$", "", norm(address)).strip()
    if a in index:
        return index[a]
    for n in names:
        if len(n) >= 3 and a.startswith(n + " "):
            return index[n]
    return None


def main(path: str, wanted: set) -> None:
    index, names = registry()
    topics = json.loads((ROOT / "data/moked106-topics.json").read_text("utf8"))
    topic_of = {t: k for k in ("maintenance", "safety") for t in topics[k]}

    reader = shapefile.Reader(path, encoding="utf-8")
    counts = collections.Counter()
    seen = matched = tests = 0
    last = dt.date.min
    for rec in reader.iterRecords(fields=FIELDS):
        date = rec["EventCreat"]
        if not isinstance(date, dt.date) or date.year < 2000:
            continue
        last = max(last, date)
        topic = topic_of.get((rec["EventTypeD"] or "").strip())
        if not topic:
            continue
        if TEST.match(rec["EventDetai"] or ""):
            tests += 1
            continue
        seen += 1
        code = street_code(index, names, rec["EventAddre"] or "")
        if code is None:
            continue
        matched += 1
        counts[(code, topic, f"{date.year:04d}-{date.month:02d}")] += 1

    # The last month counts only when the file runs to its final day.
    nxt = last + dt.timedelta(days=1)
    end = f"{last.year:04d}-{last.month:02d}" if nxt.month == last.month else None
    months = sorted({m for (_, _, m) in counts if end is None or m < end})
    # 24 months back from the last full one is enough for the 12-month window and a comparison year.
    months = months[-24:]
    version = f"call_center_inquiries.shp, נטען 05.11.2026, פניות עד {last.isoformat()}"

    print(f"-- מוקד 106: {seen} פניות בנושאי רחוב, {matched} הותאמו לרחוב, {tests} פניות בדיקה סוננו.")
    print(f"-- חודשים: {months[0]} עד {months[-1]}. פנייה אחרונה בקובץ: {last.isoformat()}.")
    print("begin;")
    print("delete from public.moked106_street_counts;")
    values = []
    codes = sorted(wanted)
    for code in codes:
        for topic in ("maintenance", "safety"):
            for m in months:
                values.append(f"('{code}','{topic}','{m}',{counts.get((code, topic, m), 0)})")
    print("insert into public.moked106_street_counts (street_id, topic, month, count, source_version)")
    print("select s.id, v.topic, v.month, v.n, " + "'" + version.replace("'", "''") + "'")
    print("from (values")
    print(",\n".join(values))
    print(") as v(code, topic, month, n) join public.streets s on s.code = v.code;")
    print("commit;")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: import-moked106.py <call_center_inquiries.shp> <code,code,...>")
    main(sys.argv[1], {c.strip() for c in sys.argv[2].split(",") if c.strip()})
