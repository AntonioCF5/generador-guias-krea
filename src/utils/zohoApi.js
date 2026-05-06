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
