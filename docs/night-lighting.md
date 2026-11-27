# Night lighting

November 2026. Until now the monuments glowed evenly after dark and the paving had faint, identical glows under the lamps. This pass lights the precinct the way the 2016 heritage-zone scheme and 2025–26 night photos show it. The code is in `src/night.js`, and the street lamps are in `src/city.js`.

## References

- **The heritage-zone scheme.** The 2 km walk from the Bara Imambara to the Chota Imambara was designed and lit by Archohm, with luminaires supplied by ILDL. Its street lamp stands on a 2.25 m red granite pedestal, and its form takes inspiration from the Rumi Darwaza arch. The scheme also covered facade lighting for Satkhanda and the Chota Imambara ([ILDL project page](https://www.ildlimited.com/portfolio/hussainabad-heritage-zone/)).
- **Night photos.** Stock and press photos of the Clock Tower and Rumi Darwaza, and ILDL's own photos of the avenue at dusk.

## What is lit

| Place | What the photos show | Model |
|---|---|---|
| Clock Tower | Amber light, brightest at the base. The balcony, clock stage and belfry stand out as bright bands, and the dials glow white. | Four washes from the plaza, plus uplights on the balcony, the clock stage and the belfry |
| Rumi Darwaza | The half-dome and its niches glow amber inside a paler cream frame. The wings' arcades are lit warm, with a lit kiosk on top. | An amber light inside the arch, a pale wash on the frame, warm uplights on the towers and wings, and the same on the east face |
| Chota Imambara | A warm white facade with the gilded dome glowing | The gateway from both sides, the hall front, the dome, the two Taj replicas, the mosque and the hammam |
| Bara Imambara and Asfi Mosque | A warm cream wash, darker toward the top | The outer and second gates, the Naubat Khana, the hall front and its corner towers, the mosque front and minarets |
| Satkhanda | Cool white, unlike the amber monuments around it | Three cool-white washes |
| Picture Gallery, Husainabad gateways | Warm washes | Warm washes |
| Avenue | A row of granite pedestals with two bronze arms of unequal height. The taller arm reaches over the road and the shorter over the footpath, each ending in a perforated lantern. They are lit warm white. | The avenue lamp: 17 along the park side, from the park to the food court junction |
| Clock Tower park | Many bright, cool-white LED lamps | The park's high masts and double lamps are lit cool white |
| Shops | Shopfronts lit with tube lights, spilling onto the footpath | A lit band on the pavement in front of every shop |

## How it works

- **Lamp light.** A top-down light map, 2048 × 1024 (half that at Low quality), has a pool for every lamp, a band in front of every shop and a small patch at every floodlight fixture. Every lit surface below about 10 m takes light from it in proportion to its own colour. That includes paving, walls, trees, people and vehicles. It replaces the old flat glow decals.
- **Floodlights.** There are 75 floodlights in 30 clusters, each one a spot with a range and a beam angle.
  - The lights and the monuments never move, so each floodlit vertex has its light worked out once.
  - Large triangles are split only where the light would not interpolate smoothly between their corners, which adds about 0.3 million vertices.
  - The result is stored in a 4-byte attribute, and at night the shader just adds it.
  - The work runs a few meshes per frame after load, more at night, and pauses for the opening flight by day.
- **Earlier attempt.** Evaluating the floodlights per pixel was tried first. It cost about 7 ms a frame on an Intel HD 520 in a close-up of Rumi Darwaza.

## Cost

These were measured on the Intel HD 520 at 1024 × 700, at night with all lights on, and compared with the same view with the night lights switched off.

| View | Lights on | Lights off |
|---|---|---|
| Clock Tower | 13.8 ms | 13.8 ms |
| Rumi Darwaza close-up | 16.8 ms | 16.6 ms |
| Avenue from above | 17.8 ms | 17.0 ms |

Setup adds about 0.15 s to loading. The background bake is about 1.2 s of work on that laptop, spread over the first seconds.

## Not covered

- **Fixture positions.** They are inferred from the light in photos, not surveyed. Light does not cast shadows: a floodlit face behind another building is still lit.
- **Muharram and festival lighting.** The strings of bulbs that outline the Chota Imambara are the existing *Festive illumination* option. Date-aware festival nights are a separate item.
- **Teele Wali Masjid.** It is part of the real scheme but is not in the model.
