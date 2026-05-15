import { useCallback, useEffect, useState } from "react";
import { coqlQuery, normalizeError } from "../utils/zohoApi";
import { MODULES, SHIPMENT_FIELDS } from "../utils/constants";

const COQL_FIELDS = [
  SHIPMENT_FIELDS.ID,
  SHIPMENT_FIELDS.SHIPMENT_INDEX,
  SHIPMENT_FIELDS.PACKAGE_WEIGHT_KG,
  SHIPMENT_FIELDS.PACKAGE_LENGTH_CM,
  SHIPMENT_FIELDS.PACKAGE_WIDTH_CM,
  SHIPMENT_FIELDS.PACKAGE_HEIGHT_CM,
  SHIPMENT_FIELDS.PACKAGE_CONTENT,
  SHIPMENT_FIELDS.PACKAGE_DECLARED_VALUE,
  SHIPMENT_FIELDS.ENVIA_TRACKING_NUMBER,
  SHIPMENT_FIELDS.ENVIA_CARRIER,
  SHIPMENT_FIELDS.ENVIA_SERVICE,
  SHIPMENT_FIELDS.ENVIA_LABEL_URL,
  SHIPMENT_FIELDS.ENVIA_LABEL_GENERATED_AT,
  SHIPMENT_FIELDS.ENVIA_SHIPMENT_STATUS,
  SHIPMENT_FIELDS.ENVIA_SHIPPING_COST,
  SHIPMENT_FIELDS.LAST_ERROR,
];

function buildQuery(dealId) {
  return [
    `SELECT ${COQL_FIELDS.join(", ")}`,
    `FROM ${MODULES.ENVIA_SHIPMENTS}`,
    `WHERE ${SHIPMENT_FIELDS.DEAL} = ${dealId}`,
    `ORDER BY ${SHIPMENT_FIELDS.SHIPMENT_INDEX} ASC`,
    `LIMIT 0, 50`,
  ].join(" ");
}

export default function useShipments(dealId, enabled = true) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await coqlQuery(buildQuery(dealId));
      setShipments(rows);
    } catch (err) {
      console.error("[useShipments] query failed:", err);
      setError(normalizeError(err, "No se pudieron cargar las guías"));
      setShipments([]);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    if (enabled && dealId) fetchAll();
  }, [enabled, dealId, fetchAll]);

  return { shipments, loading, error, reload: fetchAll };
}
