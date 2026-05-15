import { useEffect } from "react";
import useShipments from "../hooks/useShipments";
import { DEAL_FIELDS, SHIPMENT_FIELDS } from "../utils/constants";
import {
  carrierLabel,
  shipmentStatusLabel,
  shipmentStatusModifier,
  trackingUrlFor,
} from "../utils/formatters";

function ShipmentItem({ shipment }) {
  const index = shipment[SHIPMENT_FIELDS.SHIPMENT_INDEX];
  const carrier = shipment[SHIPMENT_FIELDS.ENVIA_CARRIER];
  const tracking = shipment[SHIPMENT_FIELDS.ENVIA_TRACKING_NUMBER];
  const labelUrl = shipment[SHIPMENT_FIELDS.ENVIA_LABEL_URL];
  const trackingUrl =
    shipment[SHIPMENT_FIELDS.ENVIA_TRACKING_URL] ||
    trackingUrlFor(carrier, tracking);
  const status = shipment[SHIPMENT_FIELDS.ENVIA_SHIPMENT_STATUS];
  const description = shipment[SHIPMENT_FIELDS.PACKAGE_CONTENT];
  const weight = shipment[SHIPMENT_FIELDS.PACKAGE_WEIGHT_KG];
  const lastError = shipment[SHIPMENT_FIELDS.LAST_ERROR];

  return (
    <div className="shipment-item">
      <div className="shipment-item__head">
        <span className="shipment-item__index">Guía {index}</span>
        <span className={`pill ${shipmentStatusModifier(status)}`}>
          {shipmentStatusLabel(status)}
        </span>
      </div>
      {description && (
        <div className="shipment-item__desc">{description}</div>
      )}
      <div className="shipment-item__meta">
        {carrier && <span>{carrierLabel(carrier)}</span>}
        {tracking && (
          <span>
            Tracking: <code>{tracking}</code>
          </span>
        )}
        {weight && <span>{weight} kg</span>}
      </div>
      {lastError && (
        <div className="shipment-item__error">{lastError}</div>
      )}
      <div className="shipment-item__actions">
        {labelUrl && (
          <a
            className="btn btn--info btn--sm"
            href={labelUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="btn__icon" aria-hidden="true">
              👁
            </span>
            Ver guía
          </a>
        )}
        {trackingUrl && (
          <a
            className="btn btn--info btn--sm"
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="btn__icon" aria-hidden="true">
              📍
            </span>
            Rastrear
          </a>
        )}
      </div>
    </div>
  );
}

export default function ShipmentsViewModal({ deal, isOpen, onClose }) {
  const dealId = deal?.[DEAL_FIELDS.ID];
  const { shipments, loading, error, reload } = useShipments(dealId, isOpen);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdrop = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  const dealName = deal?.[DEAL_FIELDS.NAME] || "este pedido";
  const orderNumber = deal?.[DEAL_FIELDS.NUMERO_DE_ORDEN];

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="view-shipments-title"
      onClick={handleBackdrop}
    >
      <div className="modal">
        <div className="modal__header">
          <div>
            <div className="modal__title" id="view-shipments-title">
              Guías del pedido
            </div>
            <div className="modal__subtitle">
              {dealName}
              {orderNumber ? ` · Orden ${orderNumber}` : ""}
            </div>
          </div>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="modal__body">
          {loading && (
            <div className="deals-list__state">Cargando guías…</div>
          )}
          {error && (
            <div className="alert alert--err" role="alert">
              {error.message}
            </div>
          )}
          {!loading && !error && shipments.length === 0 && (
            <div className="deals-list__state empty">
              No hay guías registradas para este pedido.
            </div>
          )}
          {shipments.map((shipment) => (
            <ShipmentItem
              key={shipment[SHIPMENT_FIELDS.ID]}
              shipment={shipment}
            />
          ))}
        </div>

        <div className="modal__footer">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={reload}
            disabled={loading}
          >
            Actualizar
          </button>
          <button
            type="button"
            className="btn btn--info btn--sm"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
