"""Geometric fixtures for the archived Overpass import."""

import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from shapely.geometry import Point, Polygon

from build_map import KX, KZ, LAT0, LON0, convert


def location(x, z):
    return {"lat": LAT0 - z / KZ, "lon": LON0 + x / KX}


def way(number, points, **tags):
    return {"id": number, "type": "way", "tags": tags, "geometry": [location(*p) for p in points]}


def member(feature, role, inline=True):
    geometry = {"geometry": feature["geometry"]} if inline else {}
    return {"type": "way", "role": role, "ref": feature["id"], **geometry}


def fixture():
    north = way(1, [(-80, -20), (-20, -20), (-20, 40)])
    south = way(2, [(-80, -20), (-80, 40), (-20, 40)])
    courtyard = way(3, [(-65, -5), (-35, -5), (-35, 25), (-65, 25), (-65, -5)])
    river_bank = way(4, [(150, -490), (210, -490), (210, -360), (150, -360), (150, -490)], natural="water")
    island = way(5, [(172, -485), (190, -485), (190, -420), (172, -420), (172, -485)])
    bridge = way(6, [(110, -440), (245, -440)], highway="secondary", bridge="yes", width="8")
    return {
        "osm3s": {"timestamp_osm_base": "2026-01-12T00:00:00Z"},
        "elements": [
            north, south, courtyard, river_bank, island, bridge,
            {"id": 7, "type": "relation", "tags": {"type": "multipolygon", "building": "yes", "name": "Original"},
             "members": [member(south, "outer"), member(north, "outer", inline=False), member(courtyard, "inner")]},
            {"id": 8, "type": "relation", "tags": {"type": "multipolygon", "natural": "water", "water": "river"},
             "members": [member(river_bank, "outer"), member(island, "inner")]},
        ],
    }


def polygon(feature):
    def points(ring):
        return list(zip(ring[::2], ring[1::2]))
    return Polygon(points(feature["p"]), [points(h) for h in feature.get("holes", [])])


class MapImportTests(unittest.TestCase):
    def test_courtyard_from_multipart_boundary(self):
        data, skipped = convert(fixture(), "fixture")
        self.assertEqual(skipped, [])
        (courtyard,) = data["buildings"]
        self.assertEqual(courtyard["osm"], "relation/7")
        self.assertFalse(polygon(courtyard).covers(Point(-50, 10)))
        self.assertTrue(polygon(courtyard).covers(Point(-76, 0)))

    def test_river_clipped_with_island_and_bridge(self):
        data, _ = convert(fixture(), "fixture")
        (river,) = data["water"]
        shape = polygon(river)
        self.assertTrue(shape.is_valid)
        self.assertEqual(shape.bounds[1], -470)
        self.assertFalse(shape.covers(Point(178, -468)))
        self.assertTrue(shape.covers(Point(200, -450)))
        (bridge,) = data["roads"]
        self.assertEqual((bridge["osm"], bridge["b"], bridge["w"]), ("way/6", 1, 8))
        self.assertTrue(shape.covers(Point(152, -440)))

    def test_renaming_keeps_identity_and_geometry(self):
        original = fixture()
        renamed = copy.deepcopy(original)
        relation = next(e for e in renamed["elements"] if e["type"] == "relation" and e["id"] == 7)
        relation["tags"]["name"] = "New name"
        renamed["elements"].reverse()
        a, _ = convert(original, "fixture")
        b, _ = convert(renamed, "fixture")
        self.assertNotEqual(a["buildings"][0].pop("n"), b["buildings"][0].pop("n"))
        self.assertEqual(a, b)

    def test_repeated_conversion_is_byte_identical(self):
        fixture_bytes = json.dumps(fixture()).encode()
        query = Path(__file__).with_name("overpass_query.txt")
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            extract = path / "extract.json"
            extract.write_bytes(fixture_bytes)
            outputs = [path / name for name in ("one.js", "two.js")]
            for dest in outputs:
                subprocess.run([sys.executable, str(Path(__file__).with_name("build_map.py")), str(extract),
                                str(dest), "--query", str(query)], check=True, capture_output=True)
            self.assertEqual(outputs[0].read_bytes(), outputs[1].read_bytes())
            metadata = json.loads(outputs[0].read_text().split("window.MAPDATA = ")[1][:-2])["source"]
            self.assertEqual(metadata["osm_timestamp"], "2026-01-12T00:00:00Z")
            self.assertEqual(metadata["query_sha256"], hashlib.sha256(query.read_bytes()).hexdigest())
            self.assertEqual(metadata["extract_sha256"], hashlib.sha256(fixture_bytes).hexdigest())


if __name__ == "__main__":
    unittest.main()
