# Deploying the widget via GitHub Pages

End-to-end setup to host this Zoho CRM widget on GitHub Pages and register it
inside a Zoho CRM org. Follow it top-to-bottom for a fresh install; jump to
the relevant section when something breaks.

## 1. Architecture

```
┌─────────────┐   git push    ┌──────────────────┐   upload-pages-artifact   ┌────────────────┐
│  developer  │ ────────────▶ │ GitHub Actions   │ ────────────────────────▶ │ GitHub Pages   │
└─────────────┘               │ (deploy-pages.yml)│                           │  /widget.html  │
                              │  • npm ci         │                           │  /js/bundle.js │
                              │  • webpack build  │                           └───────┬────────┘
                              └──────────────────┘                                    │ HTTPS
                                                                                      ▼
                                                                            ┌──────────────────┐
                                                                            │ Zoho CRM Widget  │
                                                                            │  (web.tab)       │
                                                                            │  loads widget    │
                                                                            │  via hosted URL  │
                                                                            └──────────────────┘
```

- React app is bundled by webpack into `app/widget.html` + `app/js/bundle.js`.
- GitHub Actions builds on every push to `main` and uploads `app/` as the
  Pages artifact. Pages serves it at `https://<user>.github.io/<repo>/`.
- `plugin-manifest.json` tells Zoho CRM where the widget HTML lives and
  registers it as a tab inside the Deal record (or wherever `location`
  points).

## 2. Prerequisites

- A GitHub account/org that can host public Pages (or a private repo with a
  Pages-enabled plan).
- Node.js 20.x and npm 10.x for local builds.
- A Zoho CRM org where you have **Manage Extensibility** permission (admin or
  developer profile).
- Your Deals module field schema must include every field referenced by the
  widget — see [§7](#7-required-zoho-field-schema).

## 3. Repository layout

| Path | Purpose |
| --- | --- |
| `src/` | React source. Entry: `src/index.jsx`. |
| `app/widget.html` | Static shell that loads the Zoho JS SDK and the bundle. Committed to git. |
| `app/js/bundle.js` | Webpack build output. **Not committed** (in `.gitignore`); produced by CI. |
| `webpack.config.js` | Bundles `src/index.jsx` to `app/js/bundle.js`. |
| `plugin-manifest.json` | Zoho widget manifest. The `widgets[0].url` points to `/app/widget.html`. |
| `.github/workflows/deploy-pages.yml` | CI: build + upload artifact + deploy Pages. |
| `src/utils/constants.js` | Module + field API names used in COQL queries. |
| `src/utils/zohoApi.js` | Thin wrappers around `ZOHO.CRM.API.coql`, `getRecord`, `FUNCTIONS.execute`. |

## 4. GitHub Pages setup

This is the part that traps people. Pages must deploy from the **Actions
workflow**, not from a branch — otherwise Pages serves the raw repo (which
doesn't contain the built `bundle.js`, since it's git-ignored).

1. In the repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Confirm the workflow file at `.github/workflows/deploy-pages.yml` lists
   the branches you want auto-deployed (currently `main`). Pushing to that
   branch triggers a build.

The workflow:

```yaml
name: Deploy widget to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: npm }
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
        with: { enablement: true }
      - uses: actions/upload-pages-artifact@v3
        with: { path: app }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

`enablement: true` on `actions/configure-pages` auto-enables Pages on first
run, so you don't have to click "Enable Pages" by hand if the repo is brand
new.

After the first successful run the live URL appears in the **deploy** job's
`page_url` output and on the deployment card on the right sidebar of the
repo home.

Expected URL pattern: `https://<owner>.github.io/<repo>/widget.html` —
served from `app/widget.html` because the artifact root is `app/`.

## 5. Zoho widget registration

`plugin-manifest.json` declares the widget. The relevant fields:

```json
{
  "service": "CRM",
  "modules": {
    "widgets": [
      {
        "url": "/app/widget.html",
        "name": "Envia Shipping Labels",
        "location": "web.tab",
        "description": "..."
      }
    ]
  }
}
```

To package and upload:

```bash
npm run build         # produces app/js/bundle.js locally
npx zet pack          # produces a .zip ready for Zoho
```

Then in Zoho:

1. Go to **Setup → Developer Hub → Extensions for Zoho CRM**.
2. Click **+ Create Extension** (first time) or open the existing extension.
3. Upload the `.zip` from `npm run pack`.
4. Set the **Hosted URL** for the widget to your GitHub Pages URL, e.g.
   `https://antoniocf5.github.io/generador-guias-krea/widget.html`. This is
   what tells Zoho to load the live (Pages) bundle instead of files inside
   the zip — and it's what makes "push to main = update widget" work without
   re-uploading the extension.
5. Install the extension in your org and grant the requested scopes.

After install, the widget appears wherever `location` says — for `web.tab`,
it shows up as a tab/button in the Deal detail page.

## 6. Local development

```bash
npm install
npm run dev        # webpack --watch, outputs to app/js/bundle.js
npm start          # local HTTPS server (server/index.js) for ZET preview
```

`npx zet validate` checks the manifest before packaging.

## 7. Required Zoho field schema

The deals-list COQL selects the following fields from the **Deals** module.
Every one must exist with the listed API name or the query fails with
`column given seems to be invalid`.

| API name | Type | Notes |
| --- | --- | --- |
| `id` | system | always present |
| `Deal_Name` | system | |
| `Stage` | system picklist | |
| `Contact_Name` | system lookup | |
| `Modified_Time` | system datetime | |
| `Amount` | system currency | |
| `Closing_Date` | system date | |
| `Ciudad` | single-line text | shipping city |
| `Estado` | single-line text | shipping state |
| `Codigo_Postal` | single-line text | shipping ZIP |
| `Calle_y_Numero` | single-line text | street + number |
| `Colonia` | single-line text | neighborhood |
| `Notas_Extra_de_Entrega` | multi-line text | delivery notes |
| `Numero_de_Guia` | single-line text | tracking number |
| `Paqueteria` | picklist | carrier name |
| `Envia_Label_URL` | URL or text | label PDF URL |
| `Envia_Shipment_Status` | picklist | status filter |

`Envia_Shipment_Status` picklist values must match the keys in
`src/utils/constants.js → SHIPMENT_STATUS`:

```
Pending, Quoted, Generated, In_Transit, Delivered, Cancelled
```

The downstream label-generation flow also expects (create them when you
implement quoting/labeling):

- `Package_Weight_Kg` (decimal)
- `Package_Length_Cm`, `Package_Width_Cm`, `Package_Height_Cm` (decimal)
- `Package_Content_Description` (single-line text)
- `Package_Declared_Value` (currency)
- `Envia_Shipment_ID` (single-line text)
- `Envia_Service` (single-line text)
- `Envia_Label_Generated_At` (datetime)
- `Envia_Shipping_Cost` (currency)

If you map to existing fields with different names instead of creating new
ones, update `src/utils/constants.js → DEAL_FIELDS` to point at the existing
API names.

## 8. Deploy flow

1. `git push origin main`.
2. Watch **Actions** tab — `Deploy widget to GitHub Pages` should go green
   in ~1 minute.
3. The `deploy` job prints `page_url` — open `<page_url>widget.html` to
   smoke-test the static load.
4. Reload the widget inside Zoho CRM. Hard-reload (Cmd/Ctrl+Shift+R) to
   bypass browser cache; GitHub Pages serves bundles with `Cache-Control:
   max-age=600` (10 min) by default, so a normal reload may serve the old
   bundle for up to 10 minutes.

## 9. Common errors and fixes

### `404 File not found` on `/widget.html`

Pages is set to deploy from a branch, not from the workflow. Switch the
source to **GitHub Actions** (see [§4](#4-github-pages-setup)) and re-run
the workflow.

A temporary workaround is to load `/app/widget.html` instead of
`/widget.html` — that path exists when Pages serves the repo root — but
`bundle.js` won't be there (gitignored), so the page renders blank.

### Page loads but body is empty in Zoho

`bundle.js` failed to load. Open DevTools → Network and look for a 404 on
`js/bundle.js`. Causes:

- Pages source is "Deploy from a branch": the build never ran, so
  `app/js/bundle.js` is missing. Same fix as above.
- The build job failed: check the latest workflow run.

### `column given seems to be invalid`

A field listed in `COQL_FIELDS` (in `src/hooks/useDealsList.js`) doesn't
exist on the Deals module. Check the field's API name in
**Setup → Modules and Fields → Deals → API names** and either rename in
Zoho or update `src/utils/constants.js` to match.

### `value given seems to be invalid for the column`

A COQL value doesn't match the column's data type. Most common cause: using
`!= null` on a date/datetime/lookup column. Switch to `is not null`. The
deals list's filter uses `Modified_Time is not null` for this reason.

### Widget loads stale code after a deploy

Browser or Pages cache. Hard-reload, or change the bundle URL to bust
the cache (e.g. add `?v=<commit-sha>` to the script tag in
`app/widget.html` and let CI rewrite it). Default Pages cache is 10 min.

## 10. Useful links

- Live widget: `https://<owner>.github.io/<repo>/widget.html`
- Pages settings: `https://github.com/<owner>/<repo>/settings/pages`
- Actions: `https://github.com/<owner>/<repo>/actions`
- Zoho Developer Hub: <https://crm.zoho.com/crm/DeveloperHub>
- Zoho widget SDK reference: <https://help.zoho.com/portal/en/kb/crm/developer-guide/sdks/javascript-embedded-app-sdk>
- COQL reference: <https://www.zoho.com/crm/developer/docs/api/v8/COQL-Overview.html>
