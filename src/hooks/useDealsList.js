import { useCallback, useEffect, useState } from "react";
import { searchDealsByCOQL, normalizeError } from "../utils/zohoApi";
import { DEAL_FIELDS, DEALS_LIST_PAGE_SIZE, MODULES } from "../utils/constants";

const COQL_FIELDS = [
  DEAL_FIELDS.ID,
  DEAL_FIELDS.NAME,
  DEAL_FIELDS.STAGE,
  DEAL_FIELDS.CONTACT,
  DEAL_FIELDS.CIUDAD,
  DEAL_FIELDS.ESTADO,
  DEAL_FIELDS.CODIGO_POSTAL,
  DEAL_FIELDS.AMOUNT,
  DEAL_FIELDS.CLOSING_DATE,
  DEAL_FIELDS.MODIFIED_TIME,
  DEAL_FIELDS.ENVIA_SHIPMENT_STATUS,
  DEAL_FIELDS.ENVIA_TRACKING_NUMBER,
  DEAL_FIELDS.ENVIA_CARRIER,
  DEAL_FIELDS.ENVIA_LABEL_URL,
];

function buildQuery({ search, statusFilter, limit, offset }) {
  const conditions = [`${DEAL_FIELDS.MODIFIED_TIME} is not null`];

  if (search && search.trim()) {
    const safe = search.trim().replace(/'/g, "\\'");
    conditions.push(`${DEAL_FIELDS.NAME} like '%${safe}%'`);
  }

  if (statusFilter) {
    const safe = statusFilter.replace(/'/g, "\\'");
    conditions.push(`${DEAL_FIELDS.ENVIA_SHIPMENT_STATUS} = '${safe}'`);
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
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchPage = useCallback(
    async ({ search: s, statusFilter: sf, page: p }) => {
      setLoading(true);
      setError(null);
      try {
        const limit = DEALS_LIST_PAGE_SIZE;
        const offset = p * limit;
        const query = buildQuery({
          search: s,
          statusFilter: sf,
          limit: limit + 1,
          offset,
        });
        const rows = await searchDealsByCOQL(query);
        const trimmed = rows.slice(0, limit);
        setDeals(trimmed);
        setHasMore(rows.length > limit);
      } catch (err) {
        setError(normalizeError(err, "No se pudieron cargar los deals"));
        setDeals([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchPage({ search, statusFilter, page });
  }, [fetchPage, search, statusFilter, page]);

  const reload = useCallback(() => {
    fetchPage({ search, statusFilter, page });
  }, [fetchPage, search, statusFilter, page]);

  const applySearch = useCallback((value) => {
    setSearch(value);
    setPage(0);
  }, []);

  const applyStatusFilter = useCallback((value) => {
    setStatusFilter(value);
    setPage(0);
  }, []);

  return {
    deals,
    loading,
    error,
    search,
    statusFilter,
    page,
    hasMore,
    setSearch: applySearch,
    setStatusFilter: applyStatusFilter,
    setPage,
    reload,
  };
}
