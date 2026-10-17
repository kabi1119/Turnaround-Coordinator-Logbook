# Owner-defined airline catalogue — current v0.1.4

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

## Reviewed v0.1.4 dataset refresh

Fresh seedDatabase creates exactly one assignment per identity on 24 distinct fixed Hong Kong dates; all 24 are Confirmed. It retains the six historical Duty and three Journal payloads/IDs, adds nineteen date-specific demo duties and preserves a two-shift date and overnight example. Flights, registrations, bays and notes are explicitly synthetic. Type examples are illustrations, not live fleet assertions or HAS customer claims. All nine role/handling combinations are covered; derived totals are 24 Logged, 18 Handled and 9 Primary.

No automatic migration runs. Settings → Refresh obsolete demo airlines previews full scenario replacements, generated rows and dates, new duty/journal counts, retained Journal references and replaced/generated disruption counts. Confirmation keeps Aircraft IDs and existing Journal references, but replaces eligible scenario content (including airline/date/Duty). All existing duties/journals and unrelated aircraft remain unchanged. Missing required demo duties/journals are previewed before insertion. A second refresh creates no duplicate rows/events.

Only full recursive equality to frozen v0.1.1–v0.1.3 fixtures permits replacement, never ID/DEMO labels alone. Edited/deleted-field/unknown payloads occupying a required ID, duplicate target IDs or different-date/trashed required duties block the entire refresh. A database change since preview also blocks confirmation. Unknown custom IDs remain untouched, including out-of-catalogue names. Therefore an ambiguous legacy collection may require owner review and is not falsely reported as cleaned. The exact unchanged v0.1.4 demo subset is labeled separately from overall statistics.

legacySeed.ts and the old airline-only refresh helper remain compatibility fixtures; the current UI uses demoDatasetRefresh.ts. Do not use Seed/Reset on a mixed collection: those pre-existing confirmed actions replace the entire collection.

## Logo presentation

src/data/logoBounds.ts records read-only measured, padded source bounds for the 24 PNGs. CSS applies uniform scale/position within responsive white frames, avoiding empty margins while retaining all artwork. A six-source-pixel measurement pad protects edges; representative CX/UO/LH/LD/JL/QR were visually checked. Source dimensions and aspect ratio remain unchanged. LH's baked checkerboard is still present, not falsely described as transparency.

No original bytes were modified or derivative raster generated. Unknown/missing/disabled/error images retain the code fallback. See AIRLINE_ASSET_AUDIT.md and AIRLINE_ASSET_INVENTORY.json for immutable checksums and unchanged unresolved redistribution rights.
