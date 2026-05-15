# Multi-guide setup (Envia_Shipments module)

This document describes the **manual Zoho setup** required to unlock the
multi-guide-per-Deal flow that the widget now supports.

The widget keeps the **single-guide** flow exactly as it was: clicking
**Generar guía** on a Deal calls `envia_generate_label(dealId)` and
populates the existing `Envia_*` and `Package_*` fields on the Deal.
That path keeps working with **no setup at all**.

The setup below is only needed if you want the **multi-guide** option
(toggle "Múltiples guías" inside the modal, list pill "📦 N guías",
"Ver guías" view).

---

## 1. New field on `Deals`

| Field label | API name | Tipo | Default |
|---|---|---|---|
| Total Guías | `Total_Guias` | Integer | 0 |

The widget writes this number after a multi-guide batch ends. The list
branches on it:

- `Total_Guias <= 1` → legacy single-guide row (Ver guía / Descargar /
  Rastrear / Regenerar buttons).
- `Total_Guias > 1` → "N guías" pill + [Ver guías] [Regenerar guías]
  buttons.

A Deal that only has a single guide keeps `Total_Guias = 0` — the
legacy `Envia_*` fields on the Deal still hold the data.

---

## 2. New custom module `Envia_Shipments`

Create **Setup → Modules and Fields → Create New Module**:

- Singular: `Envia Shipment`
- Plural: `Envia Shipments`
- API name: `Envia_Shipments`

Then add these fields (the API names must match — the widget uses
them verbatim):

| API name | Tipo | Required | Notas |
|---|---|---|---|
| `Name` | Auto-Number `SHP-{00000}` | yes (auto) | Visible in lookups |
| `Deal` | Lookup → Deals | yes | Parent. Inverse field name suggested: `Shipments` |
| `Shipment_Index` | Integer (1..10) | yes | Position 1..N inside the deal. The #1 is the "primary" — Deluge mirrors it to the Deal for legacy compat |
| `Package_Weight_Kg` | Decimal (2) | yes | |
| `Package_Length_Cm` | Decimal (1) | yes | |
| `Package_Width_Cm` | Decimal (1) | yes | |
| `Package_Height_Cm` | Decimal (1) | yes | |
| `Package_Content_Description` | Multi Line (255) | yes | Free-form per-package content |
| `Package_Declared_Value` | Currency (MXN) | no | |
| `Envia_Shipment_ID` | Single Line | no | Envia's internal ID |
| `Numero_de_Guia` | Single Line | no | Tracking number returned by Envia |
| `Paqueteria` | Single Line | no | Carrier slug (`fedex`, `dhl`, etc.) |
| `Envia_Service` | Single Line | no | |
| `Envia_Label_URL` | URL | no | |
| `URL_de_Rastreo` | URL | no | |
| `Envia_Label_Generated_At` | Date/Time | no | |
| `Envia_Shipment_Status` | Picklist | no | Use the same values as `Deals.Envia_Shipment_Status` (`Pendiente`, `Picked Up`, `Shipped`, `Out for Delivery`, `Delivered`, `Address error`) |
| `Envia_Shipping_Cost` | Currency (MXN) | no | |
| `Last_Error` | Multi Line | no | Last failure message — surfaced in the "Ver guías" modal |

Grant the relevant **profile permissions** to read/write the new module
to the users running the widget.

---

## 3. New Deluge function `envia_generate_label_for_shipment`

Argument: `shipmentId STRING` (record ID of `Envia_Shipments`).

The function:

1. Reads the shipment record (package fields).
2. Reads the parent Deal (shipping address) and its linked Contact
   (recipient name, phone, email).
3. Builds the Envia payload with **the shipment's** weight, dimensions
   and description (NOT the Deal's package fields).
4. Calls `https://api.envia.com/ship/generate`.
5. On success:
   - Writes label / tracking / carrier / status into the shipment
     record.
   - If `Shipment_Index == 1`, **mirrors** the same fields onto the
     parent Deal so the existing list, COQL queries and stats keep
     working.
6. On failure:
   - Writes `Last_Error` + `Envia_Shipment_Status = "Address error"`
     into the shipment record.
7. Returns the same `{ok, data, error}` envelope as
   `envia_generate_label`.

### Sketch

```deluge
shipment = zoho.crm.getRecordById("Envia_Shipments", shipmentId.toLong());
dealId = shipment.get("Deal").get("id");
deal = zoho.crm.getRecordById("Deals", dealId);
contact = zoho.crm.getRecordById("Contacts", deal.get("Contact_Name").get("id"));

payload = Map();
payload.put("origin", SENDER);
payload.put("destination", { /* fromDeal+contact */ });
payload.put("packages", [{
  "weight": shipment.get("Package_Weight_Kg"),
  "dimensions": {
    "length": shipment.get("Package_Length_Cm"),
    "width":  shipment.get("Package_Width_Cm"),
    "height": shipment.get("Package_Height_Cm")
  },
  "content": shipment.get("Package_Content_Description"),
  "declaredValue": shipment.get("Package_Declared_Value")
}]);
payload.put("shipment", { "type": 1 });

response = invokeurl
[
  url: "https://api.envia.com/ship/generate"
  type: POST
  parameters: payload.toString()
  headers: {"Authorization":"Bearer " + ENVIA_API_KEY, "Content-Type":"application/json"}
];

if (response.get("data") != null && response.get("data").get("label") != null)
{
  out = response.get("data").get("label").get(0);
  trackingNumber = out.get("trackingNumber");
  labelUrl       = out.get("label");
  carrier        = out.get("carrier");
  service        = out.get("service");
  totalPrice     = out.get("totalPrice");
  trackingUrl    = out.get("trackingUrl");
  enviaId        = out.get("shipmentId");

  // 1) Update the child shipment record (always)
  zoho.crm.updateRecord("Envia_Shipments", shipmentId.toLong(), {
    "Envia_Shipment_ID": enviaId,
    "Numero_de_Guia": trackingNumber,
    "Paqueteria": carrier,
    "Envia_Service": service,
    "Envia_Label_URL": labelUrl,
    "URL_de_Rastreo": trackingUrl,
    "Envia_Label_Generated_At": zoho.currenttime,
    "Envia_Shipment_Status": "Pendiente",
    "Envia_Shipping_Cost": totalPrice,
    "Last_Error": ""
  });

  // 2) Mirror to Deal only if this is the primary shipment
  if (shipment.get("Shipment_Index") == 1)
  {
    zoho.crm.updateRecord("Deals", dealId.toLong(), {
      "Envia_Shipment_ID": enviaId,
      "Numero_de_Guia": trackingNumber,
      "Paqueteria": carrier,
      "Envia_Service": service,
      "Envia_Label_URL": labelUrl,
      "URL_de_Rastreo": trackingUrl,
      "Envia_Label_Generated_At": zoho.currenttime,
      "Envia_Shipment_Status": "Pendiente",
      "Envia_Shipping_Cost": totalPrice
      // NOTE: Total_Guias is written by the widget at the end of the batch.
    });
  }

  return {"ok": true, "data": {
    "shipmentId": enviaId,
    "trackingNumber": trackingNumber,
    "labelUrl": labelUrl,
    "carrier": carrier,
    "service": service,
    "totalPrice": totalPrice
  }, "error": null}.toString();
}
else
{
  msg = ifnull(response.get("message"), "Envia error");
  zoho.crm.updateRecord("Envia_Shipments", shipmentId.toLong(), {
    "Last_Error": msg,
    "Envia_Shipment_Status": "Address error"
  });
  return {"ok": false, "data": null, "error": {"message": msg}}.toString();
}
```

`envia_generate_label(dealId)` is **not modified** — it stays as the
entry point for the single-guide flow.

---

## 4. End-to-end verification checklist

1. Open a Deal **without** any guide.
2. Click **Generar guía** → modal opens with the package fields
   pre-filled and the toggle on "Una sola guía". Confirm.
3. The Deal now has its `Envia_*` fields populated and the list shows
   the legacy actions. **No record was created in `Envia_Shipments`**
   and `Total_Guias` is still 0. ✅
4. Open another Deal without a guide.
5. Click **Generar guía** → toggle to "Múltiples guías" → stepper to
   3 → fill 3 different descriptions.
6. Click **Generar 3 guías**. Progress bar moves 1/3 → 2/3 → 3/3.
7. In Zoho, the deal now has:
   - 3 records under `Envia_Shipments` (`Shipment_Index` 1, 2, 3).
   - The Deal's `Envia_*` fields mirror shipment #1.
   - `Total_Guias = 3`.
8. The list row shows the "📦 3 guías" pill and the [Ver guías] [Regenerar guías] buttons.
9. Click **Ver guías** → modal lists the 3 shipments with their
   tracking numbers and label links.
10. Click **Regenerar guías** → modal opens preloaded with the 3
    drafts. Adjust if needed, hit **Generar** → existing records are
    overwritten (same Zoho record IDs, new Envia labels).
