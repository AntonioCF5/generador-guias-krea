import { useCallback, useEffect, useState } from "react";
import { coqlCount, normalizeError } from "../utils/zohoApi";
import { DEAL_FIELDS, MODULES } from "../utils/constants";

const EMPTY_STATS = {
  total: null,
  withoutGuide: null,
  withError: null,
  withGuide: null,
};

const QUERIES = {
  total: `SELECT COUNT(id) FROM ${MODULES.DEALS} WHERE id is not null`,
  withoutGuide: `SELECT COUNT(id) FROM ${MODULES.DEALS} WHERE ${DEAL_FIELDS.ENVIA_TRACKING_NUMBER} is null`,
  withGuide: `SELECT COUNT(id) FROM ${MODULES.DEALS} WHERE ${DEAL_FIELDS.ENVIA_TRACKING_NUMBER} is not null`,
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
