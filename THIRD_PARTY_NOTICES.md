# Third-party notices

These notices apply only to the identified third-party software. They do not grant a licence to the original TCO Logbook source code or to airline logos, trademarks or other brand assets. Original project rights are reserved as explained in README.md.

## Runtime software

Versions recorded during v0.1.1 preparation: React 19.3.1, React DOM 19.3.1, Scheduler 0.28.0 (MIT); Lucide React 0.468.0 (ISC, with Feather MIT portions). Exact resolved versions remain in package-lock.json; reconcile these notices when dependencies change.

### React / React DOM / Scheduler - MIT

The three installed packages carry the same notice, reproduced here without modification.

```text
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Lucide React - ISC

Reproduced from the installed package LICENSE.

```text
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### Feather portions - MIT

Lucide identifies Cole Bemis / Feather portions as MIT. The corresponding notice is retained below. See https://lucide.dev/license and https://github.com/feathericons/feather/blob/main/LICENSE .

```text
MIT License

Copyright (c) 2013-2022 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Development dependencies

Vite, Vitest, TypeScript, ESLint, Prettier, testing tools and their transitive dependencies retain their own licences and copyright notices. They are development tools, not relicensed TCO Logbook code. Consult each installed package LICENSE/NOTICE and the lockfile metadata before redistributing dependency source or tool binaries; this runtime notice is not an exhaustive development-dependency licence bundle. No font files are bundled.

## Airline branding

All airline names, trademarks, logos and other brand assets remain the property of their respective rights holders. No compatible public redistribution permission has been independently established for the 24 owner-retained PNGs. The owner intends to retain them; that decision and the project disclaimer do not establish a licence. See docs/AIRLINE_ASSET_AUDIT.md and docs/AIRLINE_ASSET_INVENTORY.json for source limits and per-file records.

## Distribution

The Vite build emits a copy of this file as THIRD_PARTY_NOTICES.txt alongside the frontend. Retain applicable notices with redistributed software. Copying this notice does not clear unresolved brand-asset permissions.

## Geographic data — Natural Earth (v0.4.5)

Made with Natural Earth. The radar derives regional land/coastline vectors from Natural Earth 1:50m data, which its authors place in the public domain, including modification and electronic redistribution. Source commit, SHA-256 values, projection and simplification are recorded in docs/RADAR_GEOGRAPHY.md. Terms: https://www.naturalearthdata.com/about/terms-of-use/. This public-domain status applies only to that geographic data; it does not authorize original project code or any airline branding.
