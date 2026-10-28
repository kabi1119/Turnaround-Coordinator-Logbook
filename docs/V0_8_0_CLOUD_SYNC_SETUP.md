# v0.8.x encrypted Cloud Sync setup and acceptance

**Status: local implementation for owner acceptance. No hosted migration, account configuration, deployment or physical iPhone test was performed. SQL inspection/unit tests do not prove live RLS isolation. Complete disposable-database and real-device checks before enabling this release for other users.**

## v0.8.2 migration role ownership — 2026-10-28

The owner reported a hosted test-project failure in v0.8.0: `42501 must be able to SET ROLE "tco_sync_executor"`. The v0.8.1 prerequisite failure then correctly followed because the v0.8.0 transaction had not installed its tables. The earlier local migration tests ran DDL as a superuser; that model did not detect the hosted ownership restrictions. This release corrects both the SQL sources and the test model.

### Exact permission changes

Following [Supabase's temporary ownership-transfer pattern](https://supabase.com/kb/troubleshooting/cant-revoke-a-role-membership-granted-by-supabase_admin) and [PostgreSQL ALTER FUNCTION requirements](https://www.postgresql.org/docs/current/sql-alterfunction.html):

- The corrected v0.8.0 source grants schema CREATE and a **postgres-issued** executor membership with `ADMIN FALSE, INHERIT FALSE, SET TRUE` only within the transaction. It transfers RPC ownership, performs their ACL changes while explicitly acting as the restricted owner, returns to postgres, revokes only the postgres-issued membership, and revokes CREATE before commit.
- The corrected v0.8.1 source builds its private invoker helper/policies as postgres. It temporarily grants public-schema CREATE and the same non-inheriting SET membership, uses `SET LOCAL ROLE tco_sync_executor` for existing RPC replacement and ACLs, then returns to postgres and removes both temporary grants. Helper and RPC encryption/authorization bodies are unchanged.
- Both sources assert cleanup before commit. Errors roll back role grants, function definitions and ACLs together. Executor remains NOLOGIN, NOINHERIT, NOBYPASSRLS; no gateway role receives membership and no Auth schema usage is granted. The unsupported v0.8.0 Auth grant is removed.
- Supabase/PostgreSQL may retain a bootstrap-granted **ADMIN-only** membership for the role creator. `admin_option=true, inherit_option=false, set_option=false` is expected and is not unrestricted execution access. Do not try to revoke a membership granted by `supabase_admin` from postgres. The temporary grant uses `GRANTED BY postgres`, and cleanup revokes that exact grantor only.
- The v0.8.1 preflight refuses pre-existing postgres-issued membership or active SET/INHERIT access, rather than silently overwriting unrelated grants. If it stops, inspect grantor/options and review the existing authorization with the project owner. Do not replace the RPC owner with postgres/service_role or remove cloud data to get past the check.

These are explicitly authorized source corrections in a new v0.8.2 Git commit, **not Git history rewriting**. A new later migration alone could not fix an earlier failed installation. No new v0.8.2 data migration is needed: table definitions, ciphertext, key envelopes, IDs, revisions and local vault formats are unchanged. Use current corrected files, not copies from old release commits. The membership option syntax requires PostgreSQL 16+; the isolated test runtime is PostgreSQL 18.6. Hosted acceptance remains owner-run.

### Installation and upgrade paths

Always inspect the target project and existing migration history first. Execute each complete file as the hosted postgres migration role, including BEGIN/COMMIT; do not execute only the ownership-transfer selection.

| Observed installation                                                 | Action using corrected v0.8.2 repository files                                                                                                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New database                                                          | `202610200001_profiles.sql` → `202610270001_encrypted_sync.sql` → `202610280001_sync_authorization.sql`                                                                               |
| Profiles succeeded, v0.8.0 failed and rolled back (the reported case) | Confirm the sync tables/role are absent, then run corrected `202610270001_encrypted_sync.sql`, followed by corrected `202610280001_sync_authorization.sql`. Do not rerun profiles.    |
| v0.8.0 succeeded; v0.8.1 absent/failed                                | Run corrected `202610280001_sync_authorization.sql` only. Preserve existing encrypted rows and keys.                                                                                  |
| All three previously succeeded                                        | No schema/data migration is required. Run the read-only cleanup verification. Controlled reapplication of corrected v0.8.1 is supported if needed; never rerun v0.8.0 table creation. |
| Unknown/partial objects or unexpected memberships                     | Stop and review object owners, grantors and transaction/history state. Do not reset tables/roles/keys or guess that the project is empty.                                             |

If the SQL session is still in an aborted transaction, finish its rollback before retrying. Existing migration tools normally do not rerun already-recorded versions just because source text changed. Do not delete migration-history rows or mark a failed migration successful. Use the inspected state and the owner-approved path above; retain the existing migration mechanism rather than mixing manual files and automatic history blindly.

Read-only starting checks:

```sql
show server_version;
select to_regclass('public.profiles') as profiles,
       to_regclass('tco_sync.accounts') as sync_accounts,
       to_regclass('tco_sync.records') as sync_records;
select rolname from pg_roles where rolname='tco_sync_executor';
```

### Cleanup and security verification

After the complete installation, execute `supabase/tests/sync_role_ownership_v082.sql`. Despite its tests directory, this file reads catalogs only: it does not read operational/Auth rows, change roles, seed users or write data. It checks restricted owners/attributes, forced RLS, direct-table denial, authenticated-only RPC access, private helper ACLs and removal of temporary privileges. It deliberately refuses a superuser postgres test model.

For the hosted non-superuser role, both capabilities below must be false; membership rows may still show the expected bootstrap ADMIN-only entry:

```sql
select pg_has_role('postgres','tco_sync_executor','SET') as can_set_role,
       pg_has_role('postgres','tco_sync_executor','USAGE') as inherits_executor,
       has_schema_privilege('tco_sync_executor','public','CREATE') as can_create;
select m.roleid::regrole as role, m.member::regrole as member,
       m.grantor::regrole as grantor, m.admin_option, m.inherit_option, m.set_option
from pg_auth_members m where m.roleid='tco_sync_executor'::regrole;
```

All three booleans must be false. No postgres-issued temporary membership may remain. Do not interpret a harmless bootstrap ADMIN-only row as failed cleanup, or ignore a row with SET/INHERIT enabled. Existing grants from another grantor need owner review rather than a broad revoke.

### Reproducible local verification and limits

`node scripts/check-sync-migrations.mjs` uses only `new PGlite()` in-memory databases and accepts no hosted database URL/token. Bootstrap role setup stays entirely inside that memory instance; never copy that bootstrap SQL into a hosted project. It then runs every actual migration as **current_user=postgres, session_user=postgres, rolsuper=false** and verifies all three conditions, so a superuser cannot mask this regression.

The four scenarios cover failed fresh-install rollback/retry, existing v0.8.0 ciphertext/key preservation, existing v0.8.1 reapplication/pre-existing-grant rejection, and interruption during owner-scoped RPC replacement. They reproduce both missing SET ROLE and missing function-owner errors, assert removal of migration-issued grants while preserving bootstrap ADMIN-only membership, verify unchanged ciphertext/revisions/timestamps, and run the existing account/RLS fixtures.

Optional PowerShell setup, kept outside repository dependencies:

```powershell
$sqlTestRuntime = Join-Path $env:TEMP 'tco-sql-v082'
npm.cmd install --prefix $sqlTestRuntime --no-save --package-lock=false --ignore-scripts @electric-sql/pglite@0.5.12
$env:TCO_PGLITE_MODULE = Join-Path $sqlTestRuntime 'node_modules\@electric-sql\pglite\dist\index.js'
node scripts/check-sync-migrations.mjs
Remove-Item Env:TCO_PGLITE_MODULE
```

Local results: all four non-superuser migration scenarios passed. The full v0.8.2 release gate passed 494 tests / 46 files, lint, build, static artifact checks and formatting. Full and production-only npm audits each reported 0 vulnerabilities; the existing non-failing bundle-size advisory remains. Exact results are recorded in PROTOTYPE_STATUS.md. Hosted Supabase migration/REST and physical iPhone acceptance of this correction remain unverified. Test the corrected three-file sequence in a disposable hosted project, run the read-only verifier, then use two empty invited accounts for `scripts/check-sync-isolation.mjs`. Run the mutating RLS fixtures only in a disposable database under an appropriate test administrator; a production browser/migration role must not be granted executor access merely to run fixtures. Do not apply anything to production until owner acceptance.

## v0.8.1 additive authorization correction (historical) — 2026-10-28

**Owner review / disposable testing only until hosted acceptance.** v0.8.0 was committed at f8fb8d6. Its source was unchanged at v0.8.1; v0.8.2 subsequently corrects deployment permissions as described above. The correction is `supabase/migrations/202610280001_sync_authorization.sql`.

### Root cause and corrected trust boundary

The [official Supabase knowledge base](https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema) explains that hosted `postgres` does not hold the grant option for the managed Auth schema. The old USAGE grant may complete with a warning but grant nothing. A custom RPC executor then fails when RLS or an RPC reaches Auth functions.

The patch follows the documented request-claims option. Private, parameterless `tco_sync.request_user_id()` is STABLE, SECURITY INVOKER, has an empty search_path, and reads only `request.jwt.claims` / compatible legacy claim settings. It has no Auth schema dependency, Auth table access, privileged helper body or client-supplied owner argument. PostgREST must first verify the signed JWT and install these request settings. The helper does not independently verify a JWT signature; direct administrative SQL can set GUCs and is a different trusted boundary.

Only an authenticated-role, non-anonymous identity is returned. Missing/malformed claims, invalid UUIDs, service/anonymous roles, true or malformed anonymous flags, and conflicting modern/legacy subjects or roles return NULL. Missing anonymous flags remain compatible with legacy non-anonymous tokens; Supabase anonymous-auth tokens explicitly carry true. All six sync RLS policies and all three RPCs use this same helper. The three RPCs retain their restricted NOLOGIN/NOINHERIT/NOBYPASSRLS owner, fixed search_path, revision CAS and ciphertext-only operations. The helper is owned by postgres but is **not** SECURITY DEFINER; EXECUTE is granted only to the executor. Browser roles cannot reach it or the private tables directly.

No inheritance from authenticated, broad Auth schema grants, service-role shortcut, encryption-format change or sync-engine rebuild is introduced. The migration fails transactionally on unexpected role attributes/memberships, executor schema CREATE privileges (including inherited PUBLIC grants), missing forced RLS, unexpected RPC overloads or incorrect ownership. If a preflight fails, stop and review the specific grant/installation; do not clear records, drop the schema or substitute a privileged RPC owner.

### Exact migration order

- **Fresh database:** apply `202610200001_profiles.sql`, then `202610270001_encrypted_sync.sql`, then `202610280001_sync_authorization.sql`, in that order. Use the corrected v0.8.2 source files; its v0.8.0 source removes the ineffective Auth grant and fixes ownership transfer. Older committed copies may warn and fail before the correction can run.
- **v0.8.0 already applied:** apply only `202610280001_sync_authorization.sql` as the same project administrator used for the earlier migration. Do not rerun v0.8.0 table/key creation.
- **Incomplete/unknown v0.8.0 installation:** the correction blocks execution when prerequisites are missing or unsafe. Investigate the previous transaction and migration history; do not guess, delete or recreate cloud keys/tables.

The correction is one transaction and changes functions/policy expressions/ACLs and transaction-scoped role permissions only. It never rewrites key envelopes or cloud records. Reapplying it against the expected v0.8.x objects is supported. Repeat read-only verification freely; do not mark migration history manually or run data fixtures in production.

### Safe read-only verification

Expected: helper SECURITY DEFINER=false / STABLE / postgres owner; three RPCs SECURITY DEFINER=true / executor owner; empty search paths throughout. Helper EXECUTE for anon/authenticated=false, executor=true; only authenticated has gateway RPC EXECUTE. Auth schema usage is not a prerequisite and may remain false.

```sql
select p.oid::regprocedure as function, p.prosecdef, p.provolatile,
       pg_get_userbyid(p.proowner) as owner, p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='tco_sync' and p.proname='request_user_id')
   or (n.nspname='public' and p.proname in ('tco_sync_pull','tco_sync_initialize','tco_sync_push'));
select has_schema_privilege('tco_sync_executor','auth','USAGE') as auth_usage_not_required,
       has_function_privilege('tco_sync_executor','tco_sync.request_user_id()','EXECUTE') as helper_executor,
       has_function_privilege('authenticated','tco_sync.request_user_id()','EXECUTE') as helper_browser_denied,
       has_function_privilege('anon','public.tco_sync_pull(bigint)','EXECUTE') as anon_rpc_denied;
select schemaname,tablename,policyname,cmd,qual,with_check
from pg_policies where schemaname='tco_sync';
select rolname,rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreaterole
from pg_roles where rolname='tco_sync_executor';
select pg_get_userbyid(m.roleid) as granted_role, pg_get_userbyid(m.member) as member
from pg_auth_members m where m.roleid='tco_sync_executor'::regrole
   or m.member='tco_sync_executor'::regrole;
```

Policies must reference only the private request helper for identity. The executor must not inherit another role or be granted to gateway/browser roles; ordinary administrator membership from PostgreSQL role administration is distinct from browser access. Do not grant schema CREATE or Auth access merely to make a failing test pass.

### Actual local results and remaining acceptance

- A temporary embedded PostgreSQL runtime (PGlite 0.5.12, outside application dependencies) reproduced original `42501 permission denied for schema auth` with executor Auth usage denied.
- **22 executable database scenario checks passed:** fresh sequential installation; existing v0.8.0 data upgrade; exact row/key/ciphertext/revision/timestamp preservation; correction reapplication; own-account RPCs; original/new rollback-only SQL fixtures (including repeated verification); fail-closed unsafe membership/BYPASSRLS/CREATE grants.
- Focused application regressions passed **48 tests / 8 files**, including authorization contracts, actual Web Crypto, Guest exclusion, old Vault compatibility, interrupted upload/retry, revision conflicts and UI consent. The full v0.8.1 release gate passed **488 tests / 45 files**, lint, production build, static bundle scan and formatting. Both full and production-only npm audits reported **0 vulnerabilities**. Details are recorded in PROTOTYPE_STATUS.md.
- These are real local PostgreSQL permission/RLS checks against a simulated Auth schema, **not** hosted Supabase or authenticated Internet REST acceptance. No production migration, deployment or data deletion was performed. Real signed-token tests and physical iPhone remain unverified.

In a **disposable Supabase project only**, apply all three migrations, verify executor Auth usage is false, then run `SET tco.disposable_test='yes';` and execute both `supabase/tests/encrypted_sync_rls.sql` and `supabase/tests/sync_authorization_v081.sql` in the same administrative session. Both fixtures roll back. The v0.8.1 fixture refuses to run if the executor can use Auth, so it cannot accidentally miss this regression. Do not revoke or modify production Auth permissions to arrange a fixture test.

Then run `scripts/check-sync-isolation.mjs` with two empty disposable invited accounts and short-lived user JWTs, using the environment setup below. It now also checks own-account key/ciphertext recovery, rejects an owner argument and modified JWT signature, and verifies cross-account isolation. Never use a service-role credential. Do not run this mutating REST fixture against real user accounts. Confirm hosted RPC ownership, claims handling and old/new-device sync before the owner manually applies the correction to the intended project. Finally perform Windows/iPhone Safari and standalone-PWA acceptance, preserving backups and the existing opt-in requirement.

## Architecture and scope

- Cloudflare remains a static HTTPS SPA. Existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` point to the same configured Supabase HTTPS origin. No service key, Worker backend, Storage bucket, Realtime, passkey or paid service is introduced.
- Guest retains its existing key and never receives a sync engine. Signing in or unlocking an Account does not enable sync. Account Settings requires consent plus a cloud vault passphrase. Every newly opened Account session must explicitly unlock the cloud key again; consent/enabled state alone cannot upload.
- Handling records (including archived/private values, revisions and nested disruptions), Duties, Journals and privacy settings are synchronized. Record IDs and all links are preserved. Trash is a normal encrypted record; permanent removals become encrypted tombstones. Privacy switches control collection/display, not removal of previously archived values; the consent explicitly includes those values.
- Language stays device-local. Authentication sessions, workspace choice, PWA caches, update notices, filters/navigation and the sync controller are not cloud records. Existing schema-1 JSON exports contain operational data/settings only, never keys or sync state.
- One encrypted cloud row per operational record plus one privacy-settings row. Nested events remain in their parent Handling record. Keyed opaque IDs conceal record type and original ID. The provider sees account UUID, row/byte counts, revisions, timing and usage patterns; it cannot infer permission to store employer data from encryption.

## Cryptography and key lifecycle

1. Initial explicit enablement generates a cryptographically random 256-bit account root secret. It is independent of the v0.7 local vault encryption key.
2. PBKDF2-HMAC-SHA256 (600,000 iterations, fresh 128-bit salt) derives a non-extractable AES-256-GCM wrapping key from the selected passphrase. The root is wrapped with a fresh 96-bit IV and a 128-bit GCM tag. AAD binds purpose, format version, account UUID, key UUID, salt and KDF parameters.
3. HKDF-SHA256 derives separate non-extractable AES-256-GCM record and HMAC-SHA256 ID keys from the root, with account/purpose/key-ID separation. The unwrapped byte buffer is overwritten after derivation. JavaScript garbage collection cannot promise forensic memory erasure.
4. Each record encryption uses a fresh random 96-bit IV and a 128-bit GCM tag. AAD binds purpose, version, account UUID, key UUID, opaque record ID and target revision. Decryption checks the HMAC-derived ID against the decrypted collection/ID, then validates the complete database and relationships before integration.
5. Remote storage holds only the wrapped root and ciphertext envelopes. The passphrase and unwrapped keys are never persisted remotely or logged. Keys live only in the unlocked controller and are dropped on lock/sign-out/switch/invalid session. Another authenticated device uses the **original cloud vault passphrase**, which may differ from that device's independently created local vault secret.
6. Cloud keys are immutable in v0.8.0. No passphrase change, rotation, escrow or automatic reset exists. Losing the cloud passphrase makes cloud records unrecoverable through OTP/password reset. An unlocked local vault plus a verified JSON export may still preserve the operational data, but does not recover the cloud key. Do not delete/reset the cloud key to troubleshoot.

Standard references: [Web Crypto key derivation](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey), [OWASP PBKDF2 parameters](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database function security](https://supabase.com/docs/guides/database/functions).

This protects records at rest and in transport to the database; it does not protect an unlocked app from malicious same-origin JavaScript, a compromised frontend host, browser extensions, malware, weak passphrases or an authorized user sharing decrypted data. A malicious database administrator can delete/withhold data; authenticated envelopes are not a proof of server availability or a complete anti-rollback transparency system. Existing devices reject revision rollback; a newly provisioned device has no external history anchor.

## v0.8.3 Settings access and fresh optional fields

Use Account → Account Settings or gear Settings → Account Settings; both open one workspace-scoped dialog. Guest has no account-only controls. Opening either path does not enable sync; consent/passphrase confirmation is unchanged.

Only newly initialized Guest/Account preferences default to six enabled fields. Existing local vaults and cloud privacy/settings remain authoritative; defaults are not merged over saved false values. The initial privacy/settings row remains intentional even with zero aircraft. When a new device's defaults differ from saved cloud settings, synchronization pauses for the existing conflict review: compare both versions and explicitly choose Cloud to restore the saved preferences. The new device does not upload its defaults while that conflict is unresolved. Do not reset the cloud key or delete the settings row. No SQL migration is required for v0.8.3.

## Local compatibility and adoption

- v0.7.0/v0.7.1 vault envelopes and database payloads remain readable. Merely opening the upgraded app does not rewrite them. The first successful opt-in persists an internal encrypted payload `{vaultFormat:2, db, sync}` under the same user-bound local key. The outer local AES-GCM envelope remains version 1. No original record IDs or operational schema change.
- Sync metadata includes the acknowledged encrypted-at-rest baseline, cursor, conflicts, enabled flag, wrapped key and last acknowledgement. Pending changes are derived from the durable local database versus that baseline. Both data and metadata are written atomically as one encrypted localStorage value.
- Web Locks serialize Account encryption/CAS/write across tabs. Sync refuses to enable without Web Locks. A stale tab pauses and requires reload/unlock rather than overwriting a newer vault. Existing local-only behavior remains available where sync cannot safely run.
- Distinct device datasets are reconciled: unique records are combined, differing same-ID records and privacy settings require explicit review. An empty remote account never replaces valid local records. First-time cloud key creation races fail safely; retry using the passphrase of the device that successfully created the key.
- **Guest-to-Account merge/import is not implemented.** Guest remains separate. Do not use sign-in as a transfer mechanism. Existing reviewed JSON Restore/Replace still targets the explicitly selected workspace and is not a merge; it preserves Guest only when Guest is not the selected restore destination.

## Database migration and authorization

Apply **only after review and successful disposable testing**:

- Existing prerequisite: `supabase/migrations/202610200001_profiles.sql`.
- Original sync migration: `supabase/migrations/202610270001_encrypted_sync.sql`.
- Required additive correction: `supabase/migrations/202610280001_sync_authorization.sql`.

The new private `tco_sync` schema has:

| Table      | Contents                                                                                      | Access                                                        |
| ---------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `accounts` | Owner UUID, format, immutable wrapped key, account revision, operation UUID, server timestamp | Forced RLS; no browser table grants                           |
| `records`  | Owner UUID, opaque ID, revision, ciphertext envelope, server timestamp                        | Forced RLS; ownership/revision index; no browser table grants |

The public API consists only of `tco_sync_pull`, `tco_sync_initialize` and `tco_sync_push`. Anonymous EXECUTE is revoked. Ownership is always derived from server-installed JWT request claims through the private request helper, never an owner parameter. Anonymous-auth identities are also rejected. Keep public registration disabled as documented for v0.7.0.

**Why a restricted SECURITY DEFINER role:** ordinary SECURITY INVOKER functions would require granting browser roles table writes, allowing direct revision bypass. Instead, all three fixed-search-path functions are owned by `tco_sync_executor`, a NOLOGIN, NOINHERIT, NOBYPASSRLS role that does not own the tables. It receives only the required SELECT/INSERT/UPDATE privileges. Forced RLS still applies to the caller's JWT identity through the private request helper. No dynamic SQL or broad privileged operation exists. Do not grant membership in this role, give it BYPASSRLS, or expose `tco_sync` as a PostgREST schema.

Push locks the user's account row, compares the expected revision and atomically commits all changed records plus the next revision. This account-level CAS protects cross-record links; concurrent changes are pulled/reconciled rather than overwritten. Pull holds a shared account lock and returns one coherent incremental snapshot with counts. Keys cannot be overwritten, and physical record DELETE is not granted. Tombstone ciphertext remains indefinitely to prevent stale-device resurrection. Deleting an Auth account through an authorized administrator cascades its cloud rows; this app does not expose account deletion, and local browser vaults/backups remain until separately managed.

Bounds: maximum 5,000 cloud rows including privacy/tombstones, 256 KiB encrypted record payload, 8 MiB cloud ciphertext text per account and bounded atomic request/response sizes. Local full data still uses the existing 5 MiB backup bound; encrypted baseline duplication and browser quotas can impose a lower practical limit. These are app safeguards, not guarantees of Supabase Free Tier capacity. Monitor actual project quotas; no plan upgrade is automatic.

Before the migration exists, the missing-RPC response is shown as a setup error; no partial record synchronization occurs. The app does not create tables or apply migrations.

Read-only owner verification queries:

```sql
select n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) as owner
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='tco_sync' and c.relkind='r';
select rolname, rolcanlogin, rolbypassrls, rolsuper from pg_roles where rolname='tco_sync_executor';
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname='tco_sync';
select p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'tco_sync_%';
```

## Synchronization, failures and conflict review

- Local edits are saved durably before success. Debounced local edits, foreground/focus, reconnect and manual retry trigger bounded attempts after the cloud key is unlocked. There is no polling or Realtime connection and no background-tab/offline guarantee. `navigator.onLine` is not treated as proof of a usable session/server.
- Each RPC revalidates server identity and session expiry. Existing authenticated fetch has a 15-second timeout. Sign-out, switching, vault lock and invalid authentication fence/abort requests. Cancellation cannot recall an already committed server request; a later authenticated pull reconciles its acknowledgement.
- Pull decrypts and validates all changes before integration. Unsupported versions, corrupt ciphertext, wrong identity/key, response count mismatches, missing relationships or rollback stop the attempt. Open operational/backup dialogs defer sync to protect unsaved forms; close them and retry.
- Lost upload acknowledgement is recovered by pulling: matching encrypted-record contents advance the baseline without another duplicate creation. A stale CAS is retried through a new pull, never last-write-wins. Rapid edits during an upload remain pending against that exact acknowledged version.
- Conflicts retain the local record and the remote alternative inside the encrypted vault. Account Settings → Review differences → choose each local/cloud version → confirm. Deletions are explicit alternatives. Cross-record dependency conflicts must be resolved together; invalid combinations fail atomically without removing either graph. There is no automatic text merge or silent winner.
- Network/paused-project/rate-limit errors pause safely; reconnect, focus or manual retry starts another attempt. No uncontrolled retry loop exists. Quota errors retain local work and do not claim Synced. `Synced` refers to the last validated/acknowledged current dataset, not provider durability guarantees or an independent backup.
- Disable stops future sync on **this device** and retains pending work, key envelope, baseline and conflicts. It does not purge remote copies or stop other enabled devices. All sessions still require explicit cloud-key unlock after reload.

## Production setup and Windows commands

1. Export and verify full JSON backups from each existing Account and Guest workspace. Keep these unencrypted files private. Do not clear browser data.
2. In a disposable Supabase project, retain invitation-only configuration and apply all three reviewed migrations in the order above. If `CREATE ROLE` is unavailable, resolve permissions with the project owner; do not substitute the table-owning postgres/service-role as RPC owner.
3. Run disposable SQL and REST tests below. Inspect Dashboard Security Advisor and grants/RLS. Do not publish until actual authenticated A/B isolation passes.
4. Owner manually applies the required migration(s) after approval: an existing v0.8.0 installation needs only the additive v0.8.1 correction. Keep `tco_sync` out of exposed API schemas. Do not change existing profiles or Auth/email templates.
5. Keep the same two Vite public variables and HTTPS origin. No new secret or wildcard CSP is needed; existing `connect-src` includes only the configured HTTPS Supabase origin. The unchanged Service Worker ignores cross-origin/API/POST responses and never caches tokens, plaintext, or sync data.
6. In PowerShell at `C:\Projects\Turnaround-Coordinator-Logbook`: `npm.cmd ci`, `npm.cmd run check:release`. Owner reviews/commits/pushes/deploys through the existing Cloudflare workflow. This implementation session performs none of those Git or hosted actions.
7. Sign in online, unlock the local Vault, open Account Settings, review the data-policy consent, enter/confirm the cloud vault passphrase, and explicitly enable. Confirm status/last acknowledgement and inspect encrypted-only rows server-side.

## Disposable SQL and real REST isolation tests

SQL is **not** an authenticated REST isolation test. Against an expendable test project only, as its admin:

```sql
SET tco.disposable_test = 'yes';
-- Then execute supabase/tests/encrypted_sync_rls.sql in this same session.
```

It seeds synthetic users and rolls back; the explicit marker is required. Do not run against production, even though it rolls back. The fixtures test authorization/constraints and intentionally do not represent decryptable operational records.

For actual signed-token API verification, invite two fresh disposable test accounts and obtain their short-lived user access tokens through normal OTP in a trusted test harness. Never use service-role tokens. Set these environment variables only in a temporary local PowerShell session (do not commit, paste into chat, or print tokens):

- `TCO_SYNC_DISPOSABLE=yes`
- `TCO_SYNC_TEST_URL` = the disposable project's HTTPS URL
- `TCO_SYNC_TEST_KEY` = its public publishable key
- `TCO_SYNC_TEST_A_TOKEN` and `TCO_SYNC_TEST_B_TOKEN` = distinct authenticated test-user tokens

Run `node scripts/check-sync-isolation.mjs`. It refuses pre-existing cloud data, verifies both tokens with Auth, creates random synthetic encrypted-format fixtures, checks key/record ownership, forged ownership, stale CAS, anonymous denial, private-schema denial and incremental reads. It prints assertions only, never tokens/records. Fixtures remain in those disposable accounts; remove the test project/accounts through the owner's administration workflow afterward. Do not reuse the fixture keys for application data. Clear the temporary environment variables when finished.

## Two-device and physical-device acceptance

Use fictional records only, with separate Windows Edge/Chrome and physical iPhone Safari/Home Screen PWA sessions:

1. Back up both devices; sign into the same invited account. Create distinct local records before enabling. Verify Guest data remains identical.
2. Enable on device A. Inspect cloud rows for ciphertext only. On B unlock its local vault, then enter A's cloud vault passphrase in Account Settings. Review privacy/same-ID conflicts; verify unique records, links, archived values and counts on both devices.
3. Offline on A, create/edit/delete and restart. Confirm pending work survives local unlock. Reconnect/sign in and explicitly unlock cloud sync; verify B receives changes once.
4. Edit the same record offline on both devices, including edit-versus-delete. Confirm two versions survive and the reviewed choice propagates. Test linked Duty/Handling/Journal deletions; invalid mixed choices must stay blocked.
5. Interrupt an upload, retry after a paused project/rate limit, and test a storage-quota failure. No false saved/synced message; records remain recoverable.
6. Sign out/switch A→B during a delayed request. No A response appears in B. Open two browser tabs; the stale tab must pause instead of overwriting. An expired/revoked session must stop sync.
7. Verify consent, passphrase keyboard, conflict scrolling, long values, light/dark, English/Traditional Chinese and safe areas on the actual iPhone. Desktop emulation is not physical iOS validation.
8. Disable sync, change a local record, and verify no upload. Confirm old cloud copies remain. Export/verify an independent JSON backup. Re-enable with the original cloud phrase and resolve any intervening remote changes.

## Recovery, rollback and retention

- Never reset a damaged cloud key/envelope, clear localStorage, unregister the worker or reinstall the PWA as a troubleshooting shortcut. Preserve ciphertext and independent JSON backups first.
- Existing JSON Restore/Replace remains explicit and workspace-scoped. With sync enabled, replacement/deletion becomes pending cloud work. **Disable sync before a local recovery-only restore**, then carefully reconcile before re-enabling.
- A pre-v0.8 app cannot read the adopted internal vault payload. Do not roll back static assets blindly. First disable sync, use v0.8 to unlock/export/verify every affected workspace, and preserve original encrypted bytes. Prefer a forward fix. A deliberate old-version recovery requires separately reviewed restoration from verified JSON; no automatic downgrade exists.
- Do not drop/truncate cloud tables during rollback; that loses tombstones and enables stale resurrection. Stop clients and retain encrypted data for a reviewed recovery plan. Removing cloud records requires an explicit owner retention/deletion decision; disabling sync is not erasure.
- Browser-local data is origin-specific. Keep the stable production origin. Future passkeys (v0.9) will authenticate identity, not automatically supply this encryption key. v1.0 still requires owner production approval and hosted security/device acceptance.

## v0.8.0 historical verification record

Final local continuation: `npm.cmd run check:release` passed 482 tests / 44 files, lint, build, static artifact checks and formatting. `npm.cmd audit` and `npm.cmd audit --omit=dev` each reported zero vulnerabilities after the existing development-only Vitest 4.1.12 / Wrangler 4.153.0 updates. The Account sidebar/footer says encrypted account vault rather than implying cloud-enabled records exist only on-device. Exact release commands and review notes are recorded in `PROTOTYPE_STATUS.md`. Tests use real Web Crypto and simulated devices/transports; they do not establish hosted RLS, SMTP, Internet reliability or physical iPhone behavior. No local PostgreSQL/Supabase runtime was available for executing the migration/SQL fixtures. Live SQL, signed-token REST, owner Windows and physical iPhone acceptance remain mandatory.
