import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getDeal,
  normalizeError,
  searchDealsByCOQL,
} from "../utils/zohoApi";
import { DEAL_FIELDS, DEALS_LIST_PAGE_SIZE, MODULES } from "../utils/constants";

const COQL_FIELDS = [
  DEAL_FIELDS.ID,
  DEAL_FIELDS.NAME,
  DEAL_FIELDS.STAGE,
  DEAL_FIELDS.CIUDAD,
  DEAL_FIELDS.ESTADO,
  DEAL_FIELDS.CODIGO_POSTAL,
  DEAL_FIELDS.CLOSING_DATE,
  DEAL_FIELDS.MODIFIED_TIME,
  DEAL_FIELDS.NUMERO_DE_ORDEN,
  DEAL_FIELDS.FECHA_Y_HORA,
  DEAL_FIELDS.ENVIA_SHIPMENT_STATUS,
  DEAL_FIELDS.ENVIA_TRACKING_NUMBER,
  DEAL_FIELDS.ENVIA_CARRIER,
  DEAL_FIELDS.ENVIA_LABEL_URL,
  DEAL_FIELDS.TOTAL_GUIAS,
];

function escapeLiteral(value) {
  return String(value).replace(/'/g, "\\'");
}

function buildQuery({
  statusFilter,
  stageFilter,
  limit,
  offset,
}) {
  const conditions = [`${DEAL_FIELDS.MODIFIED_TIME} is not null`];

  if (statusFilter) {
    conditions.push(
      `${DEAL_FIELDS.ENVIA_SHIPMENT_STATUS} = '${escapeLiteral(statusFilter)}'`,
    );
  }

  if (stageFilter) {
    conditions.push(
      `${DEAL_FIELDS.STAGE} = '${escapeLiteral(stageFilter)}'`,
    );
  }

  return [
    `SELECT ${COQL_FIELDS.join(", ")}`,
    `FROM ${MODULES.DEALS}`,
    `WHERE ${conditions.join(" AND ")}`,
    `ORDER BY ${DEAL_FIELDS.MODIFIED_TIME} DESC`,
    `LIMIT ${offset}, ${limit}`,
  ].join(" ");
}

const COQL_FETCH_PAGE_SIZE = 200;
const COQL_MAX_RECORDS = 2000;

export default function useDealsList() {
  const [allDeals, setAllDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);

  const fetchAll = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const collected = [];
      let offset = 0;
      while (offset < COQL_MAX_RECORDS) {
        const remaining = COQL_MAX_RECORDS - offset;
        const limit = Math.min(COQL_FETCH_PAGE_SIZE, remaining);
        const query = buildQuery({ ...params, limit, offset });
        console.log("[DealsList] COQL query:", query);
        const rows = await searchDealsByCOQL(query);
        collected.push(...rows);
        if (rows.length < limit) break;
        offset += rows.length;
      }
      setAllDeals(collected);
      const withLabel = collected.filter(
        (d) => d[DEAL_FIELDS.ENVIA_LABEL_URL],
      ).length;
      const withTracking = collected.filter(
        (d) => d[DEAL_FIELDS.ENVIA_TRACKING_NUMBER],
      ).length;
      console.log(
        `[DealsList] fetched ${collected.length} deals — Envia_Label_URL: ${withLabel} populated, Numero_de_Guia: ${withTracking} populated`,
      );
    } catch (err) {
      console.error("[DealsList] Query failed:", err);
      setError(normalizeError(err, "No se pudieron cargar los deals"));
      setAllDeals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll({ statusFilter, stageFilter });
  }, [fetchAll, statusFilter, stageFilter]);

  const reload = useCallback(() => {
    fetchAll({ statusFilter, stageFilter });
  }, [fetchAll, statusFilter, stageFilter]);

  const refreshDeal = useCallback(async (dealId) => {
    if (!dealId) return null;
    try {
      const fresh = await getDeal(dealId);
      if (!fresh) return null;
      setAllDeals((prev) =>
        prev.map((d) =>
          d[DEAL_FIELDS.ID] === dealId ? { ...d, ...fresh } : d,
        ),
      );
      return fresh;
    } catch (err) {
      console.error("[DealsList] refreshDeal failed:", err);
      return null;
    }
  }, []);

  const filteredDeals = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fromMs = dateFrom
      ? new Date(`${dateFrom}T00:00:00`).getTime()
      : null;
    const toMs = dateTo
      ? new Date(`${dateTo}T23:59:59.999`).getTime()
      : null;
    if (!term && fromMs == null && toMs == null) return allDeals;
    return allDeals.filter((deal) => {
      if (term) {
        const candidates = [
          deal[DEAL_FIELDS.NAME],
          deal[DEAL_FIELDS.NUMERO_DE_ORDEN],
          deal[DEAL_FIELDS.CIUDAD],
          deal[DEAL_FIELDS.ESTADO],
          deal[DEAL_FIELDS.STAGE],
          deal[DEAL_FIELDS.ENVIA_TRACKING_NUMBER],
          deal[DEAL_FIELDS.ENVIA_CARRIER],
        ];
        const matches = candidates.some(
          (value) => value && String(value).toLowerCase().includes(term),
        );
        if (!matches) return false;
      }
      if (fromMs != null || toMs != null) {
        const value = deal[DEAL_FIELDS.FECHA_Y_HORA];
        if (!value) return false;
        const t = new Date(value).getTime();
        if (Number.isNaN(t)) return false;
        if (fromMs != null && t < fromMs) return false;
        if (toMs != null && t > toMs) return false;
      }
      return true;
    });
  }, [allDeals, search, dateFrom, dateTo]);

  const pagedDeals = useMemo(() => {
    const start = page * DEALS_LIST_PAGE_SIZE;
    return filteredDeals.slice(start, start + DEALS_LIST_PAGE_SIZE);
  }, [filteredDeals, page]);

  const hasMore = useMemo(
    () => filteredDeals.length > (page + 1) * DEALS_LIST_PAGE_SIZE,
    [filteredDeals.length, page],
  );

  const applySearch = useCallback((value) => {
    setSearch(value);
    setPage(0);
  }, []);

  const applyStatusFilter = useCallback((value) => {
    setStatusFilter(value);
    setPage(0);
  }, []);

  const applyStageFilter = useCallback((value) => {
    setStageFilter(value);
    setPage(0);
  }, []);

  const applyDateFrom = useCallback((value) => {
    setDateFrom(value);
    setPage(0);
  }, []);

  const applyDateTo = useCallback((value) => {
    setDateTo(value);
    setPage(0);
  }, []);

  return {
    deals: pagedDeals,
    totalCount: filteredDeals.length,
    loading,
    error,
    search,
    statusFilter,
    stageFilter,
    dateFrom,
    dateTo,
    page,
    hasMore,
    setSearch: applySearch,
    setStatusFilter: applyStatusFilter,
    setStageFilter: applyStageFilter,
    setDateFrom: applyDateFrom,
    setDateTo: applyDateTo,
    setPage,
    reload,
    refreshDeal,
  };
}
