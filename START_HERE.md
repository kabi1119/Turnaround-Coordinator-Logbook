# TCO Logbook Prototype v0.1 — local Codex handoff

## Unzip into your **existing** project directory

    C:\Projects\TCO-Logbook\
      AGENTS.md
      docs\
        TCO_Logbook_PRD_v1.5_APPROVED.md
        Codex_Prototype_v0.1_Prompt.md

The repository already exists and Git has been initialized. Do **not** initialize a second Git repository.

## Start Codex in VS Code

1. Open `C:\Projects\TCO-Logbook` as the folder in VS Code.
2. Open the Codex extension and set your preferred coding model/effort (the earlier tentative choice was Sol + High; use what your extension actually offers).
3. Select a mode that allows authorized file/terminal operations. Check requests to install packages and approve normal local actions as appropriate. Never grant secrets or cloud account access for this prototype.
4. Paste:

> Please implement the **TCO Logbook interactive prototype v0.1** in this existing repository. First read `AGENTS.md`, `docs/TCO_Logbook_PRD_v1.5_APPROVED.md`, and `docs/Codex_Prototype_v0.1_Prompt.md` completely. Give me a short milestone plan, then build the app as instructed. Use synthetic demo data only. Do not implement or deploy a real backend, authentication or cloud sync. Run tests/build/lint; show me exactly how to start the site with `npm run dev`, and report remaining prototype limitations.

5. When Codex says to test, use VS Code Terminal:

    npm.cmd run dev

Then open the local address printed by Vite (often http://localhost:5173/).

## Note on iPhone testing
An iPhone cannot open your Windows `localhost` directly. A same-Wi-Fi LAN preview may work after explicit local server configuration and Windows firewall approval; full PWA installation/offline scenarios normally require a suitable HTTPS origin, and remain outside the first local test unless set up separately.

## Data
Only fake demo data. Do not enter real work data; cloud backup/sync and company-policy checks are deferred.
