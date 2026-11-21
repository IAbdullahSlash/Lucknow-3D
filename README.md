# Hussainabad, Live — Lucknow's heritage mile in 3D

An animated, walkable 3D model of the Hussainabad precinct of Lucknow, with the Clock Tower, Husainabad Talab, Picture Gallery, Satkhanda, Chota Imambara, the two Husainabad gateways, Rumi Darwaza, Bara Imambara with the Asfi Mosque, and the food court.

The scene runs without an internet connection or a build step. The repository includes the pinned Three.js r160 bundle and its license. [Three.js license](vendor/THREE-LICENSE.txt)

## Run it

Open `index.html` in a modern WebGL browser, or serve the folder with Python.

```bash
python3 -m http.server 8123
```

Visit `http://localhost:8123`. If 3D startup fails, the page offers a retry, the itinerary and shop guide in text, and the 2D map.

## What you can do

| Mode | How |
| --- | --- |
| **Explore** | Drag to move across the map, right-drag (or `Shift`-drag) to turn and tilt, scroll to zoom in on whatever is under the cursor. The `+` / `−` buttons and keys zoom too, and a click on the minimap slides the view there. Click a label or a name in the list to fly to it. On a phone: drag to move, pinch to zoom, two fingers to turn, double-tap the ground to walk there. |
| **Walk** | Press `2`, double-click any spot on the ground, or use *Walk here* on a place card. `W A S D` to move, or hold the left mouse button to walk where you look (right button steps back); mouse to look, `Shift` to run, `Space` to hop. On a phone a stick on the left walks you, dragging the view looks around, a pinch pulls the camera in or out (all the way to first person), and Run / View / Hop / Exit buttons sit on the right. People step round you, stall-keepers turn and beckon as you pass, and each monument introduces itself when you reach it. After dark you carry a lantern. You steer a figure seen from behind; the wheel brings the camera nearer or farther, and all the way in is a first-person view. Buildings, railings and water block you; steps and plinths can be climbed. On a phone a joystick appears. |
| **Tour** | Follow the Clock Tower, Talab and Rumi Darwaza in order. Use Previous, Next or Pause to set the pace, Itinerary to read all three stops, and Walk here to start a leg. The minimap marks the route and the next destination. The Rumi card shows both faces of the gate. |

Select a shop's name tag in the scene to open its card: Tunday Kababi, Globe Cafe 24x7, Turkish Cafe, Kebabchi, the three Irani tea and food stalls, Chai Mahal and Kamar Sheermal. Choose **At the counter** for a closer view or **Walk here** to arrive on foot. Places lists the landmarks, including the Husainabad Food Court.

The time bar uses Lucknow local time. Select **Live**, choose a solar preset, or use the slider to set a minute by hand. Crowds, traffic, shop shutters and the counter lighting follow the selected time. **Options** (`O`) includes English, Hindi and Urdu labels, five weather presets, festive illumination, walking pace, quality, shadows and optional street sound.

Use `H` for photo mode, `P` to save a screenshot, `M` for the minimap, `L` to cycle label languages, and `T` for the tour. Show controls restores the interface in photo mode. With reduced motion enabled, the tour starts paused and viewpoint changes are immediate.

## How it is built

| Path | Role |
| --- | --- |
| `data/map.js` | Streets, river, parks and landmark footprints, generated from OpenStreetMap |
| `data/places.js` | Heritage walk, featured shops, translations and arrival coordinates |
| `tools/build_map.py` | Converts an Overpass API export into `data/map.js` (query in `tools/overpass_query.txt`) |
| `src/bootstrap.js` | Local script loading and the text guides on startup failure |
| `src/core.js` | Renderer, options, textures, materials, geometry helpers, collision records |
| `src/solar.js` | Lucknow civil time and dated solar positions |
| `src/sky.js` | Sky, haze, rain, wet ground and night lighting |
| `src/city.js` | Ground, roads, footpaths, river, houses grown along the real lanes, trees, lamps, wires |
| `src/monuments.js` | The hand-modelled monuments, each in its surveyed position and orientation |
| `src/shops.js` | Featured shopfronts, street fittings, counter lights and service schedules |
| `src/life.js` | Traffic on the street graph, horses, people, stray cows, dogs and goats, vendors, birds, kites, fountains |
| `src/navigation.js` | Walkable floors, water, bridge decks and building collisions |
| `src/ui.js` | Explore / walk / tour, labels, minimap, options, sound, main loop |

The scripts are plain files sharing one scope so the folder also works when opened straight from disk.

## Measure the scene

Serve the project and open `tools/benchmark.html` from the same server. Each run includes midday Explore, a Rumi Darwaza walk and an evening monsoon tour. Select **Include shop passes** for two additional passes at the Tunday counter. The report includes startup time, median and p95 frame intervals, draw calls and triangles. Leave the tab visible for the optional ten-minute soak. Use `node --test tools/test_solar.cjs` to check the local time and solar calculation. [Heritage walk review](docs/astra-6.2/implementation.md)

## Update the street map

Save the exact query and dated Overpass JSON extract together. Generate a candidate offline and review it beside the checked-in version in [the 2D map preview](tools/map_preview.html).

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r tools/requirements-map.txt
.venv/bin/python tools/build_map.py archived-overpass.json /tmp/lucknow-candidate.js --query tools/overpass_query.txt
.venv/bin/python -m unittest discover -s tools -p 'test_build_map.py'
```

The candidate records its source timestamp, the extract and query hashes, and typed OSM IDs. Keep the candidate separate until you have checked the building footprints, waterways, pilot route and landmark views in a copy of the app. The checked-in extract predates this metadata.

To rebuild the local Three.js bundle from the locked npm packages, run `npm ci --prefix tools/vendor` and `npm run build --prefix tools/vendor`.

## Accuracy

- Street layout, river, parks and the positions and orientations of the landmarks come from OpenStreetMap.
- Monuments were modelled by hand against current satellite and street-level imagery. They are stylised, not surveyed.
- Most detail is concentrated between the Husainabad gateways and Bara Imambara. The minimap marks the approximate extent. A few mapped building footprints provide simpler context outside it.
- Ordinary houses are generated along the real lanes; individual buildings are not real.
- Chai Mahal uses the tea-shop point in the checked-in OpenStreetMap extract. The five other featured shops use illustrated placements and façades. Opening, service and closing follow scene schedules.
- Rumi Darwaza is shown as it is now: closed to vehicles, with traffic looping round its north end.
- The short history notes in the app are summaries and should be checked before being quoted.

## Credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the Open Database License.
