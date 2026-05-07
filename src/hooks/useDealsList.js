import { useCallback, useEffect, useState } from "react";
import { searchDealsByCOQL, normalizeError } from "../utils/zohoApi";
import {
  DEAL_FIELDS,
  DEAL_STAGES,
  DEALS_LIST_PAGE_SIZE,
  MODULES,
} from "../utils/constants";

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
];

function localTzOffset() {
  const offsetMin = new Date().getTimezoneOffset();
  const sign = offsetMin <= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

function dayBoundary(dateStr, end = false) {
  if (!dateStr) return null;
  const time = end ? "23:59:59" : "00:00:00";
  return `${dateStr}T${time}${localTzOffset()}`;
}

function escapeLiteral(value) {
  return String(value).replace(/'/g, "\\'");
}

function buildQuery({
  search,
  statusFilter,
  stageFilter,
  dateFrom,
  dateTo,
  limit,
  offset,
}) {
  const conditions = [`${DEAL_FIELDS.MODIFIED_TIME} is not null`];

  if (search && search.trim()) {
    const safe = escapeLiteral(search.trim());
    const orFields = [
      DEAL_FIELDS.NAME,
      DEAL_FIELDS.NUMERO_DE_ORDEN,
      DEAL_FIELDS.CIUDAD,
      DEAL_FIELDS.ENVIA_TRACKING_NUMBER,
      DEAL_FIELDS.STAGE,
    ];
    const orClause = orFields
      .map((field) => `${field} like '%${safe}%'`)
      .join(" OR ");
    conditions.push(`(${orClause})`);
  }

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

  const fromIso = dayBoundary(dateFrom, false);
  if (fromIso) {
    conditions.push(`${DEAL_FIELDS.FECHA_Y_HORA} >= '${fromIso}'`);
  }

  const toIso = dayBoundary(dateTo, true);
  if (toIso) {
    conditions.push(`${DEAL_FIELDS.FECHA_Y_HORA} <= '${toIso}'`);
  }

  return [
    `SELECT ${COQL_FIELDS.join(", ")}`,
    `FROM ${MODULES.DEALS}`,
    `WHERE ${conditions.join(" AND ")}`,
    `ORDER BY ${DEAL_FIELDS.MODIFIED_TIME} DESC`,
    `LIMIT ${offset}, ${limit}`,
  ].join(" ");
}

export default function useDealsList() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchPage = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const limit = DEALS_LIST_PAGE_SIZE;
      const offset = params.page * limit;
      const query = buildQuery({
        ...params,
        limit: limit + 1,
        offset,
      });
      const rows = await searchDealsByCOQL(query);
      const trimmed = rows.slice(0, limit);
      setDeals(trimmed);
      setHasMore(rows.length > limit);
      // TEMP: stage values diagnostic. Remove after DEAL_STAGES is aligned.
      const seenStages = new Set();
      for (const deal of trimmed) {
        const stage = deal[DEAL_FIELDS.STAGE];
        if (stage != null) seenStages.add(stage);
      }
      const known = new Set(DEAL_STAGES);
      const unknown = [...seenStages].filter((s) => !known.has(s));
      console.log("[DealsList] Stage values seen:", [...seenStages]);
      console.log(
        "[DealsList] Stage chars (JSON):",
        [...seenStages].map((s) => JSON.stringify(s)),
      );
      if (unknown.length) {
        console.warn(
          "[DealsList] Stages not present in DEAL_STAGES:",
          unknown.map((s) => JSON.stringify(s)),
        );
      }
    } catch (err) {
      setError(normalizeError(err, "No se pudieron cargar los deals"));
      setDeals([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage({
      search,
      statusFilter,
      stageFilter,
      dateFrom,
      dateTo,
      page,
    });
  }, [
    fetchPage,
    search,
    statusFilter,
    stageFilter,
    dateFrom,
    dateTo,
    page,
  ]);

  const reload = useCallback(() => {
    fetchPage({
      search,
      statusFilter,
      stageFilter,
      dateFrom,
      dateTo,
      page,
    });
  }, [
    fetchPage,
    search,
    statusFilter,
    stageFilter,
    dateFrom,
    dateTo,
    page,
  ]);

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
    deals,
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
  };
}
