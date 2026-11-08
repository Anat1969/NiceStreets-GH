#!/usr/bin/env python3
"""
שבילי האופניים מה-GIS העירוני (bike_road.shp) -> data/bike-paths.geojson.

    pip install pyshp pyproj
    python3 scripts/import-bike-paths.py <bike_road.shp> > data/bike-paths.geojson

הקובץ מגיע ב-ITM (EPSG:2039) ומומר ל-WGS84. סמל רחוב אין בשכבה, ולכן הרחוב
מחובר למרשם לפי שם (data/ashdod-streets.json, כולל שמות נרדפים).
שדות הקוד (סטטוס, סוג, מסלולים, ניתוב, תמרור, צד כביש) נשמרים כמו שהם:
משמעות הקודים לא נמסרה, ולכן אין להם תווית.
"""

import json
import re
import sys
from pathlib import Path

import shapefile
from pyproj import Transformer

ROOT = Path(__file__).resolve().parent.parent
TO_WGS84 = Transformer.from_crs("EPSG:2039", "EPSG:4326", always_xy=True)


def norm(s: str) -> str:
    s = (s or "").replace("״", '"').replace("׳", "'").replace("''", '"')
    s = re.sub(r"^שדרות ", "שד ", s)
    s = re.sub(r"^שד' ", "שד ", s)
    s = re.sub(r"[-–.,()]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# שגיאות הקלדה בשכבה המקורית, שתוקנו כאן ולא בקובץ של העירייה.
TYPOS = {"דיו משה": "דיין משה", "שד הים התבון": "שד הים התיכון", "שד הים התכון": "שד הים התיכון"}


def lookup(index: dict, name: str) -> str:
    n = norm(TYPOS.get(norm(name), name))
    return index.get(n) or index.get(re.sub(r"^שד ", "", n), "")


def registry():
    data = json.loads((ROOT / "data/ashdod-streets.json").read_text("utf8"))
    index = {}
    for st in data["streets"]:
        for name in [st["name"], *st.get("synonyms", [])]:
            index.setdefault(norm(name), st["code"])
    return index


def main(path: str) -> None:
    index = registry()
    reader = shapefile.Reader(path, encoding="utf-8")
    features, unmatched = [], set()
    for shape, rec in zip(reader.iterShapes(), reader.iterRecords()):
        r = rec.as_dict()
        if not shape.points:
            continue
        parts = list(shape.parts) + [len(shape.points)]
        lines = []
        for a, b in zip(parts, parts[1:]):
            line = [
                [round(x, 6), round(y, 6)]
                for x, y in (TO_WGS84.transform(px, py) for px, py in shape.points[a:b])
            ]
            if len(line) >= 2:
                lines.append(line)
        if not lines:
            continue
        name = (r["street"] or "").strip()
        code = lookup(index, name)
        if name and not code:
            unmatched.add(name)
        features.append({
            "type": "Feature",
            "properties": {
                "code": code,
                "name": name,
                "quarter": (r["rova"] or "").strip(),
                "width_m": r["rohav_m"] or None,
                "color": (r["color"] or "").strip(),
                "status": r["statua"],
                "kind": r["sug"],
                "lanes": r["maslulim"],
                "routing": r["nituv"],
                "sign": r["tamrur"],
                "side": r["zad_kvish"],
            },
            "geometry": (
                {"type": "LineString", "coordinates": lines[0]}
                if len(lines) == 1
                else {"type": "MultiLineString", "coordinates": lines}
            ),
        })
    if unmatched:
        print("לא הותאמו למרשם: " + ", ".join(sorted(unmatched)), file=sys.stderr)
    out = {
        "type": "FeatureCollection",
        "name": "ashdod-bike-paths",
        "source": "עיריית אשדוד, שכבת שבילי אופניים (bike_road.shp), 05.11.2026. הומר מ-ITM (EPSG:2039) ל-WGS84.",
        "fields": {
            "code": "סמל רחוב לפי המרשם, בהתאמת שם (ריק כשלא הותאם)",
            "name": "שם רחוב",
            "quarter": "רובע",
            "width_m": "רוחב שביל במטרים",
            "color": "צבע",
            "status": "סטטוס (קוד, משמעות לא נמסרה)",
            "kind": "סוג שביל (קוד, משמעות לא נמסרה)",
            "lanes": "מסלולים (קוד)",
            "routing": "סימון ניתוב (קוד)",
            "sign": "תמרור (קוד)",
            "side": "צד כביש (קוד)",
        },
        "features": features,
    }
    json.dump(out, sys.stdout, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: import-bike-paths.py <bike_road.shp>")
    main(sys.argv[1])
