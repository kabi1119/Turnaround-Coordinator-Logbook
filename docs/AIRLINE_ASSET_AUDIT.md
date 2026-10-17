# Airline asset audit — v0.1.2 local display integration

Reviewed: **2026-10-17 (Asia/Hong_Kong)**. Owner request: preserve all existing PNG files for the intended public source-available portfolio release. This decision supersedes the earlier recommendation to exclude them; **it does not establish third-party permission**.

## Current inventory and permission status

**24 owner-retained PNGs with owner-enabled local display; 0 independently verified public redistribution permissions.** No existing image was deleted, renamed, moved, compressed or replaced. All 24 were visually reviewed using a temporary local contact sheet; its thumbnails are inspection aids, not replacement assets.

All files below are in `public/assets/airlines/`. Tracking status is the state observed during preparation, not a permanent assertion about future commits. Full original byte sizes, dimensions and SHA-256 checksums are in [AIRLINE_ASSET_INVENTORY.json](AIRLINE_ASSET_INVENTORY.json).

| IATA | Intended airline      | Filename | Known source page                                                               | Git status at v0.1.2 inspection | Redistribution permission |
| ---- | --------------------- | -------- | ------------------------------------------------------------------------------- | ------------------------------- | ------------------------- |
| 7C   | Jeju Air              | `7C.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| 9G   | Sun PhuQuoc Airways   | `9G.png` | [Owner-supplied page](https://cdnlogo.com/logo/sun-phuquoc-airways_158143.html) | Tracked                         | Unverified                |
| AK   | AirAsia (Malaysia)    | `AK.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| BI   | Royal Brunei Airlines | `BI.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| CX   | Cathay Pacific        | `CX.png` | [Owner-supplied page](https://seeklogo.com/vector-logo/510108/cathay-pacific)   | Tracked                         | Unverified                |
| D7   | AirAsia X             | `D7.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| DL   | Delta Air Lines       | `DL.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| FJ   | Fiji Airways          | `FJ.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| GK   | Jetstar Japan         | `GK.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| JL   | Japan Airlines        | `JL.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| JX   | STARLUX Airlines      | `JX.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| KE   | Korean Air            | `KE.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| LD   | Air Hong Kong         | `LD.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| LH   | Lufthansa             | `LH.png` | [Owner-supplied page](https://pluspng.com/logo/png-lufthansa-logo.html)         | Tracked                         | Unverified                |
| LX   | SWISS                 | `LX.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| MS   | Egyptair              | `MS.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| PG   | Bangkok Airways       | `PG.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| PX   | Air Niugini           | `PX.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| QR   | Qatar Airways         | `QR.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| QZ   | Indonesia AirAsia     | `QZ.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| RJ   | Royal Jordanian       | `RJ.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| S7   | S7 Airlines           | `S7.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| UO   | HK Express            | `UO.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |
| Z2   | Philippines AirAsia   | `Z2.png` | Source unknown; individual page not supplied                                    | Tracked                         | Unverified                |

For **every** entry: trademark/copyright ownership remains with the respective airline/brand rights holders; no compatible public-repository redistribution grant or licence evidence has been supplied. No entry is marked "Verified permission". "Unverified permission" means no grant was established; it does not assert that permission is impossible or that infringement has been legally determined.

## Provenance boundaries

The owner supplied these source pages:

- CX: [Seeklogo — Cathay Pacific](https://seeklogo.com/vector-logo/510108/cathay-pacific).
- LH: [PlusPNG — Lufthansa](https://pluspng.com/logo/png-lufthansa-logo.html).
- 9G: [CDNLogo — Sun PhuQuoc Airways](https://cdnlogo.com/logo/sun-phuquoc-airways_158143.html).

These are **owner-reported source pages**, not verified direct image-download URLs. The exact direct-download URL for every file is unknown. The owner reports that most other files came from Seeklogo, but no per-file association is established; those individual sources remain unknown. No download URL has been invented.

During preparation the CX page was readable; the LH and 9G pages could not be retrieved by the research tool. A readable page, "free download" label, public visibility, non-commercial intent or disclaimer does not establish rights-holder permission to redistribute. File hashes identify retained bytes, not their legal provenance. No new third-party logo was downloaded.

## Filename and identity checks

- Names are preserved exactly, including uppercase filenames. Linux/static-host paths are case-sensitive. The inventory uses the existing uppercase names; no runtime URL has been added for an unapproved image.
- CX is Cathay Pacific; LD / AHK is Air Hong Kong; HX is Hong Kong Airlines. HX is an app reference, with no HX image in this inventory.
- AK, QZ and Z2 are intended to identify AirAsia Malaysia, Indonesia AirAsia and Philippines AirAsia respectively. **All three files are byte-identical generic AirAsia wordmarks**, not individually verified operator-specific artwork. They were deliberately preserved without deduplication.
- GK is intended as Jetstar Japan, rather than JQ or the former 3K. Its image shows the shared Jetstar brand, not a Japan-specific identifier. [Jetstar's own conditions identify GK](https://www.jetstar.com/sg/en/conditions-of-carriage-gk).
- The owner's 9G mapping matches the Sun PhuQuoc Airways branding visible in the PNG. The [airline's own material uses 9G flight numbers](https://www.sunphuquocairways.com/gl/en/explore/offers/new-year-new-deals).
- [AirAsia's own conditions identify Philippines AirAsia as Z2](https://www.airasia.com/aa/about-us/zh/cn/terms-and-conditions-z2.html); its support material lists [AK, QZ, Z2 and D7 carrier codes](https://support.airasia.com/s/article/Philippines-AirAsia-Travel-Voucher-with-10-Top-up).
- All images visually match the intended brand family. This is not certification of current official artwork, ownership or every current IATA assignment. No code reassignment or new runtime airline entry was inferred from a filename alone.
- The LH image visibly includes a checkerboard background. No pixel or transparency correction was performed.
- PNG structure inspection found no EXIF chunks. KE.png contains one Software text entry identifying Adobe ImageReady; it contains no personal identifier. The other 23 PNGs contain no textual metadata chunks. No metadata was removed. This does not establish authenticity, safety of arbitrary future files, or licensing.

## Runtime display and build distribution are separate

The v0.1.2 owner request explicitly enables the retained local PNGs. `src/data/localAirlineLogos.ts` contains 24 display identities, aliases, exact filenames and displayEnabled flags. Its redistributionPermission remains unverified for every entry. The original nine-entry legal/reference registry keeps all prior sources and unverified permission evidence unchanged. No saved Aircraft snapshot is normalized or rewritten.

AirlineLogo resolves the reference identity or explicit local identity, validates the operator/name mapping, checks an exact build-time filesystem inventory and returns only same-origin `/assets/airlines/<IATA>.png` paths. External URLs, path traversal, invalid mappings, absent/disabled files and image errors fall back to a code/name. Case is preserved. There is no new third-party download or runtime external logo service.

The old approvedLogoPath helper remains a legal-approval check only; it does not enable display. No permission-unverified value was changed to approved, and enabled display is not evidence of legal authorization. AK/QZ/Z2 and GK retain the distinct identities documented above despite shared artwork.

The shared component appears in Aircraft cards/detail, Logbook, airline ranking bars and existing Aircraft editor previews. The white frame and object-fit: contain preserve supplied pixels/proportions in both themes.

**Vite copies all public files into dist whether rendered or not.** The original PNGs and third-party notices are retained. Build-time filename enumeration avoids duplicating the PNGs as imported hashed assets. The full original SHA-256 inventory remains the integrity baseline.

## Reference identity and handling affiliation

The existing nine references are CX, UO, HX, SQ, NH, EK, QR, LH and LD. Their identity references remain in the registry; the local display manifest adds explicit display identities without claiming new verified handling affiliations or rewriting saved Aircraft snapshots.

- [HKIA airline directory](https://www.hongkongairport.com/en/flights/airlines-information/airlines.page): limited airline name/code reference.
- [IATA Air Hong Kong entry](https://www.iata.org/en/about/members/airline-list/air-hong-kong/607/): LD / AHK.
- [HKIA passenger handling agent page](https://www.hongkongairport.com/tc/flights/airlines-information/ground-handling-agents.page): passenger-service context only.
- [HKIA terms](https://www.hongkongairport.com/en/terms-of-use.page): public display is not a redistribution grant.

**No ramp/TCO relationship is verified.** Neither registry nor inventory is a complete HKIA airline list or HAS customer list. Earlier official-site reviews established no reusable logo permission; owner-supplied download-site pages do not change those findings.

## Publication position

The owner's intention is to retain and eventually publish these files. Unresolved copyright/trademark permission remains a separate publication risk. Technical security checks, software-library licences and the README disclaimer do not resolve that risk.

Any later permission evidence must identify the actual file, rights holder, redistribution scope and permitted notices. Do not place private agreements or credentials in public assets. Update the inventory and approval record only from real evidence.
