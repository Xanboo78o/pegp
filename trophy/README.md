# PeGP round trophy

`pegp-trophy.stl` — the per-round winner's trophy. Small on purpose (55 mm tall,
~15 g of filament). The Championship Cup is a separate, bigger, Director-designed
thing — this is NOT it.

## Print

- Upright, as-is. 0.2 mm layers, 15% infill.
- Supports: **only under the handles** (paint-on supports there; the cup itself needs none).
- The bowl is a real cavity — it holds exactly one podium's worth of candy.

## Paint

Gold. Obviously. (Spray or acrylic — prime first if spray.)

## Tweak

Edit the `PROFILE` table in `make_trophy.py` (radius, height pairs, in mm) and
re-run `python3 make_trophy.py`. `SEGS` = smoothness. The checker band and handle
sizes are the knobs near the bottom. Print at 130% for a double-points round.
