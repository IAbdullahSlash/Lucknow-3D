# Muharram and Eid

November 2026. Husainabad is the centre of Lucknow's Muharram observance, and the Asfi Mosque in the Bara Imambara is where the city's Shia congregation prays on Eid. The scene now shows both. The code is in `src/festival.js`.

## When

- **By date (the default).** The scene uses the arithmetic Hijri calendar for the Lucknow civil day. It matched six of the last eight Indian dates for 1 Muharram, Eid ul-Fitr and Eid ul-Adha (2023–2026) exactly, and the other two within a day. The moon sighting decides the real date.
- **Chosen.** **Options → Festival days** can show *1 Muharram* or *Eid* on any date, or switch festivals off.

| Days | What the scene shows |
|---|---|
| 1–10 Muharram | Mourning dress, black, green and red bunting, banners, sabeels, the Imambaras and Rumi Darwaza lit |
| 1 Muharram, 7 pm to midnight | The Shahi Zari procession, with the road closed to traffic |
| 1–3 Shawwal, 10–12 Zil Hijja | Larger crowds in white kurtas and new clothes, Eid Mubarak banners, lights at night |
| 1 Shawwal and 10 Zil Hijja, about 9:40 am to 12:15 pm | The congregation at the Asfi Mosque |

## The Shahi Zari procession

Muhammad Ali Shah began the procession in 1837. It goes from the Bara Imambara to the Chota Imambara on the evening of 1 Muharram. Sources: Hindustan Times, 27 June 2025; Times of India on the 2026 zari; live streams of the 2026 procession.

**Order of march.** These are the elements Hindustan Times lists, in its order:

| Element | Model |
|---|---|
| Members of the royal family | Six men in black sherwanis and white churidars |
| Shehnai players | Six men in white |
| An elephant and camels | An elephant in a black caparison with a gold hem and a mahout; three camels in red cloths |
| Children with coloured flags | 24 children with black, green and red flags |
| A band playing elegies | Twelve players in maroon |
| Alams | Six standards with the panja on top and long green, black or red drapes, among mourners |
| Sozkhwans | Fifteen reciters in black |
| Duldul | A white horse under a white cloth stained red |
| Ali Asghar's cradle | A green and gold cradle carried by four men |
| Shahi Mom ki Zarih and Abraq ki Zarih | The wax zarih in ivory and the mica zarih in silver, each carried by six men |
| The Shahi Zari | 22 feet (6.7 m) high in 2026, of bamboo, paper, wax and mirrors. Modelled with a platform, a grilled enclosure, corner minarets, an octagonal tier with mirror bands, a dome, a crown and the chand-taara, on a trolley, with lights |
| Anjumans | Three groups of about a hundred mourners in black, each behind a *Ya Hussain* banner, beating their chests in time |

- **Lamps.** Gas lamps carried on the head run down both sides of the column.
- **Size and pace.** There are about 450 figures in a column 180 m long. The head leaves the Bara Imambara's outer gate at 7 pm and reaches the Chota Imambara's gate at 10:30 pm. The column halts for noha about every four minutes, and the tail is in by midnight.
- **Route.** From the outer gate west along Hussainabad Trust Road. Through Rumi Darwaza itself, which vehicles now go round. Through the east Husainabad gateway, and in at the Chota Imambara's gate. The column narrows to pass the arches.
- **Traffic.** The road between the two Imambaras is closed while the procession is out, from half an hour before it starts. New trips route round the closure, and vehicles on the closed road leave once out of sight. Those in view stop for the procession, and a vehicle caught inside the column (when the clock jumps) leaves at once.

## Muharram dressing

- **Dress.** About four in five adults wear black, and some children do.
- **Bunting.** The bunting across the road turns black, green and red.
- **Banners.** *Labbaik Ya Hussain* hangs on the Bara and Chota Imambara gates, both Husainabad gateways and inside Rumi Darwaza's arch.
- **Sabeels.** Nine sabeels stand on the footpaths: steel water drums, glasses, a black canopy and a *Sabeel-e-Hussain* board, each with two men serving.
- **Lights.** The festive bulb outlines on the Imambaras and Rumi Darwaza come on at night.

## Eid at the Asfi Mosque

- **Prayer time.** The Shia Eid prayer is at the Asfi Mosque at 11 am (Lucknow announcements for Eid ul-Fitr).
- **The congregation.** About 2,000 worshippers stand in 22 rows on the mosque's platform, on red, green and white durries, facing the mosque and so the qibla.
- **Timeline.** The rows fill from the front from about 9:40. The prayer starts at 11:00: two rak'at in unison (standing, bowing, prostrating, sitting), then the sermon. The rows empty between 11:40 and 12:15.
- **People nearby.** People idling on the platform make way while the rows are there.
- **The rest of the day.** Crowds are larger, men mostly in white or pastel kurtas, children in bright clothes, and *Eid Mubarak* banners hang on the gateways.
- **The real crowd.** Tens of thousands attend in reality, filling the whole complex. Only the mosque platform is filled here.

## Cost

These were measured on an Intel HD 520 at 1024 × 700.

| View | With the festival | Same view, festival off |
|---|---|---|
| The procession, from above | 14.7 ms | 14.5 ms |
| The full congregation at the Asfi Mosque | 32.7 ms | 28.9 ms |

- **Procession script cost.** The procession's per-frame update costs about 0.6 ms of script.
- **Congregation cost.** It adds about 210,000 triangles, at about 100 per worshipper with no shadows. It is skipped when the mosque is out of view.
- **Loading.** Everything is built the first time a festival needs it, so ordinary days load as before.

## Not covered

- Other processions: the Ashura procession to Karbala Talkatora, Chehlum, and the Chup Tazia do not pass through this part of the map.
- Majlis gatherings inside the Imambaras, and women watching from the roadside in large numbers.
- The figures are generic, and the zarihs are built from descriptions and photos, not measured.
- The rows at the Asfi Mosque do not spill into the rest of the Bara Imambara as they do in reality.
