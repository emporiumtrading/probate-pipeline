# Manual name feeds

Some counties publish probate notices only on sites that forbid automated reading. Their property records work, so leads can still be found if someone copies the names by hand.

1. Copy `TEMPLATE.csv` to `<market-id>.csv` (e.g. `al-jefferson.csv`, `ga-fulton.csv`, `wy-laramie.csv`, `co-denver.csv`, `nm-bernalillo.csv`).
2. Paste one row per estate from the county's Notice to Creditors listings (manual links are in `pipeline/sources-log.md`).
3. Commit. The next daily run matches the names to property owners and researches the confirmed ones.
