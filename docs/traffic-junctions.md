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

## Not covered

- **The Khun Khun Ji Road arm.** It is one-way into the Clock Tower junction and gives way to two main-road approaches. At the busiest times its queue still waits two to three minutes.
- **The food court.** The map has the eastbound branch south of the westbound one, so the two streams must cross. At 8 pm the one-way road feeding it queues back past the next junction. This is capacity, not deadlock.
- **The east edge.** Where two one-way primary roads merge at the east edge of the map (about x 790), queues form at the busiest hours. It is out of the usual views.
- **East of Rumi Darwaza.** A tangle was seen once there, around (456, 271). It did not recur in 35 further simulated minutes.
- **Lanes inside junctions.** Junction paths are worked out for a typical car in its lane. Two wide vehicles can still brush in a tight corner.
