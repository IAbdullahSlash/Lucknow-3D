"""Convert an Overpass API dump of the Hussainabad precinct into data/map.js.

Usage:  python tools/build_map.py <overpass.json> data/map.js

The query that produces the input lives in tools/overpass_query.txt (run it at
https://overpass-turbo.eu or POST it to an Overpass endpoint).  Coordinates are
projected to metres on a local tangent plane whose origin is the Husainabad
Clock Tower:  x = east, z = south (so north is -z), matching the 3D scene.

Map data (c) OpenStreetMap contributors, ODbL 1.0.
"""
import json
import math
import sys

LAT0, LON0 = 26.87400, 80.90801            # Husainabad Clock Tower
KX = 111320 * math.cos(math.radians(LAT0))  # metres per degree of longitude
KZ = 110574                                 # metres per degree of latitude
XMIN, XMAX, ZMIN, ZMAX = -900.0, 900.0, -470.0, 820.0

ROAD_WIDTH = {"primary": 9.5, "primary_link": 6.5, "secondary": 9.0, "secondary_link": 6.0,
              "tertiary": 8.5, "tertiary_link": 6.0, "residential": 5.0, "living_street": 4.2,
              "service": 3.4, "footway": 2.2, "path": 2.0, "steps": 2.2}


def xz(p):
    return ((p["lon"] - LON0) * KX, -(p["lat"] - LAT0) * KZ)


def inside(p):
    return XMIN <= p[0] <= XMAX and ZMIN <= p[1] <= ZMAX


def clip_segment(a, b):
    """Liang-Barsky clip of segment a-b to the scene rectangle."""
    t0, t1 = 0.0, 1.0
    dx, dz = b[0] - a[0], b[1] - a[1]
    for p, q in ((-dx, a[0] - XMIN), (dx, XMAX - a[0]), (-dz, a[1] - ZMIN), (dz, ZMAX - a[1])):
        if p == 0:
            if q < 0:
                return None
        else:
            r = q / p
            if p < 0:
                if r > t1:
                    return None
                t0 = max(t0, r)
            else:
                if r < t0:
                    return None
                t1 = min(t1, r)
    return (a[0] + t0 * dx, a[1] + t0 * dz), (a[0] + t1 * dx, a[1] + t1 * dz)


def clip_polyline(pts):
    runs, cur = [], []
    for a, b in zip(pts, pts[1:]):
        c = clip_segment(a, b)
        if c is None:
            if len(cur) > 1:
                runs.append(cur)
            cur = []
            continue
        if not cur or cur[-1] != c[0]:
            if len(cur) > 1:
                runs.append(cur)
            cur = [c[0]]
        cur.append(c[1])
    if len(cur) > 1:
        runs.append(cur)
    return runs


def clip_polygon(pts):
    """Sutherland-Hodgman clip of a closed ring to the scene rectangle."""
    if pts and pts[0] == pts[-1]:
        pts = pts[:-1]
    edges = ((0, XMIN, 1), (0, XMAX, -1), (1, ZMIN, 1), (1, ZMAX, -1))
    for axis, lim, sign in edges:
        out = []
        for i, cur in enumerate(pts):
            prev = pts[i - 1]
            cin, pin = (cur[axis] - lim) * sign >= 0, (prev[axis] - lim) * sign >= 0
            if cin != pin:
                t = (lim - prev[axis]) / (cur[axis] - prev[axis])
                out.append((prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])))
            if cin:
                out.append(cur)
        pts = out
        if not pts:
            break
    return pts


def flat(pts):
    out = []
    for x, z in pts:
        out += [round(x, 1), round(z, 1)]
    return out


def ring(pts):
    return pts[:-1] if len(pts) > 1 and pts[0] == pts[-1] else pts


def main(src, dst):
    els = json.load(open(src, encoding="utf-8"))["elements"]
    roads, water, green, areas, buildings, pois, barriers, streams = [], [], [], [], [], [], [], []
    for e in els:
        t = e.get("tags", {})
        name, hi = t.get("name") or t.get("name:en") or "", t.get("name:hi", "")
        if e["type"] == "node":
            p = xz(e)
            if not inside(p) or not name:
                continue
            kind = next((f"{k}={t[k]}" for k in ("historic", "tourism", "amenity", "shop", "place") if k in t), None)
            if kind:
                pois.append({"n": name, "hi": hi, "k": kind, "x": round(p[0], 1), "z": round(p[1], 1)})
            continue
        if e["type"] != "way" or "geometry" not in e:
            continue
        pts = [xz(p) for p in e["geometry"]]
        closed = len(pts) > 3 and pts[0] == pts[-1]
        if "highway" in t:
            k = t["highway"]
            if k not in ROAD_WIDTH:
                continue
            w = ROAD_WIDTH[k]
            try:
                if "width" in t:
                    w = float(t["width"])
                elif "lanes" in t and k in ("primary", "secondary", "tertiary"):
                    w = max(w, float(t["lanes"]) * 3.6 + 1.5)
            except ValueError:
                pass
            for run in clip_polyline(pts):
                r = {"k": k, "w": round(w, 1), "p": flat(run)}
                if name:
                    r["n"] = name
                if hi:
                    r["hi"] = hi
                if t.get("oneway") == "yes":
                    r["o"] = 1
                if t.get("bridge") and t.get("bridge") != "no":
                    r["b"] = 1
                if t.get("surface"):
                    r["s"] = t["surface"]
                roads.append(r)
            continue
        if "building" in t and closed:
            if not any(inside(p) for p in pts):
                continue
            b = {"p": flat(ring(pts))}
            if name:
                b["n"] = name
            if hi:
                b["hi"] = hi
            for k in ("historic", "amenity", "tourism", "man_made"):
                if k in t:
                    b["k"] = f"{k}={t[k]}"
                    break
            if t.get("building") not in ("yes", None):
                b["b"] = t["building"]
            if "building:levels" in t:
                b["l"] = t["building:levels"]
            if "height" in t:
                b["h"] = t["height"]
            buildings.append(b)
            continue
        if t.get("waterway") in ("stream", "river", "weir") and not closed:
            for run in clip_polyline(pts):
                streams.append({"k": t["waterway"], "p": flat(run), "n": name})
            continue
        if "barrier" in t:
            for run in clip_polyline(pts):
                barriers.append({"k": t["barrier"], "p": flat(run)})
            continue
        if not closed:
            continue
        poly = clip_polygon(pts)
        if len(poly) < 3:
            continue
        item = {"p": flat(poly)}
        if name:
            item["n"] = name
        if hi:
            item["hi"] = hi
        if t.get("natural") == "water" or t.get("landuse") == "basin":
            item["k"] = t.get("water") or t.get("landuse") or "water"
            water.append(item)
        elif t.get("leisure") in ("park", "pitch", "garden", "playground"):
            item["k"] = t["leisure"]
            green.append(item)
        elif "landuse" in t or "historic" in t or "tourism" in t or "amenity" in t or "man_made" in t:
            item["k"] = next(f"{k}={t[k]}" for k in ("historic", "tourism", "amenity", "man_made", "landuse") if k in t)
            areas.append(item)
    data = {
        "origin": {"lat": LAT0, "lon": LON0, "name": "Husainabad Clock Tower"},
        "bounds": [XMIN, XMAX, ZMIN, ZMAX],
        "attribution": "Map data (c) OpenStreetMap contributors, ODbL",
        "roads": roads, "water": water, "green": green, "areas": areas,
        "buildings": buildings, "pois": pois, "barriers": barriers, "streams": streams,
    }
    with open(dst, "w", encoding="utf-8") as f:
        f.write("// Generated by tools/build_map.py from OpenStreetMap. Do not edit by hand.\n")
        f.write("// Map data (c) OpenStreetMap contributors, Open Database License (ODbL) 1.0.\n")
        f.write("window.MAPDATA = ")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print({k: len(v) for k, v in data.items() if isinstance(v, list)})


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main(sys.argv[1], sys.argv[2])
