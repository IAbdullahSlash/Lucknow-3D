"""Convert an Overpass API dump of the Hussainabad precinct into data/map.js.

Usage:  python tools/build_map.py <overpass.json> data/map.js

The query that produces the input lives in tools/overpass_query.txt (run it at
https://overpass-turbo.eu or POST it to an Overpass endpoint).  Coordinates are
projected to metres on a local tangent plane whose origin is the Husainabad
Clock Tower:  x = east, z = south (so north is -z), matching the 3D scene.

Map data (c) OpenStreetMap contributors, ODbL 1.0.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

from shapely import make_valid, set_precision
from shapely.geometry import MultiLineString, Polygon, box
from shapely.ops import linemerge

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
    start = a if t0 == 0 else (a[0] + t0 * dx, a[1] + t0 * dz)
    end = b if t1 == 1 else (a[0] + t1 * dx, a[1] + t1 * dz)
    return start, end


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


BOUNDS = box(XMIN, ZMIN, XMAX, ZMAX)
AREA_TYPES = ("historic", "tourism", "amenity", "man_made", "landuse")


def flat(points):
    return [round(value, 1) for point in points for value in point]


def outer_parts(geometry):
    if geometry.geom_type == "Polygon" and not geometry.is_empty:
        yield geometry
    elif hasattr(geometry, "geoms"):
        for member in geometry.geoms:
            yield from outer_parts(member)


def clipped_polygons(polygon):
    """Clip the polygon as a whole so a hole crossing the edge becomes a notch."""
    valid = polygon if polygon.is_valid else make_valid(polygon)
    parts = []
    for component in outer_parts(valid):
        clipped = component.intersection(BOUNDS)
        parts.extend(outer_parts(set_precision(clipped, 0.1).normalize()))
    return sorted(parts, key=lambda part: (part.bounds, part.wkb))


def named_tags(tags):
    return {
        key: value
        for key, value in (
            ("n", tags.get("name") or tags.get("name:en")),
            ("hi", tags.get("name:hi")), ("ur", tags.get("name:ur")),
        )
        if value
    }


def polygon_kind(tags):
    if "building" in tags:
        return "buildings", next((f"{k}={tags[k]}" for k in AREA_TYPES if k in tags), None)
    if tags.get("natural") == "water" or tags.get("landuse") == "basin":
        return "water", tags.get("water") or tags.get("landuse") or "water"
    if tags.get("leisure") in ("park", "pitch", "garden", "playground"):
        return "green", tags["leisure"]
    for key in AREA_TYPES:
        if key in tags:
            return "areas", f"{key}={tags[key]}"
    return None, None


def polygon_features(polygons, id_, tags, kind):
    parts = sorted(
        (part for polygon in polygons for part in clipped_polygons(polygon)),
        key=lambda part: (part.bounds, part.wkb),
    )
    for index, part in enumerate(parts):
        feature = {"osm": id_, "p": flat(list(part.exterior.coords)[:-1]), **named_tags(tags)}
        if len(parts) > 1:
            feature["part"] = index
        if part.interiors:
            feature["holes"] = [flat(list(ring.coords)[:-1]) for ring in part.interiors]
        if kind:
            feature["k"] = kind
        if "building" in tags:
            if tags["building"] != "yes":
                feature["b"] = tags["building"]
            for key, short in (("building:levels", "l"), ("height", "h")):
                if key in tags:
                    feature[short] = tags[key]
        yield feature


def relation_polygons(element, ways):
    groups = {"outer": [], "inner": []}
    members = set()
    for member in element.get("members", []):
        role = member.get("role") or "outer"
        if member["type"] != "way" or role not in groups:
            continue
        geo = member.get("geometry") or ways.get(member["ref"])
        if not geo or len(geo) < 2 or any(point is None for point in geo):
            return [], set()
        groups[role].append([xz(point) for point in geo])
        members.add(member["ref"])

    rings = {}
    for role, segments in groups.items():
        merged = linemerge(MultiLineString(segments)) if segments else None
        lines = [] if merged is None else ([merged] if merged.geom_type == "LineString" else list(merged.geoms))
        if any(not line.is_ring for line in lines):
            return [], set()
        rings[role] = [Polygon(line.coords) for line in lines]

    shells = rings["outer"]
    holes = [[] for _ in shells]
    for inner in rings["inner"]:
        containing = [index for index, outer in enumerate(shells) if outer.covers(inner)]
        if not containing:
            return [], set()
        owner = min(containing, key=lambda index: shells[index].area)
        holes[owner].append(inner.exterior.coords)
    return [Polygon(shell.exterior.coords, holes[i]) for i, shell in enumerate(shells)], members


def road_features(pts, id_, tags):
    category = tags["highway"]
    if category not in ROAD_WIDTH:
        return
    width = ROAD_WIDTH[category]
    try:
        if "width" in tags:
            width = float(tags["width"])
        elif "lanes" in tags and category in ("primary", "secondary", "tertiary"):
            width = max(width, float(tags["lanes"]) * 3.6 + 1.5)
    except ValueError:
        pass
    if not math.isfinite(width) or width <= 0:
        width = ROAD_WIDTH[category]
    oneway = tags.get("oneway")
    if oneway == "-1":
        pts = pts[::-1]
    runs = clip_polyline(pts)
    for index, run in enumerate(runs):
        record = {"osm": id_, "k": category, "w": round(width, 1), "p": flat(run), **named_tags(tags)}
        if len(runs) > 1:
            record["part"] = index
        if oneway in ("yes", "-1"):
            record["o"] = 1
        if tags.get("bridge") not in (None, "no"):
            record["b"] = 1
        if tags.get("foot") == "no":
            record["f"] = 0
        if tags.get("surface"):
            record["s"] = tags["surface"]
        yield record


def convert(snapshot, source_sha256, query_sha256=None):
    elements = sorted(snapshot["elements"], key=lambda item: (item["type"], item["id"]))
    data = {
        "origin": {"lat": LAT0, "lon": LON0, "name": "Husainabad Clock Tower"},
        "bounds": [XMIN, XMAX, ZMIN, ZMAX],
        "attribution": "Map data (c) OpenStreetMap contributors, ODbL",
        "source": {
            "format": 2,
            "provider": "OpenStreetMap via Overpass",
            "osm_timestamp": snapshot.get("osm3s", {}).get("timestamp_osm_base"),
            "query_sha256": query_sha256,
            "extract_sha256": source_sha256,
        },
        **{k: [] for k in ("roads", "water", "green", "areas", "buildings", "pois", "barriers", "streams")},
    }
    ways = {e["id"]: e.get("geometry") for e in elements if e["type"] == "way"}
    consumed = set()
    skipped = []
    for e in elements:
        if e["type"] != "relation":
            continue
        tags = e.get("tags", {})
        category, kind = polygon_kind(tags)
        if not category or tags.get("type") not in ("multipolygon", "boundary"):
            continue
        polygons, members = relation_polygons(e, ways)
        id_ = f"relation/{e['id']}"
        if not polygons:
            skipped.append(id_)
            continue
        data[category].extend(polygon_features(polygons, id_, tags, kind))
        consumed.update((ref, category) for ref in members)

    for e in elements:
        tags = e.get("tags", {})
        id_ = f"{e['type']}/{e['id']}"
        if e["type"] == "node":
            x, z = xz(e)
            names = named_tags(tags)
            kind = next((f"{k}={tags[k]}" for k in ("historic", "tourism", "amenity", "shop", "place") if k in tags), None)
            if inside((x, z)) and kind and "n" in names:
                data["pois"].append({"osm": id_, **names, "k": kind, "x": round(x, 1), "z": round(z, 1)})
            continue
        if e["type"] != "way" or not e.get("geometry"):
            continue
        pts = [xz(point) for point in e["geometry"]]
        closed = len(pts) > 3 and pts[0] == pts[-1]
        if "highway" in tags:
            data["roads"].extend(road_features(pts, id_, tags))
        elif "barrier" in tags:
            data["barriers"].extend({"osm": id_, "k": tags["barrier"], "p": flat(run)} for run in clip_polyline(pts))
        elif not closed and tags.get("waterway") in ("stream", "river", "weir"):
            data["streams"].extend({"osm": id_, "k": tags["waterway"], "p": flat(run), **named_tags(tags)} for run in clip_polyline(pts))
        elif closed:
            category, kind = polygon_kind(tags)
            if category and (e["id"], category) not in consumed:
                data[category].extend(polygon_features([Polygon(pts)], id_, tags, kind))
    return data, skipped


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("extract", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--query", type=Path, help="Exact Overpass query used to produce the archived extract")
    args = parser.parse_args()
    extract = args.extract.read_bytes()
    query_hash = hashlib.sha256(args.query.read_bytes()).hexdigest() if args.query else None
    data, skipped = convert(json.loads(extract), hashlib.sha256(extract).hexdigest(), query_hash)
    with args.output.open("w", encoding="utf-8") as file:
        file.write("// Generated by tools/build_map.py from OpenStreetMap. Do not edit by hand.\n")
        file.write("// Map data (c) OpenStreetMap contributors, Open Database License (ODbL) 1.0.\n")
        file.write("window.MAPDATA = ")
        json.dump(data, file, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        file.write(";\n")
    print({k: len(v) for k, v in data.items() if isinstance(v, list)})
    if skipped:
        print("Incomplete multipolygon relations:", ", ".join(skipped))


if __name__ == "__main__":
    main()
