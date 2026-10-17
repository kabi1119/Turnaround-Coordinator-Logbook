# v0.1.3 owner-defined airline catalogue

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

## Conservative legacy-demo refresh

Fresh seedDatabase uses only selected names from this catalogue, preserving 18 assignments, duty/journal IDs and all role/type/status scenarios. A historical eight-name fixture is used only to recognize the exact legacy payload.

No automatic migration runs. Settings offers a review with old → new airline, date and count. Full recursive content equality against a known legacy synthetic fixture is required, not just a predictable ID or DEMO prefix. Edited records, changed/deleted private fields, unknown properties, custom IDs and deleted records are skipped. Confirmation rechecks eligibility and changes only each approved airline field. Duty/Journal payloads, IDs, links, counts and all other Aircraft fields remain unchanged; no samples are inserted. Repeating refresh creates no duplicate and changes nothing further.

When an old sample cannot be reliably distinguished, leave it unchanged. Users can edit it normally. Do not use Seed/Reset to refresh a mixed collection: those pre-existing actions replace the dataset after confirmation and are separately labeled in Settings.

## Logo presentation

src/data/logoBounds.ts records read-only measured, padded source bounds for the 24 PNGs. CSS applies uniform scale/position within responsive white frames, avoiding empty margins while retaining all artwork. A six-source-pixel measurement pad protects edges; representative CX/UO/LH/LD/JL/QR were visually checked. Source dimensions and aspect ratio remain unchanged. LH's baked checkerboard is still present, not falsely described as transparency.

No original bytes were modified or derivative raster generated. Unknown/missing/disabled/error images retain the code fallback. See AIRLINE_ASSET_AUDIT.md and AIRLINE_ASSET_INVENTORY.json for immutable checksums and unchanged unresolved redistribution rights.
