# Street shops and lighting in ASTRA 6.2

Select a shop's name tag in the scene to open Tunday Kababi, Globe Cafe 24x7, Turkish Cafe & Food Junction, Kebabchi Lucknow, Irani Chai, Irani Dum Tea, Irani Fast Food, Chai Mahal or Kamar Sheermal Shop. Places lists the landmarks only. Each shop has a street view, a counter view and a walking arrival, and the text fallback carries the same storefront descriptions.

## Storefronts rebuilt from photos

The first passes drew these shops without references or at the wrong spots. They are now modelled from public photos and listings, recorded with what each source established in [Street shop references](shop-references.md).

- **Tunday Kababi** is its Clock Tower outlet, at the mapped position on the south-east corner of the Talab: a single-storey glass-fronted dining pavilion under a long charcoal fascia with the TK emblem, branch list and "Since 1905", beside a peach heritage pavilion. It stays open until 2 AM.
- **Globe Cafe 24x7** and **Turkish Cafe & Food Junction** stand on the row opposite the Ghanta Ghar at their Google Maps pins. Globe has a black fascia with lit letters, a menu strip, a white interior, a red fridge and a tea counter, and stays open all night. Turkish Cafe has a charcoal fascia, a printed counter cart, a four-colour umbrella and a red jali screen.
- **Kebabchi Lucknow** stands at the listed address, opposite the Chota Imambara gate. Its white backlit fascia and orange K roundel sit over arched openings and a seekh grill.
- **Irani Dum Tea**, **Irani Fast Food** and **Irani Chai** use the black flex boards of the Chota Imambara wall row. Irani Dum Tea has a black tarpaulin and bell-shaped dum pots on a sooty hearth. Irani Chai has yellow lettering, a "Sulemani Chai" board, a red fridge and stacked kulhads.
- **Husainabad Food Court** is rebuilt on its OpenStreetMap footprint as the two-storey red-brick hall it is, with a double-height glass corner facing the Clock Tower and lit parapet lettering. The **Lucknow Museum of Heritage and Arts** stands on its footprint behind a red jali wall. The kiosks round the Clock Tower now use the peach heritage style of the municipal food zone.

Each storefront draws its sign at full resolution with a matching glow map, so lettering lights up at night while the board stays dark. Interiors brighten while a shop is serving. Featured frontages reserve their plots before generic houses are placed. Arrivals, staff positions and customer loops were checked against the walking grid. [Shop models](../../src/shops.js) · [Catalogue](../../data/places.js)

## Map evidence and scene schedules

Chai Mahal uses the tea-shop point in the bundled OpenStreetMap extract, at approximately `26.87453°, 80.90671°`. Globe and Turkish Cafe follow their "opposite Ghanta Ghar" listings. Kebabchi follows its listed address and the bundled map point. The Irani shops are on the Chota Imambara wall row. Opening hours are illustrative except Globe's 24 hours and Irani Chai's midnight close. [Catalogue](../../data/places.js) · [Bundled map](../../data/map.js)

## Lucknow time and weather

Live time uses IST, including the solar date after local midnight. The presets use apparent sunrise, solar transit, a descending solar elevation of 6° for golden hour, civil dusk at −6°, and 22:00 IST for Night. The slider selects any minute. The directional light and sun disk share a direction while the sun casts shadows. Dusk has a cooler ambient gradient, with warmth concentrated toward the setting sun and the active counters. Clouds dim stars and direct sunlight. Monsoon rain roughens the water surface and changes the reflection from exposed paving. Individual counters ease between shutter, staff, customer, steam and optional sound states. [Solar calculation](../../src/solar.js) · [Weather and light](../../src/sky.js)

## Verification

- All six frontages retained their anchors across Low, Medium and High in Chromium. Their exact arrivals, pedestrian bypasses and customer loops cleared the collision grid. Both heritage legs measured 91.3 m and 609.1 m.
- Browser checks used keyboard selection from Places, a mouse click on the Tunday label and touch interaction in a 360 × 640 viewport. The shop cards showed Hindi and Urdu with right-to-left text where appropriate. With WebGL disabled, the localized text guide appeared. Retry recovered the scene after WebGL was restored.
- The solar test compared an equinox and both solstices with Astral 3.2 at the map origin. Apparent sunrise, solar transit, sunset and civil dusk agreed within a minute. Live mode advanced from 23:59 to 00:01 IST in two browser time zones. A resumed preset followed the updated date while a manually selected minute stayed fixed.
- The Tunday counter moved through evening rain, midnight and sunrise twice without retaining idle customers or steam. A separate browser test enabled street ambience, measured audible-range counter gain while it was serving and verified that it faded on closing and suspended when switched off.

## Rendering measurements

The comparison used Low, a 900 × 560 viewport, software WebGL and one ten-second sample per pass. The baseline was `14ab9e4`. The three heritage passes submitted fewer triangles in the updated scene. The evening tour drew more batches. The 13–29 frames per pass provide only a coarse frame-time comparison.

| Pass | Median frame interval, baseline → updated | Median draw calls, baseline → updated | Median triangles, baseline → updated |
| --- | --- | --- | --- |
| Midday Explore | 350 → 367 ms | 354 → 372 | 957,009 → 934,550 |
| Rumi Darwaza Walk | 483 → 467 ms | 369 → 371 | 1,096,076 → 1,071,457 |
| Evening monsoon Tour | 767 → 783 ms | 674 → 722 | 1,285,881 → 1,266,391 |
| Tunday counter at midday | 433 ms | 362 | 931,526 |
| Tunday counter at rainy dusk | 417 ms | 500 | 935,946 |

Use **Include shop passes** to repeat the fixed Tunday counter view at midday and in rain at civil dusk. Real phone and laptop frame-time and thermal checks still require those devices. [Benchmark page](../../tools/benchmark.html)
