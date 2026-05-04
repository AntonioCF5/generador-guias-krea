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

export async function executeFunction(funcName, args = {}) {
  return ZOHO.CRM.FUNCTIONS.execute(funcName, { arguments: JSON.stringify(args) });
}
