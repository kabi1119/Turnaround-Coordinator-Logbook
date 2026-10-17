# Owner-defined airline catalogue — current v0.3.2

This is the owner's requested default selection, **not a verified or exhaustive HAS handling customer list**. The single source is src/data/airlineCatalogue.ts; registry, search, local PNG mappings and reference exports derive from it. No current airline operational relationship is inferred.

| IATA | Default name                  | Existing PNG |
| ---- | ----------------------------- | ------------ |
| 7C   | Jeju Air                      | 7C.png       |
| 9G   | Sun PhuQuoc Airways           | 9G.png       |
| AK   | AirAsia Malaysia              | AK.png       |
| BI   | Royal Brunei Airlines         | BI.png       |
| CX   | Cathay Pacific                | CX.png       |
| D7   | AirAsia X                     | D7.png       |
| DL   | Delta Air Lines               | DL.png       |
| FJ   | Fiji Airways                  | FJ.png       |
| GK   | Jetstar Japan                 | GK.png       |
| JL   | Japan Airlines                | JL.png       |
| JX   | STARLUX Airlines              | JX.png       |
| KE   | Korean Air                    | KE.png       |
| LD   | Air Hong Kong                 | LD.png       |
| LH   | Lufthansa                     | LH.png       |
| LX   | SWISS International Air Lines | LX.png       |
| MS   | Egyptair                      | MS.png       |
| PG   | Bangkok Airways               | PG.png       |
| PX   | Air Niugini                   | PX.png       |
| QR   | Qatar Airways                 | QR.png       |
| QZ   | Indonesia AirAsia             | QZ.png       |
| RJ   | Royal Jordanian               | RJ.png       |
| S7   | S7 Airlines                   | S7.png       |
| UO   | HK Express                    | UO.png       |
| Z2   | Philippines AirAsia           | Z2.png       |

NH / ANA, SQ, HX and EK are excluded only from default suggestions and fresh synthetic samples. Historical references retain their original identity/provenance records, and findAirline still resolves them for old record display. Free manual entry remains possible. LD is Air Hong Kong, HX is Hong Kong Airlines and UO is HK Express; they are never merged. AK/QZ/Z2 and GK retain operator identities independently of shared artwork. Original aliases such as AirAsia (Malaysia), SWISS and Lufthansa German Airlines remain readable.

New owner-defined entries have no invented verification date or official identity source; the catalogue document is their scope reference. Original nine reference records and rights evidence remain in historicalAirlineReferences. Every legal permission remains unverified/not-established. No third-party permission is inferred from display or membership.

## Current sample collection (introduced v0.2.0)

All 24 selectable identities and PNG mappings remain. The fresh collection now uses four fictional assignments (CX, UO, LD and QR), three duties and two journals; it is not a one-record-per-airline showcase or a limit on user records. Settings → Refresh sample records uses src/data/sampleRefresh.ts to preview and replace only complete, unchanged recognized fixtures, preserving unrelated personal data and blocking edited samples or retained personal links. No automatic refresh runs. See [v0.2.0 acceptance](V0_2_0_ACCEPTANCE.md) for compatibility and executed checks.

## Historical reviewed v0.1.4 dataset refresh

Fresh seedDatabase creates exactly one assignment per identity on 24 distinct fixed Hong Kong dates; all 24 are Confirmed. It retains the six historical Duty and three Journal payloads/IDs, adds nineteen date-specific demo duties and preserves a two-shift date and overnight example. Flights, registrations, bays and notes are explicitly synthetic. Type examples are illustrations, not live fleet assertions or HAS customer claims. All nine role/handling combinations are covered; derived totals are 24 Logged, 18 Handled and 9 Primary.

No automatic migration runs. Settings → Refresh obsolete demo airlines previews full scenario replacements, generated rows and dates, new duty/journal counts, retained Journal references and replaced/generated disruption counts. Confirmation keeps Aircraft IDs and existing Journal references, but replaces eligible scenario content (including airline/date/Duty). All existing duties/journals and unrelated aircraft remain unchanged. Missing required demo duties/journals are previewed before insertion. A second refresh creates no duplicate rows/events.

Only full recursive equality to frozen v0.1.1–v0.1.3 fixtures permits replacement, never ID/DEMO labels alone. Edited/deleted-field/unknown payloads occupying a required ID, duplicate target IDs or different-date/trashed required duties block the entire refresh. A database change since preview also blocks confirmation. Unknown custom IDs remain untouched, including out-of-catalogue names. Therefore an ambiguous legacy collection may require owner review and is not falsely reported as cleaned. The exact unchanged v0.1.4 demo subset is labeled separately from overall statistics.

legacySeed.ts, v014Seed.ts and older refresh helpers remain compatibility fixtures; the v0.2.0 UI uses sampleRefresh.ts. Do not use full sample-load/clear actions on a mixed collection: those separately confirmed actions replace the entire collection.

## v0.3.1 selection order

Default new/edit entry lists use one shared non-mutating orderAirlines helper: CX, UO, LD, then the other 21 names sorted A–Z in English. Active name/code/alias queries filter first and sort only relevant matches alphabetically, without priority pinning. No identity, saved airline value, asset mapping or legal metadata changes. See V0_3_1_ACCEPTANCE.md for regression/manual acceptance.

## Logo presentation

AirlineLogo now measures the **currently loaded file** with a detached offscreen canvas (src/lib/normalizeLogo.ts), rather than using potentially stale src/data/logoBounds.ts fixtures. The latter remain historical compatibility data, not runtime layout inputs. Scan every nonzero alpha pixel; an opaque white-canvas file additionally uses a conservative light-background pass only when all four corners are opaque near-white and the alpha rectangle covers the canvas. This matters for the current QR, CX and LD PNGs: alpha alone sees their entire white square. The source bitmap is never edited. White artwork inside the detected rectangle remains intact. A two-source-pixel protective margin plus frame breathing room guards antialiasing.

The fixed outer frame contains a centered inner wrapper whose aspect ratio matches measured visible content. Fit its width/height proportionally, then position the original full-canvas image using the inverse bounds ratios. Never stretch axes independently, crop artwork, change frame sizes, or generate replacement raster assets. Classification uses visible aspect: wide wordmark (ratio ≥2), tall/narrow (<0.8), otherwise emblem; each has bounded target fills. src/data/airlineLogoRendering.ts holds display-only overrides (QR wide fill, PX emblem height); BI/LH/RJ currently use automatic fitting after visual review. Future outliers can opt out of white-background trimming or tune fills without changing identity or rights. This white-canvas heuristic is intentionally conservative, not arbitrary-background segmentation.

Only small bounds metadata is cached per loaded URL/natural size/trim policy in the current module session. No pixel arrays or browser data are retained; canvas backing storage is released. Reloading remeasures replaced local files, including same-dimension replacements. Canvas failure keeps ordinary object-fit: contain rendering; image load failure retains the code badge. Fixed frames do not resize during measurement or fallback. Cards, details, compact ranking/list frames, selected combobox preview and all dropdown options reuse this one component.

Follow-up began on v0.3.1a / 8985911 with an existing unstaged owner edit to QR.png. That input edit is preserved, not reverted or attributed to this rendering change. No new release number is assigned automatically. The earlier LH checkerboard observations and static QR bounds refer to historical assets.

Verification: all 24 actual PNGs were measured in isolated Edge; 288 size/theme/viewport frames showed centered proportional artwork within their unchanged frames. QR mobile medium visible width is about 90.2 px versus 41.8 px using the old rectangle. The initial normalization run had one integrity failure from stale QR inventory; the owner subsequently authorized v0.3.2 reconciliation. Current QR.png is **13,649 bytes**, **600×600**, SHA-256 **09fdc6d5411580700fd5384628d3dd59944665e622610dc4b5acfdb668f2ea6d**. Only its active bytes/sha256 inventory fields are updated; other 23 entries, all PNG files and all provenance/permission fields are preserved. This resolves the inventory discrepancy without changing the existing asset integrity assertion or implying legal authorization. See PROTOTYPE_STATUS.md for final checks and browser limits.

No original bytes were modified or derivative raster generated. Unknown/missing/disabled/error images retain the code fallback. See AIRLINE_ASSET_AUDIT.md and AIRLINE_ASSET_INVENTORY.json for immutable checksums and unchanged unresolved redistribution rights.
