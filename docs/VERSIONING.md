# Project versioning and release commit policy

Effective from the owner-approved **v0.1.4** release. This is a custom project convention, **not strict SemVer**.

## Version format

`vMAJOR.MINOR.PATCH[letter]`

| Component                 | Project meaning                | Rule / example                                                                                                                                                 |
| ------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR                     | Release stage                  | `0` prototype/pre-production; `1` official production. Moving to production requires explicit owner approval. Completed features alone never authorize v1.0.0. |
| MINOR                     | Larger feature iteration       | Increment for a larger release, resetting PATCH to zero: v0.1.4 → v0.2.0.                                                                                      |
| PATCH                     | Smaller functional enhancement | Increment for a smaller release: v0.1.1 → v0.1.2 → v0.1.3 → v0.1.4.                                                                                            |
| Optional lowercase letter | Extremely small sequential fix | v0.1.1 → v0.1.1a → v0.1.1b. These are project-defined sequential identifiers, not SemVer prereleases.                                                          |

Numeric components have no single-digit limit. **v1.10.22**, **v1.20.199** and **v1.20.199b** are valid. Do not invent an arbitrary maximum. If suffix sequencing needs to go beyond the owner's examples, propose the next identifier for approval.

Before future work, propose a version based on scope and obtain the owner's agreed release version. Never silently change an agreed version. Tiny cosmetic/typo fixes normally use a suffix instead of a new numeric release unless the owner directs otherwise.

Some tools require strict SemVer. A suffix project release must document any necessary package/tool encoding separately and obtain agreement; never silently rename the owner's release. The numeric v0.1.4 package version is `0.1.4`.

## Release commit convention

Use a descriptive English title beginning with the agreed version:

```text
vX.Y.Z - Descriptive English Title
vX.Y.Za - Descriptive English Title
```

Examples:

- `v0.1.2 - Added Aircraft Details, Batch Duty Roster and HK Clock`
- `v0.1.3 - Improved Airline Catalogue and Scrolling Performance`
- `v0.2.0 - Introduced Major Logbook Enhancements`
- `v1.0.0 - Initial Production Release`

Do not prefix release titles with `feat:` or `fix:`. This policy applies to future release commits and suggestions; do not rewrite historical commit titles.

Retain a detailed English body: short release summary, delivered features, bugs fixed, UX improvements, data compatibility and actual test/verification results. Omit claims about unfinished work. Scale detail to the release while keeping meaningful technical information.

The agreed v0.1.4 title is (this does not authorize executing a commit):

```text
v0.1.4 - Enhanced Airline Selection, Demo Records and Dashboard UX
```

## Authorization and verification

Version agreement does not itself authorize commits, pushes, deployment, visibility changes or history rewriting. Follow the active owner's request. The original v0.1.4 task authorized a local release commit, but the subsequent **interrupted implementation recovery request supersedes that authorization**: complete verification, report readiness, then **wait for explicit owner approval before committing or pushing**. Preserve the independently committed v0.1.3 baseline and existing staged/unstaged work; do not amend or rewrite history.

Before a release commit, verify path/branch/history and review intended staged changes. Exclude secrets, workplace information, browser profiles and generated artifacts. Run tests, lint, build, formatting and npm audit; fix failures and describe unresolved verification limits accurately. Preserve the opening independent-project disclaimer, source-available/non-open-source position and unresolved third-party logo permissions.
