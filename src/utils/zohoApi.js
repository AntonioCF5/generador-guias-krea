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

export async function searchDealsByCOQL(selectQuery) {
  const res = await ZOHO.CRM.API.coql({ select_query: selectQuery });
  return res?.data ?? [];
}

export async function coqlCount(selectQuery) {
  const res = await ZOHO.CRM.API.coql({ select_query: selectQuery });
  const row = res?.data?.[0];
  if (!row) return 0;
  const direct =
    row.count ?? row.Count ?? row["COUNT(id)"] ?? row.aggregate?.Count;
  if (typeof direct === "number") return direct;
  for (const value of Object.values(row)) {
    if (typeof value === "number") return value;
  }
  return 0;
}

export async function executeFunction(funcName, args = {}) {
  return ZOHO.CRM.FUNCTIONS.execute(funcName, { arguments: JSON.stringify(args) });
}

export async function getDealAttachments(dealId) {
  try {
    const res = await ZOHO.CRM.API.getRelatedRecords({
      Entity: MODULES.DEALS,
      RecordID: dealId,
      RelatedList: "Attachments",
      page: 1,
      per_page: 200,
    });
    return res?.data ?? [];
  } catch (err) {
    // The widget SDK rejects (instead of resolving with []) when a record
    // has no related attachments — treat that as "no attachments".
    console.warn("[attachments] getRelatedRecords failed/empty:", err);
    return [];
  }
}

function bytesFromString(str) {
  const dataUrl = /^data:[^;,]*;base64,(.*)$/s.exec(str.trim());
  const candidate = dataUrl ? dataUrl[1] : str.trim();
  let binary;
  try {
    binary = atob(candidate);
  } catch {
    binary = str; // not base64 — assume it is already a raw binary string
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i) & 0xff;
  }
  return bytes;
}

// getFile's resolved shape is not documented for the widget SDK (the parent
// CRM frame packages it), so accept Blob / ArrayBuffer / typed array /
// wrapper object / base64 string and normalise to a Blob.
export async function fileResponseToBlob(res, mimeType = "application/pdf") {
  if (res == null) return null;
  if (res instanceof Blob) return res;
  if (res instanceof ArrayBuffer || ArrayBuffer.isView(res)) {
    return new Blob([res], { type: mimeType });
  }
  if (typeof res === "string") {
    return new Blob([bytesFromString(res)], { type: mimeType });
  }
  if (typeof res === "object") {
    if (typeof res.blob === "function") {
      try {
        return await res.blob();
      } catch {
        /* fall through to the wrapped-shape handling below */
      }
    }
    const inner =
      res.data ?? res.content ?? res.body ?? res.file ?? res.fileContent ??
      res.response ?? res.result;
    if (inner != null && inner !== res) {
      return fileResponseToBlob(inner, mimeType);
    }
  }
  return null;
}

export async function getAttachmentBlob(fileId) {
  const raw = await ZOHO.CRM.API.getFile({ id: fileId });
  // Intentional: getFile's resolved shape is unverified for the widget SDK.
  // Log it so the real shape can be confirmed in the Zoho environment.
  console.log("[attachments] getFile raw response:", raw);
  const blob = await fileResponseToBlob(raw);
  if (!blob || blob.size === 0) {
    throw new Error("La guía adjunta llegó vacía o en un formato no reconocido");
  }
  return blob;
}

export function parseOutput(res) {
  const raw = res?.details?.output ?? res?.output ?? res;
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return { ok: false, error: { message: "Respuesta no-JSON de Deluge", raw } };
    }
  }
  return raw;
}
