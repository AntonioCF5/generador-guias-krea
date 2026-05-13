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
  if (!status) return SHIPMENT_STATUS_LABELS[SHIPMENT_STATUS.PENDIENTE];
  return SHIPMENT_STATUS_LABELS[status] || String(status);
}

export function shipmentStatusModifier(status) {
  switch (status) {
    case SHIPMENT_STATUS.DELIVERED:
      return "pill--ok";
    case SHIPMENT_STATUS.SHIPPED:
    case SHIPMENT_STATUS.OUT_FOR_DELIVERY:
    case SHIPMENT_STATUS.PICKED_UP:
      return "pill--info";
    case SHIPMENT_STATUS.PENDIENTE:
      return "pill--warn";
    case SHIPMENT_STATUS.ADDRESS_ERROR:
      return "pill--err";
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

const CARRIER_LABELS = {
  fedex: "FedEx",
  dhl: "DHL",
  ups: "UPS",
  estafeta: "Estafeta",
  paquetexpress: "Paquetexpress",
  redpack: "Redpack",
  sendex: "Sendex",
  "99minutos": "99Minutos",
  ampm: "AM PM",
};

export function carrierLabel(carrier) {
  if (!carrier) return "";
  const key = String(carrier).trim().toLowerCase();
  return CARRIER_LABELS[key] || String(carrier);
}

const TRACKING_URL_TEMPLATES = {
  fedex: (t) =>
    `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(t)}`,
  dhl: (t) =>
    `https://www.dhl.com/mx-es/home/tracking.html?tracking-id=${encodeURIComponent(t)}`,
  ups: (t) => `https://www.ups.com/track?tracknum=${encodeURIComponent(t)}`,
  estafeta: (t) =>
    `https://www.estafeta.com/Tracking/searchByGet?wayBillType=0&wayBill=${encodeURIComponent(t)}`,
  paquetexpress: (t) =>
    `https://www.paquetexpress.com.mx/rastreo-de-guia/?guia=${encodeURIComponent(t)}`,
  redpack: (t) =>
    `https://www.redpack.com.mx/es/rastreo/?guias=${encodeURIComponent(t)}`,
};

export function trackingUrlFor(carrier, trackingNumber) {
  if (!carrier || !trackingNumber) return null;
  const key = String(carrier).trim().toLowerCase();
  const template = TRACKING_URL_TEMPLATES[key];
  if (!template) return null;
  return template(String(trackingNumber).trim());
}
