# Owner-retained airline assets

v0.1.2 enables local display of all 24 existing PNGs under the owner's current asset policy. **Public redistribution permissions remain unverified.** Technical display enablement is separate from legal permission.

- Preserve original exact filenames and bytes. No image was deleted, renamed, moved, compressed or replaced.
- See [the asset audit](../../../docs/AIRLINE_ASSET_AUDIT.md) and [checksum inventory](../../../docs/AIRLINE_ASSET_INVENTORY.json) for provenance, unknown sources, shared-brand limitations and unverified rights.
- `src/data/localAirlineLogos.ts` defines operator/code identity, original uppercase filename and displayEnabled separately from redistributionPermission. Do not mark rights verified merely to enable display.
- The existing legal/reference records and source pages remain intact. No new image download is included.
- Build-time exact filename checks and image error handling provide fallback; external URLs, invalid operator mappings and disabled assets cannot become logo requests.
- All public-directory files remain directly accessible and copied into builds even if display is later disabled.
- The project's disclaimer, source-available rights position and third-party notices do not grant a copyright/trademark licence.
