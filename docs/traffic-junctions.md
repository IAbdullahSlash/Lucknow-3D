# Evening junction jams

November 2026. On an ordinary evening the junctions by the Clock Tower and the food court used to jam. Dozens of vehicles stood for minutes, and at 6 pm the Clock Tower junction gridlocked. The fixes are in `src/traffic.js`.

## What was wrong

**The Clock Tower stand sat in the junction.** The tonga and auto stand had been put on a 40 m stretch between the Khun Khun Ji Road junction and the next corner.
- Its waiting line ran back into the junction.
- The stand across the road was 16 m past the junction, so carriages waiting there blocked the kerb lane out of it.
- Cars turning left would not leave the kerb lane to pass parked carriages.

**Vehicles left stands badly.**
- Tongas left only by U-turning, and on a busy evening the oncoming traffic never left a gap, so they stayed indefinitely.
- A bus pulling up to any stand stopped 1.8 m short of the spot it was aiming for and waited there for ever.
- A bus waiting at the food stand fills both lanes of its 9 m street. It would not pull out while a car stood behind it, and the car was waiting for the bus.

**A big junction stayed shut too long.** A vehicle held the three-node Clock Tower junction until it had driven right out of the far side. A hand cart at walking pace held every crossing movement for about 20 s.

**Waiting was counted in the wrong place.**
- A vehicle's waiting time grew while it was still back in a queue, or held up short of the line by something else.
- At the food court a whole platoon arrived with a long-wait licence and streamed through, while the front car on the other road waited a minute or more.
- At the Clock Tower junction a slow cycle stuck 12 m short of the line built up 200 s of waiting. Every other arm deferred to it, and only two vehicles a minute got through.

**Vehicles stopped inside junctions.**
- **Crowds.** A horse carriage stopped in the middle of the food court junction for the evening crowd crossing just beyond it, and shut the junction for minutes.
- **Facing each other.** Two vehicles nose to nose inside a junction, or a bus and a van passing on a narrow street, could each brake for the other indefinitely. Creeping a few centimetres kept resetting the tie-break.

## What changed

| | Now |
|---|---|
| Stands | A stand goes where its waiting line (three carriages, or three autos) fits on its own link, clear of the junction behind it and of the queue for the junction ahead. A vehicle drives on when a stand is full. The Clock Tower stand moved about 25 m west along the same road. |
| Leaving a stand | A carriage that finds no gap to U-turn within about 20 s drives on round the block instead. A bus counts as arrived within its own standing gap. A car standing behind a bus lets it pull out. |
| Passing parked vehicles | Drivers move out to pass a carriage or auto waiting at a stand, including one just round the corner, even when stopped at the end of a turn. Where a bus fills both lanes, they edge round it when nothing is coming. |
| Holding a junction | A vehicle stops blocking another movement once its tail is past the last point where their paths cross or merge. |
| Taking turns | Only the front vehicle in each lane takes part in who goes first. Waiting time counts only within 4 m of the line, and a vehicle standing well back from its line holds no one up. |
| Side streets | A main-road car standing in a queue lets in a side-street car that has waited 20 s. After 25 s a side-street car noses into a shorter gap. Coming out of a side street, it takes whichever lane ahead has room. |
| Don't block the box | A vehicle waits at its line, not in the junction, when people are crossing just beyond it. |
| Standoffs | Oncoming vehicles may pass closer on a narrow street. When two vehicles facing across each other have both crawled for 2.5 s, the one with right of way goes. |

## Results

These are headless runs of five simulated minutes each, before and after, on the same harness.

**Camera on the Clock Tower junction** (the original report):

| | Before | After |
|---|---|---|
| Vehicles stood still over 20 s, 6 pm (average) | 72 | 13 |
| The same, 8 pm | 24 | 16 |
| Longest single wait | 4–10 min | 1½–3½ min |

**Camera high over the whole heritage mile.** Here a vehicle stuck in view is not quietly removed after 45 s.

| | Before | After |
|---|---|---|
| Vehicles stood still over 20 s, 6 pm (average) | 20 | 15 |
| The same, 8 pm | 30 | 16 |
| Clock Tower junction, vehicles per minute | 6–16 | 14–20 |
| Food court, vehicles per minute | 12–20 | 18–23 |
| Longest single wait | up to 8 min | under 1½ min |
| Pairs of vehicles overlapping for 2 s or more, per run | 2–11 | 1–8 |

- **Muharram.** The closure still works: no vehicle entered the procession.
- **Crowds.** Crowds were unaffected, with one group stuck at 9 pm.
- **Cost.** Traffic costs about 1.2 ms a frame on an Intel HD 520, as before.

## Second pass (28 November)

The first pass left the Khun Khun Ji Road arm queueing for two to three minutes, and a slow merge at the east edge.

**Why the arm queued.**
- **Junction claims held too long.** A main-road vehicle claimed the Clock Tower junction about 13 m before its line and blocked the side road until it had passed. A side-street car crossing to the eastbound side needs about 5 s from rest, and with both main-road streams claiming in turn there was almost never a moment with no claim.
- **Detours fed it.** Seven in ten trips were sent past a random point on the heritage road, and with no U-turns the way back from a point behind them was round the one-way Khun Khun Ji Road and through the junction.

| | Now |
|---|---|
| Judging the gap | A side-street vehicle goes if it can be through the shared space before a main-road vehicle gets there, with a 1.2 s margin. After 20 s at the line it noses into a shorter gap, if the one coming has room to slow. |
| Zip merging | Into the same lane, a vehicle may follow one that is moving, so long as that one's tail is past the merge before its own nose gets there. |
| Heritage-road calls | The call is made only when it is on the way: no more than 40% plus 100 m longer than the direct route. The heritage road stays as busy as before. |
| Avoiding queues | New trips count about 12 m of extra distance for each vehicle standing on a road, so they spread round a queue. |
| People and drivers | People crossing let a driver who has waited just short of their crossing for 4 s go first. A stream of people kept one car standing for 7 minutes, and because it held the junction, the whole junction stopped. |
| A held-up go | A vehicle given the go but stalled for 3 s before entering gives it back and looks again before moving. Others may pass it meanwhile. |
| Overlaps | A vehicle never brakes for one going its way whose middle is behind its own. Two bikes overlapping each braked for the other for 17 minutes. |

**Results.** These compare the first-pass commit (`7685de8`) with now: three pairs of five-minute runs, before → after.

| | 6 pm | 8 pm |
|---|---|---|
| Vehicles stood still over 20 s, whole mile (average) | 10 → 5 | 18 → 6 |
| The same, Clock Tower view | 18 → 7 (6 pm and 8 pm together) | |
| Khun Khun Ji Road arm, vehicles queued (average) | 10 → 2½ (6 pm and 8 pm together) | |
| Its longest queue | 20 → 11 (6 pm and 8 pm together) | |

- **Throughput.** Vehicles per minute went up at the Clock Tower junction (14–21 → 15–22), the food court (14–21 → 18–21) and the east-edge merge (8–13 → 14–20).
- **Overlaps.** Pairs overlapping for 2 s or more fell from 3–5 to 1–3 per run.
- **Unchanged.** The heritage road carries as much traffic as before, the Muharram closure still keeps vehicles out of the procession, and crowds are unaffected.
- **Cost.** Traffic now costs about 1.5 ms a frame on an Intel HD 520, about 0.2 ms more.

## Third pass

The second pass left the food court backing up at peak, a rare 3½-minute wait, and traffic costing 0.2 ms more a frame.

**The food court was a scissors crossing, but not because of the map's layout.** The earlier notes said the map puts the eastbound branch south of the westbound one, so the two streams have to cross. That was wrong. The dual carriageway keeps left correctly. But the map joins both branches' centre lines to the single road's at one point, so each branch's inner lane crossed the centre line there. The two through streams then ran within 1.8 m of each other for 12 m and had to take turns. Seven places on the map have this shape.

**The rare long waits were the same backlog.** Buses and loaders at the front of the queue for the food court waited a minute and a half or more for room on the road ahead.

**The extra cost** came from new fields being added to vehicles while running. That changes the objects' internal shape and slows every property lookup, even in code that had not changed.

| | Now |
|---|---|
| Dual carriageway ends | Over the last 15 m before a single road, each branch moves over to its own side and its two lanes draw closer together (40% at the junction), so the outer lane stays on the road. This is skipped where the single road is too narrow for a lane each way. |
| Destinations | Trips that do not call at a stand prefer somewhere they can reach without a loop round the block. Heritage-road calls that would come back along the same road are refused. Those loops fed the Clock Tower junction. |
| Seeing a jam | Entering a road with about six or more vehicles standing on the next few, a driver plans again from there. |
| Courtesy | A main-road car that can still stop comfortably lets in a side-street car that has waited 20 s at the line. Before, only a car already standing in a queue did. |
| A held-up go | It is no longer given back once the vehicle is over its line. An auto that had rolled into the junction gave its go back and then waited for a car that was waiting for it. |
| Speed | Vehicle fields are declared when the vehicle is made. Junction caches use number keys, and each vehicle's place on its junction path is worked out once a frame. |

**Results.** These compare the second-pass commit (`69bb2a1`) with now: three runs before and five after, five minutes each.

| | Before | After |
|---|---|---|
| Vehicles stood still over 20 s, whole mile, 6 pm (average) | 6½ | 5 |
| The same, 8 pm | 10 | 4 |
| The same, Clock Tower view | 9 | 5 |
| Food court, vehicles per minute | 16–25 | 19–29 |
| Vehicles queued on the road into the food court from the east | 27–35 | 3–17 |
| Traffic, ms a frame (Intel HD 520) | 1.1–1.7 | 1.0–1.2 |

- **Cost.** Traffic now costs less than before any of this work: 0.99 ms against 1.08 ms at 8 pm for the first-pass code.
- **Unchanged.** The Muharram closure still keeps vehicles out of the procession, and crowds are unaffected.
- **Fewer vehicles standing on the heritage road.** With the queues gone, about 100 vehicles are on it at a time instead of about 125.

## Not covered

- **The Khun Khun Ji Road arm.** It now queues more than after the second pass: 6 vehicles on average instead of 3, sometimes 10–14. With the food court flowing, trips finish sooner and more of them run, and more westbound traffic reaches the Clock Tower junction. The side road's right turn has to cross that stream.
- **Rare long waits.** Two runs in ten had one vehicle wait 1¾–2½ minutes on the road into the food court from the east. Nothing waited over 80 s in a further 40 simulated minutes.
- **Lanes inside junctions.** Junction paths are worked out for a typical car in its lane. Two wide vehicles can still brush in a tight corner. Near a moved branch end, a bus in the outer lane can overhang the mapped road edge by up to half a metre.
