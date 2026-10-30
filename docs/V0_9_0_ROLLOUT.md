# v0.9.0 production-hosted pre-release

## v0.9.4 session lifecycle

The existing Supabase SDK owns persistence and refresh credentials; no new credential store or server lifetime change is introduced. Startup waits for restoration and verifies identity through Auth. Actual access-token expiry triggers session recovery, not unconditional logout. Same-user storage rotations are verified asynchronously outside Auth callbacks; account changes and explicit sign-out fence and lock old workspaces immediately. Transient network/5xx verification failures retain local drafts/queues and show Offline / Pending Sync; focus, reconnect, pageshow and manual retry re-verify before synchronization resumes. SDK proactive refresh failures do not shorten a still-valid access-token lifetime. Irrecoverable expiry, revoked/invalid identity and ownership mismatches require authentication again.

Switch to Guest preserves the SDK session and locks only the visible Account workspace. Returning verifies ownership before opening it; explicit Sign Out uses local scope, removes authenticated access and returns the OTP welcome screen. Normal Cloud Accounts are passphrase-free. Legacy Vault access remains a separately selected, passphrase-protected, read-only recovery/consented conversion path; no ciphertext or key is removed. Cloud records remain server-readable, NOT E2EE; the offline cache is plaintext.

登入持續性沿用 Supabase SDK，不另存憑證或延長伺服器登入期限。啟動及恢復前景時須向 Auth 驗證帳戶；權杖到期會嘗試恢復登入，不直接登出。同帳戶跨分頁更新須重新驗證；不同帳戶及明確登出即時鎖定舊工作區。暫時網絡／伺服器故障保留草稿及佇列，顯示「離線／尚待同步」，重新連線、恢復前景或重試後再驗證。有效權杖不會因提早更新失敗而縮短可用期限；真正失效或撤銷的登入仍須重新驗證。

切換訪客只鎖定及隔離帳戶，保留登入；返回帳戶須先驗證擁有者。明確登出使用 local scope，下次須 OTP。正常雲端帳戶毋須密語；舊版資料庫僅在獨立選取的唯讀復原／已同意的轉換流程使用原有密語，原有密文及金鑰保留。雲端資料仍為伺服器可讀、非 E2EE；離線快取為明文。

Owner smoke test (no data clearing/reinstall): sign in once in a test browser/profile, reopen/reload and check the same Account; suspend past access-token expiry and reconnect; check Guest → Account without another OTP; explicitly Sign Out and check a new OTP is required. Save a fictional Draft offline, reconnect and verify its server acknowledgement. Repeat in physical iPhone Safari and the installed PWA separately, because their storage contexts may differ. Browser policies and revoked sessions can still require sign-in. Do not reset Production accounts or run synthetic hosted isolation tests there. Keep an independent JSON backup before changing browser storage.

擁有者實機檢查（毋須清除資料／重裝）：測試瀏覽器登入一次後重新載入及重開；暫停至權杖到期再連線；切換訪客再返回帳戶；明確登出後確認須新 OTP。離線儲存虛構草稿，連線後核對伺服器確認。iPhone Safari 與主畫面 PWA 須分別驗收；儲存環境可能不同。請勿重設正式帳戶或在 Production 執行合成隔離測試；更改瀏覽器儲存前保留獨立 JSON 備份。

Reference: [Supabase getSession](https://supabase.com/docs/reference/javascript/auth-getsession), [Auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [refreshSession](https://supabase.com/docs/reference/javascript/auth-refreshsession). Local SDK/HTTP and isolated-browser checks are synthetic; they do not certify hosted Auth policies or physical iOS behavior.

The owner authorized v0.9.0 release on 2026-10-29 HKT, confirming 10/10 disposable hosted isolation tests, successful installation of all three new Production migrations, unchanged SHA-256 hashes of retained encrypted records and an independent Production database backup. These results are owner-attested; the release agent does not repeat migrations or write synthetic records to Production. Physical-device and near-limit acceptance are explicitly deferred to v0.9.1+.

Production target: `https://app.tcologbook.workers.dev/`, Cloudflare account `cb3e9b12efd37945a6c1497fe9d9fbd3`, Worker `app`. Previous active Worker version inspected before release: `b5f2df96-c6e6-45da-8f7b-67547c8dedd4`. Account Cloud is **server-readable, NOT E2EE**; its local cache and consented recovery plans are plaintext. Account consent and reviewed Legacy/Guest migration remain required.

Since v0.9.2, `scripts/production-account.mjs` enforces Production Cloud Account enablement and pins the Production URL plus reviewed publishable-key SHA-256. Missing optional mode flag enables Cloud Account automatically; an explicit disabling value fails. Actual URL/key stay in ignored `.env.production.local` or Cloudflare build variables. No private/service-role key is permitted or committed. Native Git builds must provide `VITE_SUPABASE_URL=https://ajcaauaxrtrcktdbocaf.supabase.co` and its matching publishable key; local ignored files are not transferred to Cloudflare. Remove stale `VITE_ACCOUNT_CLOUD_V2=false` from Production build settings if present. `npm run build` verifies release.json, actual JS, key/project identity and CSP; do not bypass it. Rotation requires a reviewed fingerprint update. Ordinary development remains opt-in. Wrangler uploads the verified dist artifact; live release.json and asset hashes must then match it.

Release gate completed locally: `npm.cmd run check:release` passed 661 tests / 59 files, lint, TypeScript/Vite build, static checks and formatting. The generated JavaScript independently passed checks for v0.9.0, the enabled Account Cloud flag, the exact Production URL and matching publishable key; its only configured Supabase project is ajcaauaxrtrcktdbocaf. Generated CSP allows only that Supabase HTTPS origin in addition to self. The bundle-size advisory remains non-blocking. Cloudflare OAuth and access to the existing app Worker were verified before release; successful deployment and live verification must be confirmed separately in the release report.

## Implemented

Inline bilingual Guest warning; per-user plaintext account cache and guarded new-account onboarding; durable retry and captured-token request binding; offline/account-switch fencing; conflict/tombstone protection; deterministic flight/group matching; reviewed Guest transfer UI with individual candidates, selected eligible bulk choices, real Aircraft/Duty/Journal editor staging, two confirmations plus high-risk approval, ID/link remapping, recovery copies and receipt checks. Unsubmitted Guest reviews can be cancelled after plan-file readback. Live History can be inspected and restored as a new revision after field comparison, recovery-file readback and approval; invalid links or stale server state block restoration. Manual History Archiving uses downloaded-file readback and explicit approval; old-device replay-floor review and capacity safeguards are implemented. An additive SQL proposal, guarded disposable REST runner and local PostgreSQL verifier are available. Legacy local Vault recovery is read-only and uses defensive copies.

## Mixed-queue recovery

Mixed queues are now connected to a separate Account-edit review in Account Settings and the Guest wizard. Original Guest and recorded Account UUIDs are verified independently; all original cache bytes, later dirty values and decisions remain preserved. Rejected/expired Guest work still needs full Guest duplicate approval; subsequent edits need their own per-record decisions, verified recovery-file readback and confirmation. Cache envelope version 2 blocks older preview code from ignoring this recovery state. This local implementation does not replace the hosted and physical-device gates below.

## Remaining limitations and deferred acceptance

- Legacy conversion is connected with individual source reconciliation, existing manual editors, actual backup-file readback, consent, durable exact-request retry and independent destination verification. Exceptional recovery limits remain documented in Architecture. Do not bypass them to convert an unsupported source.
- Archived History file import/restoration remains unavailable. The live History UI supports bounded account-scoped reads and new revision-guarded restoration after comparison and verified backup; ordinary account conflicts and expired-device review remain separate.
- Owner-reported hosted signed-token isolation: 10/10 passed. Physical iPhone Safari/PWA, full real-device two-device smoke tests and near-limit archival acceptance remain deferred to v0.9.1+; local browser emulation does not establish those passes.

Package/UI are 0.9.0. The owner authorizes release after the normal automated checks and verified deployment; any critical authentication, isolation or data-loss failure still stops release.

## Security and preservation

New records would be server readable, NOT end-to-end encrypted. The separate new browser cache is plaintext: per-user keys and adapter locking are isolation machinery, not cryptographic confidentiality. Same-origin code, extensions, browser-profile access and compromised devices can read it. Explicit model-change consent is required before legacy plaintext upload. A key served by the provider would not hide data from that provider.

Guest originals and legacy vault/key/ciphertext remain unchanged. Current sign-in retains v0.8.3 behavior. Independent verified JSON backups remain essential. The app logs no records/credentials; provider SQL logs/backups/retention still require review.

SQL bounds: 5,000 current record/tombstone rows / 8 MiB; history 20,000 rows / 32 MiB; operation receipts 20,000; History reads latest 100 per record. Local operational validation is 5 MiB; the new plaintext cache envelope guard is 16 MiB, subject to lower browser quotas. Capacity failures roll back atomically. **Manual archival only:** download and reread the exact export, approve explicitly, then archive prior history/receipts while preserving current records, tombstones and the initial receipt. Replay-floor expiry requires an offline device to re-review; no automatic pruning. Auth-user deletion cascades through both schemas; never delete a user to troubleshoot. These are application bounds, not Supabase Free Tier guarantees.

## Comparison and approval rules

Canonical comparison requires a two-character prefix containing a letter, nonzero number and optional one-letter suffix: CX00402A compares as CX402A. Source strings never change. Prefix-only, pure-number and malformed flights are not confident identities.

Operational dates, applicable legs and populated fields qualify matches. Adjacent dates require a shared HKT leg instant. Candidate connected components expose many-to-many cases. Bulk Cloud/Local is allowed only for isolated exact/likely matches. Manual marking is unresolved until edited/separate-record review is complete.

Manual results declare Guest, Account or staged-editor reference space so colliding IDs cannot redirect links. The staged editor opens the existing Aircraft/Duty/Journal form against a collision-safe provisional graph; nothing is written to Guest or uploaded merely by editing. Final confirmation checks current Guest bytes, destination fingerprint, user/workspace and revision. Nonempty replacements, partial/ambiguous groups, privacy changes or >=10 replacements require extra approval. A stale Guest merge is never silently rebased. Local queue save/UI dismissal is not Migration Complete.

## Disposable local PostgreSQL verification

The optional runtime is outside app dependencies. The verifier accepts a module path, never a DB URL/token:

```powershell
$sqlTestRuntime = Join-Path $env:TEMP 'tco-sql-v090'
npm.cmd install --prefix $sqlTestRuntime --no-save --package-lock=false --ignore-scripts @electric-sql/pglite@0.5.12
$env:TCO_PGLITE_MODULE = Join-Path $sqlTestRuntime 'node_modules\@electric-sql\pglite\dist\index.js'
node scripts/check-account-migrations.mjs
Remove-Item Env:TCO_PGLITE_MODULE
```

Actual SQL runs in new in-memory databases as simulated hosted non-superuser postgres. It checks temporary privilege cleanup, forced RLS, anonymous/direct-table rejection, A/B isolation, CAS, idempotence, recovery versions, tombstones, invalid-graph rollback and old-client fencing. This is not hosted JWT/PostgREST or physical-device testing.

## Exact disposable hosted setup

After review, create a NEW disposable Supabase Test Project, retain invitation-only signup, and apply manually ONCE:

1. supabase/migrations/202610200001_profiles.sql
2. supabase/migrations/202610270001_encrypted_sync.sql
3. supabase/migrations/202610280001_sync_authorization.sql
4. supabase/migrations/202610280002_cloud_accounts.sql
5. supabase/migrations/202610290001_guest_merge_recovery.sql
6. supabase/migrations/202610290002_mixed_queue_recovery.sql

For an existing disposable v0.8.3 database, apply steps 4–6 after verified backups and old key/ciphertext/revision snapshots. For the earlier staged v0.9.0 schema, apply steps 5 and 6; if Guest recovery step 5 is already installed, apply only step 6. Step 6 adds only the purpose-bound Account-edit outcome RPC, retaining the existing records, receipts, keys and RLS. Steps 5 and 6 are repeatable and locally tested against populated data. Never replay step 4 table creation. No Production or hosted Test Project SQL has been executed by the agent.

Read-only checks:

```sql
select p.oid::regprocedure,p.prosecdef,pg_get_userbyid(p.proowner),p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'tco_account_%';
select c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='tco_cloud' and c.relkind='r';
select has_schema_privilege('authenticated','tco_cloud','USAGE') as must_be_false,
       has_schema_privilege('tco_sync_executor','public','CREATE') as must_be_false,
       has_function_privilege('anon','public.tco_account_pull(bigint)','EXECUTE') as must_be_false;
select pg_get_userbyid(m.roleid),pg_get_userbyid(m.member),m.admin_option,m.inherit_option,m.set_option,pg_get_userbyid(m.grantor)
from pg_auth_members m where m.roleid='tco_sync_executor'::regrole or m.member='tco_sync_executor'::regrole;
```

Four tables must have ENABLE+FORCE RLS with independent owners; nine public Account RPCs (pull, initialize, push, verify conversion, History, prepare archive, archive, Guest outcome, Account-edit outcome) must use the restricted executor, empty search_path and authenticated-only browser EXECUTE. No temporary schema CREATE or SET/INHERIT grant may remain. Applying the migrations must not change old ciphertext/keys.

Installation expectations: steps 1, 2 and 4 create tables/schema/roles and must run once, not as a rerunnable reset script. Step 3 replaces authorization functions against the expected existing v0.8.x schema; steps 5 and 6 are repeatable corrections only against their checked predecessor schema. On an error, stop and inspect the transaction and migration ledger before continuing. Never ignore an error, drop objects to force a rerun, or run the whole sequence against an already populated project.

Check every Account RPC ACL after installation (read-only):

```sql
select p.oid::regprocedure,pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.proconfig,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_must_be_true,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_must_be_false,
       has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_must_be_false,
       exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
              where a.grantee=0 and a.privilege_type='EXECUTE') as public_must_be_false
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'tco_account_%';
```

## Hosted REST procedure — owner reports 10/10 passed

The prepared disposable REST runner includes Guest and Account-edit receipt isolation, exact retry, cross-purpose and changed-payload rejection, and retirement/delayed-write checks. It is not executed automatically. `merge_outcome` and `edit_outcome` accept the exact original `p_expected`, `p_operation`, `p_records` and an explicit `p_retire` boolean. A `missing` response does not prove rejection; `committed` prevents duplicate import; `retired` fences the original without altering current records; `expired` requires full re-review and does not prove whether an archived operation committed. Test both race orderings on hosted PostgREST with short-lived invited test-user tokens before acceptance.

Use two invited, empty Test Project accounts A/B and short-lived OTP user JWTs outside source/logs. Never service_role, real records or Production.

- POST /rest/v1/rpc/tco_account_pull with {"p_cursor":0}: onboarding state is authoritative; a legacy settings-only account is established.
- POST /rest/v1/rpc/tco_account_initialize with stable p_operation UUID, p_consent=true, p_records (one six-boolean privacy/settings row for a new account), p_legacy_revision=null. False consent fails. Legacy requires its exact reviewed revision.
- POST /rest/v1/rpc/tco_account_push with p_expected, stable p_operation, reviewed p_records and p_purpose="edit" or "guest-merge". Same-body retry must not add revisions; changed-body reuse must fail.
- Test A/B record/history isolation, missing/expired/modified/foreign JWTs, anonymous Auth and private-schema access denial.
- Verify stale CAS, deletion conflicts, invalid graph rollback, recovery copies and old-client write rejection after conversion. Compare original hashes and verify legacy recovery pulls.
- Record only assertions/status/counts, never plaintext/tokens. `scripts/check-account-isolation.mjs` is a guarded, synthetic new-mode REST runner for an explicitly identified disposable test project. It has **not** been run against hosted Supabase. It cannot prove a project is disposable by itself; the operator must verify the project identity and absence of real data.

### Exact owner-operated REST commands

Use a new PowerShell terminal in this repository. In the Supabase dashboard, independently verify the disposable project reference and its HTTPS API URL, then manually invite **two new synthetic users** with no legacy keys or new Account workspace. Keep invitation-only signup. Obtain fresh, short-lived **access tokens** for these Test Project users through Email OTP; refresh tokens, secret/service-role keys and Production tokens are forbidden. Do not paste credentials into this document, source files, chat, command arguments or terminal transcripts. Use the same Test Project's publishable (or legacy anon) API key.

The Production reference below is a required **deny-list identifier only**, not a credential or request destination. The runner refuses a missing/equal reference, privileged/wrong-user/expired token claims, and nonempty or inconsistent initial snapshots. It then verifies both identities with the selected project's Auth server before any write; local JWT decoding alone is not authentication. Software cannot prove your project-selection assertion.

The following block is for the owner to run **after SQL review/install**, not part of this preparation pass. It makes synthetic writes in the selected disposable project and intentionally leaves them there. Run without `Start-Transcript`, debug credential output, or shell environment dumps:

```powershell
Set-Location -LiteralPath 'C:\Projects\Turnaround-Coordinator-Logbook'
function Read-TcoTestSecret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $secure.Dispose() }
}
try {
  $env:TCO_ACCOUNT_PRODUCTION_PROJECT_REF = Read-Host 'Production project ref (deny-list only)'
  $env:TCO_ACCOUNT_TEST_PROJECT_REF = Read-Host 'Independently verified disposable project ref'
  $env:TCO_ACCOUNT_TEST_URL = Read-Host 'Disposable API URL, exactly https://<test-ref>.supabase.co/'
  $env:TCO_ACCOUNT_DISPOSABLE = Read-Host 'Type yes after checking this project contains only synthetic test data'
  $env:TCO_ACCOUNT_TEST_CONFIRM = Read-Host 'Type DISPOSABLE:<test-ref> to authorize this test run'
  $env:TCO_ACCOUNT_TEST_A_ID = Read-Host 'New synthetic user A UUID'
  $env:TCO_ACCOUNT_TEST_B_ID = Read-Host 'New synthetic user B UUID'
  $env:TCO_ACCOUNT_TEST_KEY = Read-TcoTestSecret 'Test Project publishable/anon API key'
  $env:TCO_ACCOUNT_TEST_A_TOKEN = Read-TcoTestSecret 'Test user A short-lived access JWT'
  $env:TCO_ACCOUNT_TEST_B_TOKEN = Read-TcoTestSecret 'Test user B short-lived access JWT'
  node scripts/check-account-isolation.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Test stopped. Preserve the Test Project and inspect; do not reset or rerun the same users.' }
} finally {
  foreach ($name in @('TCO_ACCOUNT_PRODUCTION_PROJECT_REF','TCO_ACCOUNT_TEST_PROJECT_REF','TCO_ACCOUNT_TEST_URL','TCO_ACCOUNT_DISPOSABLE','TCO_ACCOUNT_TEST_CONFIRM','TCO_ACCOUNT_TEST_A_ID','TCO_ACCOUNT_TEST_B_ID','TCO_ACCOUNT_TEST_KEY','TCO_ACCOUNT_TEST_A_TOKEN','TCO_ACCOUNT_TEST_B_TOKEN')) {
    [Environment]::SetEnvironmentVariable($name,$null,'Process')
  }
  Remove-Item Function:Read-TcoTestSecret
}
```

Expected result: **10 PASS scenario groups**, followed by `Passed 10 hosted disposable RPC scenarios` and the no-cleanup notice. This is an expected result, **not an executed hosted pass**. Initial state/identity failure sends no mutation; a later assertion failure may leave earlier synthetic writes, so preserve the project for investigation. A second run requires another pair of new empty synthetic users; do not reset/delete the first pair.

This runner covers new Account authorization, CAS, exact retry, history/tombstones and both receipt purposes. It deliberately tests false archive confirmation only; it does **not** certify Legacy conversion, a successful manual archive/replay-floor transition, concurrency race orderings or physical devices. Use separate synthetic Legacy users and the UI acceptance steps below. For manual archive acceptance, download/reread the archive, explicitly approve, verify current records/tombstones/initial receipt remain, same-floor retired requests remain fenced, and older requests require replay-floor re-review.

For the owner-operated UI session, use a separate browser profile and terminal with only Test Project configuration (never the Production site). Set these process variables for the local preview server; do not change `.env.example` or publish this build:

```powershell
$env:VITE_ACCOUNT_CLOUD_V2 = 'preview'
$env:VITE_SUPABASE_URL = Read-Host 'Verified disposable API URL'
$env:VITE_SUPABASE_PUBLISHABLE_KEY = Read-Host 'Disposable publishable API key (public client key only)'
try { npm.cmd run dev -- --port 5178 --strictPort }
finally {
  Remove-Item Env:VITE_ACCOUNT_CLOUD_V2,Env:VITE_SUPABASE_URL,Env:VITE_SUPABASE_PUBLISHABLE_KEY -ErrorAction SilentlyContinue
}
```

Ordinary HTTP LAN access cannot establish secure-context/Web Crypto/PWA acceptance. Physical iPhone acceptance requires an owner-approved isolated HTTPS preview configured only for this disposable project; it has not been deployed in this pass. Leave Production and the repository's default flag unchanged.

## Rollout/rollback

The missing-migration UI fails closed. Production explicitly enables the build flag; changing a frontend flag cannot undo conversion. Converted accounts reject old-client cloud writes. Frontend rollback does not remove that fence. Keep both schemas and original local Vaults; recover with reviewed exports and forward fixes. Never disable fences, reset accounts or drop new data to make old clients succeed. The previous Worker version is recorded above for an owner-reviewed frontend rollback; this is not database rollback, and migrated users must retain recovery access. Do not deploy the old app blindly over already converted accounts.

## Prospective Windows → iPhone acceptance

After completing missing work:

1. New invited sign-in acknowledges storage once, enters automatic sync without a routine passphrase.
2. Decline/cancel Guest transfer; verify unchanged Guest bytes and offline use.
3. Review five duplicates with suffixes, overlaps, many-to-many and Drafts; test single/bulk/manual/separate decisions and two/additional approvals.
4. Interrupt before upload, after server commit and before verification; resume without duplicates/false completion.
5. Concurrent Windows/iPhone edits invalidate stale merge decisions, preserving both versions.
6. In the disposable preview build, choose Review and convert Legacy Vault. Test local-only, cloud-only, identical, divergent and privacy-only accounts; supply separate passphrases where needed. Review each difference, stage an actual Manual Edit, download/reread the complete backup, accept the server-readable/plaintext-cache disclosure and confirm. Interrupt the request and resume with the same operation UUID. Verify destination links, disabled settings, original ciphertext/key hashes and old-device cloud-write fencing. Test stale revisions, invalid references and wrong-account recovery files; all must stop safely. Do not erase browser storage to simulate recovery without first retaining the approved plaintext recovery plan and independent backup. Before approval a reload requires re-unlock/re-review; after approval it restores the saved request. Restore exported plans explicitly, never by bypassing consent or the receipt guard.
7. Repeat separately in iPhone Safari and installed PWA with keyboard, short heights, safe areas and offline restart. No real-device pass has been performed.

## Working-tree manifest and actual verification

Current work spans `src/auth`, `src/cloud`, `src/migration`, selected editor components, the additive SQL migration, deployment guard scripts, tests and this documentation. Use `git status --short` for the exact current file list. The package remains 0.8.3; no release commit, push or deployment is authorized.

Current local verification (Legacy conversion, 2026-10-29 HKT): focused Legacy/source/Account-entry checks passed 33 tests / 3 files; TypeScript and targeted lint passed. The single final npm.cmd run check:release passed 660 tests / 59 files, lint, TypeScript/Vite build, static gate and formatting. The build retains a non-fatal bundle-size warning. Disposable embedded PostgreSQL passed 30 scenario groups, including manifest coverage, exact legacy revision, original ciphertext/key preservation, conversion activation, old-client fencing, account isolation and the previously completed receipt/archive safeguards. No SQL migration changed in this pass; the existing six-file order above still applies.

New tests exercise local-only/cloud-only/identical/divergent and privacy-only sources, separate passphrases, per-record/manual reconciliation through the actual Handling editor, retained conflict alternatives, tombstones, unchanged linked IDs, incorrect consent/readback, corrupt ciphertext, invalid references, durable interruption/lost acknowledgements, activation retry, changed revisions and account fencing. React integration verifies source inspection, actual File readback and final destination activation without legacy writes. The new Legacy screen reuses responsive review styles; no new browser-layout or physical-device pass is claimed. Earlier 1440x900/390x640 Edge screenshots apply to Mixed-Queue Recovery only and were not repeated. Ignored checkpoint fixtures remain available for reproduction and are not bundled. The guarded hosted REST runner remains unexecuted.

Historical implementation-pass verdict: both Mixed-Queue and supported-format Legacy conversion P0 blockers were locally resolved while Production remained NO-GO and package/defaults stayed 0.8.3 / false. This verdict is superseded by the owner-confirmed hosted/migration/backup gates and explicit v0.9.0 release approval at the beginning of this document. Deferred physical-device/near-limit checks remain unclaimed.

Hosted-readiness preparation: no SQL/application implementation changed and the full release gate was not repeated. The runner now requires an explicit Production deny-list reference, rejects privileged/foreign/expired user-token claims before requests, and checks complete empty initial snapshots before mutations. Its five mocked guard tests and targeted lint passed. Isolated synthetic Edge verified the new Legacy review at 1440x900 and 390x640: readable comparison, no horizontal overflow, expected responsive columns, real editor entry/discard dismissal, actual saved-file readback, consent plus final confirmation, scroll reachability and verified conversion preserving Guest and original encrypted bytes. New Legacy screenshots were inspected. The existing Guest/Mixed Manual Edit flow also passed at both widths without recapturing prior screenshots. History UI was unchanged and was not repeated. No hosted SQL/API, real-device pass, deployment or Production access occurred.
