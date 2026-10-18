# v0.3.0 full JSON backup and restore

Local only; no upload, authentication, remote sync or encryption. Full files contain sensitive/hidden fields. Keep them private. Privacy-reviewed JSON/CSV and printed PDF remain separate reports, not restorable databases.

## Envelope version 1

```json
{
  "appId": "turnaround-coordinator-logbook",
  "backupFormatVersion": 1,
  "exportedAt": "2026-10-18T00:00:00.000Z",
  "storageSchemaVersion": 1,
  "data": {
    "version": 1,
    "duties": [],
    "aircraft": [],
    "journals": [],
    "settings": {
      "language": "en",
      "privacy": {
        "registration": true,
        "flights": true,
        "bay": true,
        "gateTimes": true,
        "statuses": true,
        "disruptionNotes": true
      }
    }
  }
}
```

Export includes complete supported Aircraft/Duty/Journal objects, disruption records, revisions, ID links, optional model/duration fields, original-duty links, Trash and archived values, plus language and all six field preferences. No token or browser-profile metadata is included. Supported schema stays at 1: new fields are optional and no load-time migration runs. Legacy workState absence and combined/custom aircraft snapshots retain their meaning.

## v0.3.3 optional leave field

Duty may include optional leave: AL or SL. AL has blank start/end and no duty hours. SL requires Planned plus valid different start/end times, retaining the original planned shift and identity. Legacy objects without leave remain valid. Full backups preserve this field and relationships; envelope/storage versions remain 1. Restore a leave-containing backup with v0.3.3 or newer: older strict validators reject the unknown optional field. No automatic load-time transformation occurs.

## Workflow

1. Settings → Export Full Backup (JSON). Read the unencrypted-data notice and explicitly download. This includes hidden values, unlike reports. Export validates data before creating a file; broken links require review rather than silently dropping content.
2. Settings → Import Backup (JSON). Choose a .json file, at most 5 MiB (UTF-8); empty/application-json/text-json/plain-text MIME types are accepted where browsers vary. PDF/OCR, arbitrary old raw databases and incomplete report JSON are not restore inputs.
3. Validation checks app/format/schema versions, allowed keys and field types, dates/times, enums, unique record and event IDs, and all Duty/originalDuty/Aircraft/Journal links. Prototype-related keys are rejected anywhere; JSON is never evaluated. Unknown historical competency strings are retained as plain text. Deep nesting beyond 32 levels, oversized strings and unrecognized fields are rejected.
4. Preview shows current and incoming counts, expandable complete ID/date lists for every collection and the supported-settings replacement warning. Nothing is persisted by choosing a file or previewing it. Export current data first if it needs to be retained.
5. Check the explicit replacement acknowledgement, then Confirm & Restore Backup. The complete candidate is revalidated in memory. Any in-app or persisted change since preview blocks stale confirmation. One atomic localStorage.setItem replaces the single database value; no removeItem/clear or partial writes. Quota/write errors leave existing stored data and the retryable preview intact. Repeated restoration is idempotent in content and does not generate new IDs.

Only **Restore / Replace** is provided. No partial merge, guessed dependencies or automatic import. Existing report exports show: "This file is a report export, not a full backup." Unsupported future formats are rejected. Existing local data loading remains separate and permissive; strict restore validation never silently rewrites it. Unknown unsupported legacy fields or orphaned links can block backup/restore and need manual correction; no values are invented to make a file pass.

## Limits

Unencrypted files are not authenticated/tamper-proof or employer-verified. User-authored free text may contain sensitive content and must be reviewed. Same-origin localStorage remains device/browser-specific; localhost and LAN IP are separate stores. Restore is an explicit way to transfer a complete supported collection, not live synchronization. A separate full backup file is the recovery path after an intentionally confirmed replacement. Multi-tab conflict checks reduce stale restores but are not a transaction protocol across concurrently writing tabs; avoid simultaneous edits during restore. Browser download behavior and physical iPhone file-picker acceptance require device testing.
