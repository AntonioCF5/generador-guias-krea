# Plan: New Zoho CRM Widget — Envia.com Shipping Labels

> This MD file is the bootstrap prompt for Claude Code in a **NEW empty repository**. It contains everything needed to scaffold a Zoho CRM widget that quotes shipping rates and generates labels via Envia.com, mirroring the architecture of `citas-krea-studio`.

---

## 0. Objective

Build a Zoho CRM `web.tab` widget that, from a single Deal:
1. Reads shipping address + package data.
2. Quotes shipping rates from multiple carriers via **Envia.com**.
3. Generates a shipping label and persists label/tracking metadata back on the Deal.

**Architectural rules (FIXED):**
- Envia is called from a **Zoho Deluge Function** (server-side). The widget NEVER calls `api.envia.com` from the browser.
- Widget location: `web.tab` on the Deals module.
- Storage: new custom fields directly on the Deals module (no new module, no PDF attachment generation in the widget — the label PDF lives at the URL Envia returns).

---

## 1. Tech Stack (mirror of `citas-krea-studio`)

- **React 18.3.1** (no router, no UI library, no form library, no HTTP client)
- **Webpack 5** + **Babel 7** with `@babel/preset-react` (automatic JSX runtime)
- **Express 5** HTTPS dev server on port `9000` with `selfsigned` cert
- **zoho-extension-toolkit** (`zet`) for `validate` and `pack`
- **Zoho Embedded App SDK** loaded from CDN: `https://live.zwidgets.com/js-sdk/1.5/ZohoEmbededAppSDK.min.js`
- `webpack externals: { ZOHO: "ZOHO" }` so the SDK is not bundled
- Pure CSS with design tokens (`:root` variables); BEM-ish class names
- State: React hooks only. No Redux/Zustand/Context.
- HTTP: ONLY `ZOHO.CRM.API.*` and `ZOHO.CRM.FUNCTIONS.execute`. No fetch/axios anywhere in the widget.

---

## 2. Repo Name & Folder Structure

**Suggested name:** `envia-krea-shipping`

```
envia-krea-shipping/
├── app/
│   └── widget.html
├── server/
│   └── index.js
├── src/
│   ├── index.jsx
│   ├── App.jsx
│   ├── styles.css
│   ├── components/
│   │   ├── DealDetail.jsx
│   │   ├── DealHeader.jsx
│   │   ├── ShippingAddressForm.jsx
│   │   ├── PackageForm.jsx
│   │   ├── RatesPanel.jsx
│   │   ├── GenerateLabelButton.jsx
│   │   └── ShipmentStatusCard.jsx
│   ├── hooks/
│   │   └── useDeal.js
│   └── utils/
│       ├── constants.js
│       ├── zohoApi.js
│       ├── envia.js
│       └── formatters.js
├── docs/
│   └── ENVIA_FUNCTIONS.md
├── plugin-manifest.json
├── webpack.config.js
├── babel.config.json
├── package.json
├── .gitignore
└── README.md
```

`.gitignore`: `node_modules/`, `dist/`, `app/js/`, `*.log`, `.DS_Store`, `ZET-debug.log`, `tmp-*.pem`.

---

## 3. Bootstrap Files (verbatim — copy as-is)

### 3.1 `package.json`

```json
{
  "name": "envia-krea-shipping",
  "version": "1.0.0",
  "description": "Widget de Zoho CRM para cotizar y generar guías de envío con Envia.com desde un Deal.",
  "scripts": {
    "dev": "npx webpack --mode development --watch",
    "build": "npx webpack --mode production",
    "start": "node server/index.js",
    "validate": "npx zet validate",
    "pack": "npm run build && npx zet pack"
  },
  "dependencies": {
    "express": "^5.2.1",
    "portfinder": "^1.0.25",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@babel/core": "^7.26.0",
    "@babel/preset-env": "^7.26.0",
    "@babel/preset-react": "^7.26.3",
    "babel-loader": "^9.2.1",
    "css-loader": "^7.1.2",
    "selfsigned": "^2.4.1",
    "style-loader": "^4.0.0",
    "webpack": "^5.97.0",
    "webpack-cli": "^6.0.1",
    "zoho-extension-toolkit": "latest"
  }
}
```

> `pdf-lib` was removed from the source repo's deps — this widget does not generate PDFs (Envia returns the label URL).

### 3.2 `webpack.config.js`

```js
const path = require("path");

module.exports = {
  entry: "./src/index.jsx",
  output: {
    path: path.resolve(__dirname, "app"),
    filename: "js/bundle.js",
  },
  module: {
    rules: [
      { test: /\.jsx?$/, exclude: /node_modules/, use: "babel-loader" },
      { test: /\.css$/, use: ["style-loader", "css-loader"] },
    ],
  },
  resolve: { extensions: [".js", ".jsx"] },
  externals: { ZOHO: "ZOHO" },
};
```

### 3.3 `babel.config.json`

```json
{
  "presets": [
    "@babel/preset-env",
    ["@babel/preset-react", { "runtime": "automatic" }]
  ]
}
```

### 3.4 `server/index.js`

```js
const path = require("path");
const express = require("express");
const https = require("https");

const app = express();
const PORT = 9000;
const appDir = path.join(__dirname, "..", "app");

app.get("/", (req, res) => {
  res.sendFile(path.join(appDir, "widget.html"));
});
app.use(express.static(appDir));

let serverOptions;
try {
  const selfsigned = require("selfsigned");
  const pems = selfsigned.generate(
    [{ name: "commonName", value: "127.0.0.1" }],
    { days: 365 }
  );
  serverOptions = { key: pems.private, cert: pems.cert };
} catch {
  const { execSync } = require("child_process");
  const fs = require("fs");
  const tmpKey = path.join(__dirname, "tmp-key.pem");
  const tmpCert = path.join(__dirname, "tmp-cert.pem");
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout ${tmpKey} -out ${tmpCert} -days 365 -nodes -subj "/CN=127.0.0.1"`
  );
  serverOptions = {
    key: fs.readFileSync(tmpKey),
    cert: fs.readFileSync(tmpCert),
  };
  fs.unlinkSync(tmpKey);
  fs.unlinkSync(tmpCert);
}

https.createServer(serverOptions, app).listen(PORT, "127.0.0.1", () => {
  console.log(`Widget server running at https://127.0.0.1:${PORT}`);
});
```

### 3.5 `plugin-manifest.json`

```json
{
  "service": "CRM",
  "cspDomains": {
    "connect-src": [],
    "img-src": [],
    "script-src": [],
    "style-src": [],
    "font-src": []
  },
  "modules": {
    "widgets": [
      {
        "url": "/app/widget.html",
        "name": "Envia Shipping Labels",
        "location": "web.tab",
        "description": "Cotiza envíos y genera guías con Envia.com directamente desde el Deal."
      }
    ]
  },
  "config": [],
  "whiteListedDomains": []
}
```

> **CSP / whitelist note:** the widget calls Envia exclusively through `ZOHO.CRM.FUNCTIONS.execute`. There is **no** browser-side request to `api.envia.com`, so `whiteListedDomains` and `cspDomains.connect-src` stay empty. The label URL returned by Envia is opened with `window.open(...)`, which doesn't require CSP entries.

### 3.6 `app/widget.html`

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Envia Shipping Labels</title>
  <script src="https://live.zwidgets.com/js-sdk/1.5/ZohoEmbededAppSDK.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script src="js/bundle.js"></script>
</body>
</html>
```

### 3.7 `src/index.jsx`

```jsx
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

/* global ZOHO */

ZOHO.embeddedApp.on("PageLoad", function (pageData) {
  const root = createRoot(document.getElementById("root"));
  root.render(<App pageData={pageData || {}} />);
});

ZOHO.embeddedApp.init();
```

### 3.8 `src/App.jsx`

```jsx
import DealDetail from "./components/DealDetail";

export default function App({ pageData }) {
  const recordId = pageData?.EntityId || null;
  if (!recordId) {
    return (
      <div className="app empty">
        <h2>No hay Deal seleccionado</h2>
        <p>Abre este widget desde la pestaña web dentro de un Deal.</p>
      </div>
    );
  }
  return (
    <div className="app">
      <DealDetail recordId={recordId} />
    </div>
  );
}
```

---

## 4. CRM Knowledge — Modules, Fields, Picklists

### 4.1 Modules used

| Module API name | Purpose                                  |
|-----------------|------------------------------------------|
| `Deals`         | Source of address, package, label data   |
| `Contacts`      | Recipient phone & email (lookup target)  |

### 4.2 Existing Deal fields consumed (already in the Krea org — DO NOT recreate)

| API name              | Type        | Notes                              |
|-----------------------|-------------|------------------------------------|
| `Deal_Name`           | Single Line | Used as recipient name fallback    |
| `Stage`               | Picklist    | Read-only here                     |
| `Contact_Name`        | Lookup→Contacts | Used to fetch phone & email    |
| `Calle_y_Numero`      | Single Line | Street + number                    |
| `Colonia`             | Single Line | Neighborhood / district            |
| `Codigo_Postal`       | Single Line | ZIP                                |
| `Ciudad`              | Single Line | City                               |
| `Estado`              | Picklist    | 32 Mexican states (see list below) |
| `Notas_Extra_de_Entrega` | Multi Line | Optional delivery notes          |

### 4.3 Existing Contact fields consumed

| API name      | Type        |
|---------------|-------------|
| `First_Name`  | Single Line |
| `Last_Name`   | Single Line |
| `Full_Name`   | Formula     |
| `Phone`       | Phone       |
| `Email`       | Email       |

### 4.4 NEW Deal fields the user MUST create (CRM Field Setup Checklist)

Crear en **Setup → Customization → Modules and Fields → Deals**:

| Field label                 | API name                       | Type            | Notes / Picklist values |
|-----------------------------|--------------------------------|-----------------|-------------------------|
| Package Weight (kg)         | `Package_Weight_Kg`            | Decimal         | 2 decimals              |
| Package Length (cm)         | `Package_Length_Cm`            | Decimal         | 1 decimal               |
| Package Width (cm)          | `Package_Width_Cm`             | Decimal         | 1 decimal               |
| Package Height (cm)         | `Package_Height_Cm`            | Decimal         | 1 decimal               |
| Package Content Description | `Package_Content_Description`  | Single Line     | 255 chars               |
| Package Declared Value      | `Package_Declared_Value`       | Currency (MXN)  |                         |
| Envia Shipment ID           | `Envia_Shipment_ID`            | Single Line     |                         |
| Envia Tracking Number       | `Envia_Tracking_Number`        | Single Line     |                         |
| Envia Carrier               | `Envia_Carrier`                | Single Line     |                         |
| Envia Service               | `Envia_Service`                | Single Line     |                         |
| Envia Label URL             | `Envia_Label_URL`              | Multi-Line      | NOT a URL field — COQL silently drops URL-type columns, so the deals list would never see the value. Use Multi-Line. |
| Envia Label Generated At    | `Envia_Label_Generated_At`     | Date/Time       |                         |
| Envia Shipping Cost         | `Envia_Shipping_Cost`          | Currency (MXN)  |                         |
| Envia Shipment Status       | `Envia_Shipment_Status`        | Picklist        | `Pending`, `Quoted`, `Generated`, `In_Transit`, `Delivered`, `Cancelled` |

> Confirm each `api_name` after Zoho saves them — Zoho sometimes appends suffixes for collisions. If so, only `src/utils/constants.js → DEAL_FIELDS` needs adjustment.

### 4.5 ESTADOS_MEXICO (used for the `Estado` select)

`Aguascalientes, Baja California, Baja California Sur, Campeche, Chiapas, Chihuahua, Ciudad de México, Coahuila, Colima, Durango, Estado de México, Guanajuato, Guerrero, Hidalgo, Jalisco, Michoacán, Morelos, Nayarit, Nuevo León, Oaxaca, Puebla, Querétaro, Quintana Roo, San Luis Potosí, Sinaloa, Sonora, Tabasco, Tamaulipas, Tlaxcala, Veracruz, Yucatán, Zacatecas`

---

## 5. Source Files

### 5.1 `src/utils/constants.js`

```js
export const MODULES = {
  DEALS: "Deals",
  CONTACTS: "Contacts",
};

export const DEAL_FIELDS = {
  ID: "id",
  NAME: "Deal_Name",
  STAGE: "Stage",
  CONTACT: "Contact_Name",

  // Existing shipping address fields
  CALLE_Y_NUMERO: "Calle_y_Numero",
  COLONIA: "Colonia",
  CODIGO_POSTAL: "Codigo_Postal",
  CIUDAD: "Ciudad",
  ESTADO: "Estado",
  NOTAS_ENTREGA: "Notas_Extra_de_Entrega",

  // NEW package fields
  PACKAGE_WEIGHT_KG: "Package_Weight_Kg",
  PACKAGE_LENGTH_CM: "Package_Length_Cm",
  PACKAGE_WIDTH_CM: "Package_Width_Cm",
  PACKAGE_HEIGHT_CM: "Package_Height_Cm",
  PACKAGE_CONTENT: "Package_Content_Description",
  PACKAGE_DECLARED_VALUE: "Package_Declared_Value",

  // NEW Envia shipment metadata
  ENVIA_SHIPMENT_ID: "Envia_Shipment_ID",
  ENVIA_TRACKING_NUMBER: "Envia_Tracking_Number",
  ENVIA_CARRIER: "Envia_Carrier",
  ENVIA_SERVICE: "Envia_Service",
  ENVIA_LABEL_URL: "Envia_Label_URL",
  ENVIA_LABEL_GENERATED_AT: "Envia_Label_Generated_At",
  ENVIA_SHIPMENT_STATUS: "Envia_Shipment_Status",
  ENVIA_SHIPPING_COST: "Envia_Shipping_Cost",
};

export const CONTACT_FIELDS = {
  ID: "id",
  FIRST_NAME: "First_Name",
  LAST_NAME: "Last_Name",
  FULL_NAME: "Full_Name",
  PHONE: "Phone",
  EMAIL: "Email",
};

export const ESTADOS_MEXICO = [
  "Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas",
  "Chihuahua","Ciudad de México","Coahuila","Colima","Durango","Estado de México",
  "Guanajuato","Guerrero","Hidalgo","Jalisco","Michoacán","Morelos","Nayarit",
  "Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí",
  "Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán",
  "Zacatecas",
];

export const SHIPPING_FIELDS = [
  { key: "CALLE_Y_NUMERO", label: "Calle y número", required: true, type: "text" },
  { key: "COLONIA", label: "Colonia", required: true, type: "text" },
  { key: "CODIGO_POSTAL", label: "Código postal", required: true, type: "text" },
  { key: "CIUDAD", label: "Ciudad", required: true, type: "text" },
  { key: "ESTADO", label: "Estado", required: true, type: "select", options: ESTADOS_MEXICO },
  { key: "NOTAS_ENTREGA", label: "Notas extra de entrega", required: false, type: "textarea" },
];

export const PACKAGE_FIELDS_DEF = [
  { key: "PACKAGE_WEIGHT_KG", label: "Peso (kg)", required: true, type: "number", step: 0.1, min: 0.1 },
  { key: "PACKAGE_LENGTH_CM", label: "Largo (cm)", required: true, type: "number", step: 0.1, min: 1 },
  { key: "PACKAGE_WIDTH_CM", label: "Ancho (cm)", required: true, type: "number", step: 0.1, min: 1 },
  { key: "PACKAGE_HEIGHT_CM", label: "Alto (cm)", required: true, type: "number", step: 0.1, min: 1 },
  { key: "PACKAGE_CONTENT", label: "Descripción del contenido", required: true, type: "text" },
  { key: "PACKAGE_DECLARED_VALUE", label: "Valor declarado (MXN)", required: false, type: "currency" },
];

export const SHIPMENT_STATUS = {
  PENDING: "Pending",
  QUOTED: "Quoted",
  GENERATED: "Generated",
  IN_TRANSIT: "In_Transit",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const ENVIA = {
  FUNCTION_NAME_RATES: "krea_envia_get_rates",
  FUNCTION_NAME_LABEL: "krea_envia_generate_label",
  DEFAULT_COUNTRY: "MX",
  DEFAULT_CURRENCY: "MXN",
  PRINT_FORMAT: "pdf",
  PRINT_SIZE: "stock_4x6",
  SHIPMENT_TYPE: 1, // 1 = paquete (Envia)
};

// Origen (warehouse / store). Hardcoded — replace with the real values.
export const SENDER = {
  name: "Krea Studio",
  company: "Krea Studio",
  email: "envios@kreastudio.mx",
  phone: "5500000000",
  street: "Av. Principal 123",
  number: "123",
  district: "Centro",
  city: "Ciudad de México",
  state: "CMX",          // Envia state code — verify against Envia's table
  country: "MX",
  postalCode: "01000",
  reference: "Almacén Krea",
};

export const DEBOUNCE_MS = 500;
```

### 5.2 `src/utils/zohoApi.js`

```js
/* global ZOHO */
import { MODULES } from "./constants";

export function normalizeError(err, fallback = "Ocurrió un error inesperado") {
  if (err instanceof Error) return err;
  const message =
    typeof err === "string"
      ? err
      : err?.message || err?.error || err?.data?.[0]?.message ||
        err?.statusText || JSON.stringify(err);
  const e = new Error(message || fallback);
  e.originalError = err;
  return e;
}

export async function getDeal(recordId) {
  const res = await ZOHO.CRM.API.getRecord({ Entity: MODULES.DEALS, RecordID: recordId });
  return res?.data?.[0] ?? null;
}

export async function getContact(contactId) {
  const res = await ZOHO.CRM.API.getRecord({ Entity: MODULES.CONTACTS, RecordID: contactId });
  return res?.data?.[0] ?? null;
}

export async function updateDeal(recordId, apiData, { suppressTriggers = true } = {}) {
  const payload = { Entity: MODULES.DEALS, APIData: { id: recordId, ...apiData } };
  if (suppressTriggers) payload.Trigger = [];
  return ZOHO.CRM.API.updateRecord(payload);
}

export async function executeFunction(funcName, args = {}) {
  return ZOHO.CRM.FUNCTIONS.execute(funcName, { arguments: JSON.stringify(args) });
}
```

### 5.3 `src/utils/envia.js`

```js
import { CONTACT_FIELDS, DEAL_FIELDS, ENVIA, SENDER } from "./constants";
import { executeFunction } from "./zohoApi";

function destination(deal, contact) {
  return {
    name: deal?.[DEAL_FIELDS.NAME] || "Cliente",
    company: deal?.[DEAL_FIELDS.NAME] || "",
    email: contact?.[CONTACT_FIELDS.EMAIL] || "",
    phone: contact?.[CONTACT_FIELDS.PHONE] || "",
    street: deal?.[DEAL_FIELDS.CALLE_Y_NUMERO] || "",
    number: "",
    district: deal?.[DEAL_FIELDS.COLONIA] || "",
    city: deal?.[DEAL_FIELDS.CIUDAD] || "",
    state: deal?.[DEAL_FIELDS.ESTADO] || "",
    country: ENVIA.DEFAULT_COUNTRY,
    postalCode: deal?.[DEAL_FIELDS.CODIGO_POSTAL] || "",
    reference: deal?.[DEAL_FIELDS.NOTAS_ENTREGA] || "",
  };
}

function origin() {
  return { ...SENDER };
}

function packagesFromDeal(deal) {
  const w = Number(deal?.[DEAL_FIELDS.PACKAGE_WEIGHT_KG]) || 1;
  const L = Number(deal?.[DEAL_FIELDS.PACKAGE_LENGTH_CM]) || 30;
  const W = Number(deal?.[DEAL_FIELDS.PACKAGE_WIDTH_CM]) || 20;
  const H = Number(deal?.[DEAL_FIELDS.PACKAGE_HEIGHT_CM]) || 10;
  const declaredValue = Number(deal?.[DEAL_FIELDS.PACKAGE_DECLARED_VALUE]) || 0;
  const content = deal?.[DEAL_FIELDS.PACKAGE_CONTENT] || "Mercancía general";
  return [{
    content,
    amount: 1,
    type: "box",
    weight: w,
    insurance: declaredValue,
    declaredValue,
    weightUnit: "KG",
    lengthUnit: "CM",
    dimensions: { length: L, width: W, height: H },
  }];
}

export function buildRatePayload({ deal, contact }) {
  return {
    origin: origin(),
    destination: destination(deal, contact),
    packages: packagesFromDeal(deal),
    shipment: { type: ENVIA.SHIPMENT_TYPE },
    settings: { currency: ENVIA.DEFAULT_CURRENCY },
  };
}

export function buildLabelPayload({ deal, contact, selectedRate }) {
  return {
    origin: origin(),
    destination: destination(deal, contact),
    packages: packagesFromDeal(deal),
    shipment: {
      carrier: selectedRate.carrier,
      service: selectedRate.service,
      type: ENVIA.SHIPMENT_TYPE,
    },
    settings: {
      printFormat: ENVIA.PRINT_FORMAT,
      printSize: ENVIA.PRINT_SIZE,
      currency: ENVIA.DEFAULT_CURRENCY,
    },
  };
}

function parseOutput(res) {
  const raw = res?.details?.output ?? res?.output ?? res;
  if (raw == null) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return { raw }; }
  }
  return raw;
}

export async function getRates({ deal, contact }) {
  const payload = buildRatePayload({ deal, contact });
  const res = await executeFunction(ENVIA.FUNCTION_NAME_RATES, {
    rate_input: JSON.stringify(payload),
  });
  return parseOutput(res);
}

export async function generateLabel({ deal, contact, selectedRate }) {
  const payload = buildLabelPayload({ deal, contact, selectedRate });
  const res = await executeFunction(ENVIA.FUNCTION_NAME_LABEL, {
    label_input: JSON.stringify(payload),
    deal_id: deal?.id || "",
  });
  return parseOutput(res);
}
```

### 5.4 `src/hooks/useDeal.js`

Same pattern as `citas-krea-studio/src/hooks/useDeal.js`:

- `useEffect` on mount: `getDeal(recordId)` → `setDeal`.
- Exposes: `{ deal, loading, error, setError, patchDeal, reload }`.
- `patchDeal(partial)` merges into local state without server call.
- `reload()` re-fetches from Zoho (use after `updateDeal` if formula fields are needed).

### 5.5 Components (high-level specs)

#### `DealDetail.jsx`
- Loads `deal` via `useDeal(recordId)`. Once loaded, fetches `contact` via `getContact(deal.Contact_Name.id)`.
- Owns: `selectedRate`, `rates`, `feedback {kind,text}`, `isSaving`.
- Renders, in order:
  1. `DealHeader`
  2. `ShippingAddressForm`
  3. `PackageForm`
  4. "Guardar cambios" button → `updateDeal(deal.id, snapshot)` → `reload()`.
  5. `RatesPanel`
  6. `GenerateLabelButton`
  7. `ShipmentStatusCard` (only if `deal.Envia_Label_URL`)

#### `DealHeader.jsx`
- Props: `{ deal, contact }`. Read-only.
- Renders deal name, contact full name, email, phone, current `Envia_Shipment_Status` as a colored pill.

#### `ShippingAddressForm.jsx`
- Props: `{ deal, onChange, errors }`.
- Iterates `SHIPPING_FIELDS`. Select for `Estado` uses `ESTADOS_MEXICO`.
- Calls `onChange({ [DEAL_FIELDS.X]: value })` per input.

#### `PackageForm.jsx`
- Props: `{ deal, onChange, errors }`.
- Iterates `PACKAGE_FIELDS_DEF`. Number inputs with `step` and `min`.

#### `RatesPanel.jsx`
- Props: `{ deal, contact, onSelect, selectedRate }`.
- Local: `{ rates, loading, error }`.
- Button "Cotizar envío" (disabled if address/package invalid or `loading`).
- On click: `getRates({ deal, contact })`. Expects:
  ```json
  { "ok": true, "data": [{ "carrier": "fedex", "service": "express", "serviceDescription": "FedEx Express", "totalPrice": 250.00, "currency": "MXN", "deliveryEstimate": "2 días" }] }
  ```
- Renders a table: Carrier · Servicio · ETA · Precio · "Seleccionar". Highlights `selectedRate`.

#### `GenerateLabelButton.jsx`
- Props: `{ deal, contact, selectedRate, onGenerated }`.
- Disabled until `selectedRate` truthy.
- On click:
  1. `generateLabel({ deal, contact, selectedRate })`. Expects:
     ```json
     { "ok": true, "data": { "shipmentId": "...", "trackingNumber": "...", "labelUrl": "https://...", "totalPrice": 250.00, "carrier": "fedex", "service": "express" } }
     ```
  2. `updateDeal(deal.id, { Envia_Shipment_ID, Envia_Tracking_Number, Envia_Carrier, Envia_Service, Envia_Label_URL, Envia_Label_Generated_At: nowIso, Envia_Shipment_Status: "Generated", Envia_Shipping_Cost })`.
  3. `window.open(labelUrl, "_blank", "noopener")`.
  4. `onGenerated(patch)` so parent updates UI without full reload.
- On `ok=false`: surface error; do NOT mark fields.

#### `ShipmentStatusCard.jsx`
- Props: `{ deal }`. Renders only when `deal.Envia_Label_URL`.
- Shows: status pill, carrier, service, tracking number (copy-to-clipboard), cost, generated-at, "Abrir guía PDF" link (`target="_blank" rel="noopener"`).

### 5.6 `src/styles.css`

Reuse the design-token approach from `citas-krea-studio/src/styles.css`:

```css
:root {
  --brand: #1c2a54;
  --accent: #d4a464;
  --bg: #f6f7fb;
  --card: #ffffff;
  --ink: #1a1f2e;
  --muted: #666a7a;
  --border: #e3e6ee;
  --danger: #c0392b;
  --success: #1f8a5e;
  --warn: #b47814;
  --radius: 12px;
  --radius-sm: 8px;
  --shadow: 0 1px 2px rgba(0,0,0,.04), 0 6px 20px rgba(20,30,80,.06);
}
```

Component classes to define: `.app`, `.card`, `.field`, `.field--stacked`, `.field__err`, `.btn`, `.btn--ghost`, `.btn--sm`, `.alert`, `.alert--err`, `.pill`, `.pill--ok`, `.pill--err`, `.pill--info`, `.list__table`, `.topbar`, `.empty`.

---

## 6. Deluge Functions (NOT implemented in widget — `docs/ENVIA_FUNCTIONS.md`)

Both functions are created in CRM under **Setup → Developer Hub → Functions → Standalone**.

### 6.1 Configuration constants (Deluge)

- `ENVIA_API_KEY` — Bearer token from Envia. Store as a Zoho Connection (preferred) or as a constant inside the function.
- `ENVIA_BASE_URL` — `https://api.envia.com` (production) or `https://api-test.envia.com` (sandbox).

### 6.2 `krea_envia_get_rates(rate_input STRING)`

```deluge
payload_map = rate_input.toMap();
response = invokeurl
[
  url: "https://api.envia.com/ship/rate"
  type: POST
  parameters: payload_map.toString()
  headers: {"Authorization":"Bearer " + ENVIA_API_KEY, "Content-Type":"application/json"}
];
result = Map();
if (response.get("data") != null)
{
  result.put("ok", true);
  result.put("data", response.get("data"));
  result.put("error", null);
}
else
{
  result.put("ok", false);
  result.put("data", null);
  result.put("error", ifnull(response.get("message"), "Envia error"));
}
return result.toString();
```

### 6.3 `krea_envia_generate_label(label_input STRING, deal_id STRING)`

```deluge
payload_map = label_input.toMap();
response = invokeurl
[
  url: "https://api.envia.com/ship/generate"
  type: POST
  parameters: payload_map.toString()
  headers: {"Authorization":"Bearer " + ENVIA_API_KEY, "Content-Type":"application/json"}
];
data = response.get("data");
out = Map();
if (data != null && data.get("label") != null)
{
  shipment = data.get("label").get(0);
  out.put("shipmentId", shipment.get("trackingNumber"));      // adapt to actual Envia shape
  out.put("trackingNumber", shipment.get("trackingNumber"));
  out.put("labelUrl", shipment.get("labelUrl"));
  out.put("carrier", shipment.get("carrier"));
  out.put("service", shipment.get("service"));
  out.put("totalPrice", shipment.get("totalPrice"));

  // Server-side write-back — REQUIRED. The deals-list widget reads
  // Envia_Label_URL straight from the Deal (via COQL), so Deluge must
  // persist it here. Envia_Label_URL must be a Multi-Line field, not a
  // URL field (COQL silently drops URL-type columns).
  updMap = Map();
  updMap.put("Envia_Shipment_ID", out.get("shipmentId"));
  updMap.put("Envia_Tracking_Number", out.get("trackingNumber"));
  updMap.put("Envia_Label_URL", out.get("labelUrl"));
  updMap.put("Envia_Carrier", out.get("carrier"));
  updMap.put("Envia_Service", out.get("service"));
  updMap.put("Envia_Shipping_Cost", out.get("totalPrice"));
  updMap.put("Envia_Shipment_Status", "Generated");
  updMap.put("Envia_Label_Generated_At", zoho.currenttime);
  zoho.crm.updateRecord("Deals", deal_id.toLong(), updMap);

  result = {"ok": true, "data": out, "error": null};
}
else
{
  result = {"ok": false, "data": null, "error": ifnull(response.get("message"), "Envia error")};
}
return result.toString();
```

> The widget already calls `updateDeal` after a successful response, so the server-side write-back is optional. Pick one strategy to avoid double-writes.

---

## 7. Implementation Order (for Claude Code)

1. `npm init -y`, paste `package.json`, run `npm install`.
2. Create `webpack.config.js`, `babel.config.json`, `.gitignore`.
3. Create `app/widget.html`, `server/index.js`.
4. Create `plugin-manifest.json`.
5. Create `src/styles.css`, `src/index.jsx`, `src/App.jsx`.
6. Create `src/utils/constants.js`, `src/utils/zohoApi.js`, `src/utils/envia.js`, `src/utils/formatters.js`.
7. Create `src/hooks/useDeal.js`.
8. Create components in this order: `DealHeader` → `ShippingAddressForm` → `PackageForm` → `RatesPanel` → `GenerateLabelButton` → `ShipmentStatusCard` → `DealDetail`.
9. Run `npm run dev` + `npm start`. Verify the bundle loads at `https://127.0.0.1:9000` (empty state outside Zoho is expected — `PageLoad` only fires inside Zoho).
10. Create `docs/ENVIA_FUNCTIONS.md` and `README.md`.
11. Hand off the **CRM Field Setup Checklist** + **Deluge Function specs** to the user for the Zoho-side setup.

---

## 8. Verification (end-to-end)

**Local (no Zoho):**
1. `npm install`
2. Terminal A: `npm run dev` (webpack watch).
3. Terminal B: `npm start` (HTTPS server on 9000).
4. Open `https://127.0.0.1:9000`, accept self-signed cert. Expected: empty state ("No hay Deal seleccionado") because `PageLoad` doesn't fire outside Zoho.

**Inside Zoho Sandbox:**
5. Create the 14 new Deal fields per the checklist.
6. Create the two Deluge functions (`krea_envia_get_rates`, `krea_envia_generate_label`) with valid `ENVIA_API_KEY`.
7. **Setup → Developer Space → Widgets → Add new** → point to `https://127.0.0.1:9000`.
8. Open a Deal that has shipping address + linked Contact with phone+email.
9. Open the Envia widget tab.
10. Verify `DealHeader` shows deal/contact data.
11. Fill `PackageForm` (e.g., 2 kg / 30×20×10 cm / "Cuadros enmarcados" / $1500) → Save.
12. Click "Cotizar envío" → expect a list of carriers/services with prices and ETAs.
13. Pick one rate → "Generar guía" → label PDF opens in a new tab.
14. Refresh the Deal page in Zoho → confirm `Envia_Shipment_ID`, `Envia_Tracking_Number`, `Envia_Carrier`, `Envia_Service`, `Envia_Label_URL`, `Envia_Label_Generated_At`, `Envia_Shipping_Cost`, `Envia_Shipment_Status = Generated` are populated.
15. Re-open the widget → `ShipmentStatusCard` is now visible with tracking + label link.

**Packaging & deploy:**
16. `npm run validate` — fix any manifest issues.
17. `npm run pack` → upload `.zip` via **Developer Space → Extensions → Upload extension** to Sandbox.
18. Promote to Production once validated.

---

## 9. Reference — Critical Files in `citas-krea-studio` to Mirror

These files in `/Users/antoniocontreras/Github/citas-krea-studio` are the templates Claude Code should consult when in doubt:

- `src/utils/zohoApi.js` — pattern for SDK wrappers + `executeFunction`.
- `src/utils/constants.js` — pattern for centralized api_name maps + picklist values.
- `src/utils/woocommerce.js` — pattern for "build payload locally + invoke Deluge function + parse `details.output`".
- `src/index.jsx` + `src/App.jsx` — pattern for `embeddedApp.on("PageLoad")` + `embeddedApp.init()` + EntityId routing.
- `src/hooks/useDeal.js` — pattern for the loader hook with `patchDeal` + `reload`.
- `src/components/ShippingFields.jsx` — pattern for the address form (declarative iteration over `SHIPPING_FIELDS`).
- `plugin-manifest.json`, `webpack.config.js`, `server/index.js`, `app/widget.html`, `babel.config.json`, `package.json` — verbatim references.

---

## 10. Notes & Caveats

- **Envia API field shape is approximate.** The keys (`carrier`, `service`, `dimensions.length/width/height`, `weight`, `weightUnit`, `printFormat`, `labelUrl`, etc.) follow the public Envia REST conventions. Verify against the user's tenant once an API key is available; tweak only `src/utils/envia.js` and the Deluge response parsing.
- **`ENVIA_API_KEY` MUST live server-side** (Zoho Function or Connections). Never bundle it into the widget.
- **No PDF generation in the widget** — Envia returns a hosted label URL. `pdf-lib` is intentionally NOT a dependency.
- **Trigger suppression** — `updateDeal` defaults to `Trigger: []` to avoid recursive workflow runs while saving label metadata. Pass `{ suppressTriggers: false }` if you need workflows to fire (e.g., a "shipment generated" notification).
- **Single-Deal scope** — App.jsx assumes `EntityId` is provided. If a future requirement needs a list view (like `citas-krea-studio`'s `DealsList`), add COQL queries via `ZOHO.CRM.API.coql` and a new `DealsList.jsx`.
