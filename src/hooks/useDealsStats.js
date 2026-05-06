import { useCallback, useEffect, useState } from "react";
import { coqlCount, normalizeError } from "../utils/zohoApi";
import { DEAL_FIELDS, MODULES, SHIPMENT_STATUS } from "../utils/constants";

const EMPTY_STATS = {
  total: null,
  withoutGuide: null,
  withError: null,
  withGuide: null,
};

const NOT_CANCELLED = `(${DEAL_FIELDS.ENVIA_SHIPMENT_STATUS} is null OR ${DEAL_FIELDS.ENVIA_SHIPMENT_STATUS} != '${SHIPMENT_STATUS.CANCELLED}')`;
const HAS_GUIDE = `(${DEAL_FIELDS.ENVIA_LABEL_URL} is not null OR ${DEAL_FIELDS.ENVIA_TRACKING_NUMBER} is not null)`;
const NO_GUIDE = `(${DEAL_FIELDS.ENVIA_LABEL_URL} is null AND ${DEAL_FIELDS.ENVIA_TRACKING_NUMBER} is null)`;

const QUERIES = {
  total: `SELECT COUNT(id) FROM ${MODULES.DEALS} WHERE ${DEAL_FIELDS.MODIFIED_TIME} is not null`,
  withoutGuide: `SELECT COUNT(id) FROM ${MODULES.DEALS} WHERE ${NO_GUIDE} AND ${NOT_CANCELLED}`,
  withError: `SELECT COUNT(id) FROM ${MODULES.DEALS} WHERE ${DEAL_FIELDS.ENVIA_SHIPMENT_STATUS} = '${SHIPMENT_STATUS.CANCELLED}'`,
  withGuide: `SELECT COUNT(id) FROM ${MODULES.DEALS} WHERE ${HAS_GUIDE} AND ${NOT_CANCELLED}`,
};

export default function useDealsStats() {
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const keys = Object.keys(QUERIES);
    const settled = await Promise.all(
      keys.map((key) =>
        coqlCount(QUERIES[key]).then(
          (value) => ({ key, value }),
          (err) => ({ key, error: err }),
        ),
      ),
    );
    const next = { ...EMPTY_STATS };
    const failures = [];
    for (const item of settled) {
      if ("error" in item) {
        next[item.key] = null;
        failures.push(item.error);
      } else {
        next[item.key] = item.value;
      }
    }
    setStats(next);
    if (failures.length === keys.length) {
      setError(
        normalizeError(failures[0], "No se pudieron cargar los totales"),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { stats, loading, error, reload: fetchAll };
}
