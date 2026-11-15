# Hussainabad, Live — Lucknow's heritage mile in 3D

An animated, walkable 3D model of the Hussainabad precinct of Lucknow: the Clock Tower, Husainabad Talab, Picture Gallery, Satkhanda, Chota Imambara, the two Husainabad gateways, Rumi Darwaza, Bara Imambara with the Asfi Mosque, Jama Masjid and the 2025 food court, set on the area's real street map.

It runs in the browser with [three.js](https://threejs.org/) and has no build step.

## Run it

Open `index.html` in a modern browser (an internet connection is needed once, to load three.js from a CDN), or serve the folder:

```bash
python -m http.server 8123
```

then visit `http://localhost:8123`.

## What you can do

| Mode | How |
| --- | --- |
| **Explore** | Drag to orbit, right-drag to pan, scroll to zoom. Click a label or a name in the list to fly there. |
| **Walk** | Press `2`, double-click any spot on the ground, or use *Walk here* on a place card. `W A S D` to move, mouse to look, `Shift` to run, `Space` to hop. Buildings, railings and water block you; steps and plinths can be climbed. On a phone a joystick appears. |
| **Tour** | A guided fly-through of every landmark. |

**Options** (`O`) cover label language (Hindi, Urdu, English), weather (clear, haze, overcast, winter fog, monsoon rain), festive night illumination, walking pace, graphics quality, shadows and synthesised street sound. The time bar follows live Indian Standard Time with the real sun path for Lucknow, or jumps to sunrise, midday, golden hour, dusk or night. Crowds and traffic follow the hour on their own: near-empty before dawn, a morning rush, and the busiest streets in the evening.

Other keys: `H` photo mode, `P` save a screenshot, `M` minimap, `L` cycle label language, `T` tour.

## How it is built

| Path | Role |
| --- | --- |
| `data/map.js` | Streets, river, parks and landmark footprints, generated from OpenStreetMap |
| `tools/build_map.py` | Converts an Overpass API export into `data/map.js` (query in `tools/overpass_query.txt`) |
| `src/core.js` | Renderer, options, textures, materials, geometry helpers, collision records |
| `src/sky.js` | Solar position, sky and clouds, weather, rain, night lighting |
| `src/city.js` | Ground, roads, footpaths, river, houses grown along the real lanes, trees, lamps, wires |
| `src/monuments.js` | The hand-modelled monuments, each in its surveyed position and orientation |
| `src/life.js` | Traffic on the street graph, horses, people, vendors, birds, kites, fountains |
| `src/ui.js` | Explore / walk / tour, labels, minimap, options, sound, main loop |

The scripts are plain files sharing one scope so the folder also works when opened straight from disk.

## Accuracy

- Street layout, river, parks and the positions and orientations of the landmarks come from OpenStreetMap.
- Monuments were modelled by hand against current satellite and street-level imagery. They are stylised, not surveyed.
- Only the heritage corridor is built out: from the Husainabad gateways west of the Chota Imambara to the Bara Imambara. Daulatganj and the lanes beyond are left as open ground to keep the scene light.
- Ordinary houses are generated along the real lanes; individual buildings are not real.
- About 55 shop and stall names (Tunday Kababi, Irani Dum Tea, Kebabchi, Cafe Dubai, Naval Medical Store and others) come from current map listings and are placed at or near their mapped spots. Other shop boards use generic names.
- Rumi Darwaza is shown as it is now: closed to vehicles, with traffic looping round its north end.
- The short history notes in the app are summaries and should be checked before being quoted.

## Credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the Open Database License.
