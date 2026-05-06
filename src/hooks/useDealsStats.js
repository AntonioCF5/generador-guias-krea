import { useCallback, useEffect, useState } from "react";
import { searchDealsByCOQL, normalizeError } from "../utils/zohoApi";
import { DEAL_FIELDS, MODULES } from "../utils/constants";

const PAGE_SIZE = 200;
const MAX_PAGES = 50;

const EMPTY_STATS = {
  total: null,
  withoutGuide: null,
  withError: null,
  withGuide: null,
  approximate: false,
};

function buildPageQuery(offset) {
  return [
    `SELECT ${DEAL_FIELDS.ID}, ${DEAL_FIELDS.ENVIA_TRACKING_NUMBER}`,
    `FROM ${MODULES.DEALS}`,
    `WHERE ${DEAL_FIELDS.MODIFIED_TIME} is not null`,
    `ORDER BY ${DEAL_FIELDS.MODIFIED_TIME} DESC`,
    `LIMIT ${offset}, ${PAGE_SIZE}`,
  ].join(" ");
}

async function fetchAllDeals() {
  const collected = [];
  let page = 0;
  let truncated = false;
  while (page < MAX_PAGES) {
    const rows = await searchDealsByCOQL(buildPageQuery(page * PAGE_SIZE));
    if (!rows.length) break;
    collected.push(...rows);
    if (rows.length < PAGE_SIZE) return { rows: collected, truncated: false };
    page += 1;
  }
  if (page >= MAX_PAGES) truncated = true;
  return { rows: collected, truncated };
}

export default function useDealsStats() {
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { rows, truncated } = await fetchAllDeals();
      let withGuide = 0;
      for (const deal of rows) {
        if (deal[DEAL_FIELDS.ENVIA_TRACKING_NUMBER]) withGuide += 1;
      }
      setStats({
        total: rows.length,
        withoutGuide: rows.length - withGuide,
        withGuide,
        withError: null,
        approximate: truncated,
      });
    } catch (err) {
      setStats(EMPTY_STATS);
      setError(normalizeError(err, "No se pudieron cargar los totales"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { stats, loading, error, reload: fetchAll };
}
