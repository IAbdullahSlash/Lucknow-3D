# Hussainabad Trust Road frontage survey

November 2026. The buildings along the heritage road had been generated: random widths, storeys, colours and invented shop names. This survey replaces them where Street View shows the real buildings clearly. The data is in `data/frontage.js`; `src/city.js` builds it.

## Method

- **Street View.** Panoramas were captured every 18 m along Hussainabad Trust Road, looking square onto the south side (all captured October 2025). Each panorama's position was converted to the model's road distance `s` (metres along `MAIN` from the west gateway). Positions along the road were read from the image with a 100° field of view. Adjacent panoramas agree within 2–3 m once the camera-to-shopfront distance is calibrated (about 15 m on the two-lane stretch).
- **Satellite and the map.** The same stretch was overlaid on Google zoom-20 imagery and the OpenStreetMap lanes. Plot depths stop at the next mapped lane: the back lane at s 287–359 leaves about 9 m. Where the map draws a lane wider than it is, the neighbouring plots give way to it.
- **What is recorded.** Each plot records its width along the road, storeys, wall colour (or bare brick), any shop board legible in Street View, and the awning colour. A low shop front with a taller block behind is recorded as two blocks. Unreadable boards are left blank rather than invented.
- **Shopfront line.** The shopfronts stand at the back of the model's 3.3 m footpath. On Street View the camera-to-kerb and camera-to-shutter distances put them about 20 m from a car in the eastbound lane. That matches the model's line. The satellite roof edges reach further out because the tin awnings cover the pavement.

## East gateway to Khun Khun Ji Road (s 190–419)

A continuous row of 55 frontages. Most are one-storey shops with tin awnings and bare-brick upper floors behind, broken by two- and three-storey houses. A low red-sandstone lattice screen runs along the kerb in short lengths between the shop doors.

| s (m) | What Street View shows |
|---|---|
| 190–212 | Single-storey shops in white and pale blue; roof boards for New King Shawarma and Orhan Shawarma House; Prince Trader's three-storey house with its roof board |
| 212–235 | Tin-roofed stores with brick floors behind; New King Shawarma; a two-storey brick house; Humdan Sweets & Namkeen under a red-and-white awning |
| 235–238 | The lane south |
| 238–276 | AB Cool Corner, Burger Bay (charcoal, three storeys), Roasties, Angel Mobile (tall, blue), Orhan Seekh Paratha (three-storey brick), Life Care Medicose, Golden Bakery, Biryani House |
| 276–302 | Raj Mobile & Electronics under Baker Box; Tunday Kababi with the tall Mulaqaat building behind; The Gulf Shawarma Point; Muzammil General Store |
| 302–321 | M.H. Diagnostics (pink, roof board), a yellow house, Pizza Cave (white, three storeys), Chai Bar, Aalam Biryani House |
| 321–325 | White arched gate over the lane, with two small minarets and the pair of fish of the Awadh crest |
| 325–347 | Green, white and blue narrow houses; Kamru Bike Repairing; Rolls & Shawarma; Raju Furniture's board on the brick floor above |
| 347–392 | Globe Cafe; Shamiyana Tent House (three storeys, glass front); Huzoor; Mehfil Cool Corner; Muradabadi Hyderabadi Biryani; Feel Fresh Cafe & Restaurant; Azhar Muradabadi Chicken Biryani; Pizza Hub |
| 392–419 | Turkish Cafe; Irani Dum Tea; Rajwadi Chai (roof board); a green house; Clock Cafe on the corner, with the octagonal domed sandstone kiosk on the pavement in front |

The Turkish Cafe moved 5.3 m east (to s 393.7). Two panoramas put its board beside Irani Dum Tea and Rajwadi Chai, east of the Google pin used before. The Globe Cafe stays where it was: its board reads about 2 m further east, within the error of the method.

## Further east

| s (m) | What Street View and the imagery show | Model |
|---|---|---|
| 445–507 | Municipal zonal office: a low yellow wall painted with murals, a gate, trees and a single-storey office | Mural wall, gate, trees and the office; the generated houses are gone |
| 507–655 | Fragrance Park and the open ground by the food court junction | Unchanged (already open) |
| 664–750 | Walled government campus: a grey three-storey block (OSM ways 1469979488–90) behind trees, a white single-storey office on the road, a cream wall with railings | Cream wall with railings, white office, grey three-storey blocks, trees |
| 750–758 | Nimbu Park road | — |
| 760–767 | A pink two-storey house | Added |
| 768–842 | Nimbu Park behind a long red-sandstone lattice wall | Lattice wall and trees |

On the north side opposite Nimbu Park, the Pata Nala sewage pumping station grounds (OSM `man_made=wastewater_plant`) are trees on the imagery. The model now keeps houses out and plants trees there.

## Not covered

- The north side of the road from the east gateway to the food court is the Clock Tower park and plaza, already modelled.
- Street View cannot see the backs of the plots, so the blocks behind the row are still generated.
- The road's centre line between s 290 and 380 sits about 4 m south of the current OpenStreetMap line. The shopfronts follow Street View, so the road itself was left alone.
