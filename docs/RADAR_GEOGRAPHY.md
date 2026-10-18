# v0.4.5 radar geography

## Data source and rights

Made with Natural Earth: [1:50m land](https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-land/) and [1:50m coastlines](https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-coastline-2/). Natural Earth's [terms](https://www.naturalearthdata.com/about/terms-of-use/) place its vector data in the public domain and allow modification and electronic redistribution. This applies to geographic data only, not the original app code, airline logos or other trademarks. Source-available project policy remains unchanged.

The actual coordinate files are pinned to the upstream Natural Earth repository at commit **ca96624a56bd078437bca8184e78163e5039ad19**. Resolution is 1:50 million; the commit identifies the downloaded edition without assuming a release version from a different website archive.

| Input                                                                                                                                                                | Original bytes | SHA-256                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------: | ---------------------------------------------------------------- |
| [ne_50m_land.geojson](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_50m_land.geojson)           |      1,636,166 | e874b27a51d146452be360cafb3cc50c86001074a67d534113e6534682f9826b |
| [ne_50m_coastline.geojson](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_50m_coastline.geojson) |      1,640,858 | 271f1c4c1908312bac6b29d158ea1356544beafc129f260005300913aa5ea283 |

## Projection and composition

The 600 × 600 logical viewport uses spherical Mercator with **one scale for both axes**. Geographic bounds: **75°E–150°E, 5°S–57.1539818°N**. The northern edge deliberately extends beyond the suggested 48–52°N to keep a square map, retain the requested longitude span, avoid stretching and keep the southern edge at 5°S. The western edge shows part of central/eastern India, not the whole country. Hokkaido/main Japan remain inside the eastern edge. Borneo, northern Sumatra and northern Indonesian islands remain near the bottom; Java and the full archipelago are not included.

For longitude λ and latitude φ in radians: projected x is proportional to λ, projected y to `log(tan(π/4 + φ/2))`. `src/lib/radarProjection.ts` derives the northern bound and every screen coordinate from these same equations. Mercator is conformal locally, but does not preserve area or distances across latitudes; decorative rings have no real nautical-mile scale.

HKG uses the owner-specified approximate **113.918°E, 22.308°N**, at **51.8907% across / approximately 62.8% down**. It is slightly below the geometric center rather than falsely repositioned on the coastline or stretching geography. The SVG point, circular disc, rings, hub, existing Plane icon and sweep share that exact anchor. Disc radius is the nearest canvas edge minus a margin, so every ring fits. `HKG / VHHH` is centered below the icon on a subtle dark backing, above the sweep, and remains English in both UI languages. The entire visualization remains decorative and noninteractive.

## Reproducible generation and size

The checked-in `src/data/radar-geography.json` contains **239 clipped polygon subpaths and 289 coastline segments**, rendered as just **two SVG paths**, plus the HKG dot. Land fill and coastline stroke are separate so clipped land polygon boundaries are not drawn as invented national borders/coasts. Islands and holes remain separate subpaths. Tiny features below display resolution may be omitted; this is not a navigational chart.

`scripts/generate-radar-map.mjs` verifies the pinned source SHA-256 values, projects/clips to the square and applies Douglas–Peucker simplification with a **0.45 logical-unit tolerance** (less than one screen pixel at the maximum 440px radar size), then rounds coordinates to 0.1 units. Source metadata and the projection bounds travel with the generated data. The regional path/metadata content is approximately **72KB before compression**; no full-world source is included in the app. The initial JavaScript gzip increase is approximately **28KB** over v0.4.4.

To regenerate intentionally, use Node 24 from the repository root:

```powershell
node scripts/generate-radar-map.mjs
npm.cmd run test
npm.cmd run build
```

The maintenance script uses ignored `.checkpoints/ne_50m_land.geojson` and `ne_50m_coastline.geojson` caches when available; otherwise it downloads the pinned originals and validates their hashes. It is **not** called by dev, build, deploy or application startup. Normal application builds and the rendered map make **no map network request**. A changed input checksum fails explicitly. No GIS library, map API, tile service or new package dependency is added.

## Rendering and motion

`src/styles/v0_4_5.css` makes only the radar canvas 1:1, with existing rounded corners and a 440px desktop / 380px small-layout maximum. Grid column width still constrains the size; there are no device-specific heights or changes to neighboring cards. Geography covers the full square, while the existing circular radar layers remain independently positioned at HKG.

The original **six-second CSS transform sweep** is retained. No per-frame geometry projection, React update, Canvas redraw or JavaScript animation loop is added. Hidden documents and inactive Home pause; mobile/coarse dialogs pause; eligible desktop fine-pointer dialogs retain the prior running behavior. Reduced motion and print retain a static sweep. The marker and label remain visible in every motion state. No new blur/filter work is introduced.

## Hosting/data boundary

No changes to `wrangler.jsonc`, Worker `app`, assets `./dist`, SPA fallback, CSP or branch workflow. Vite bundles the local geometry with the frontend. No database/schema/key/ID/relationship/fixture/privacy/lifecycle/statistics/backup changes. No airline assets or existing provenance records are modified. See [acceptance evidence](V0_4_5_ACCEPTANCE.md).
