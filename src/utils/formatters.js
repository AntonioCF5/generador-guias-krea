import { SHIPMENT_STATUS, SHIPMENT_STATUS_LABELS } from "./constants";

export function formatCurrency(value, currency = "MXN") {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatStageOrPlaceholder(stage) {
  if (!stage) return "—";
  return String(stage);
}

export function shipmentStatusLabel(status) {
  if (!status) return SHIPMENT_STATUS_LABELS[SHIPMENT_STATUS.PENDING];
  return SHIPMENT_STATUS_LABELS[status] || String(status);
}

export function shipmentStatusModifier(status) {
  switch (status) {
    case SHIPMENT_STATUS.GENERATED:
    case SHIPMENT_STATUS.DELIVERED:
      return "pill--ok";
    case SHIPMENT_STATUS.IN_TRANSIT:
      return "pill--info";
    case SHIPMENT_STATUS.CANCELLED:
      return "pill--err";
    case SHIPMENT_STATUS.QUOTED:
    case SHIPMENT_STATUS.PENDING:
      return "pill--warn";
    default:
      return "pill--muted";
  }
}

export function contactNameFromLookup(deal) {
  const contact = deal?.Contact_Name;
  if (!contact) return "—";
  if (typeof contact === "string") return contact;
  return contact.name || contact.full_name || "—";
}
