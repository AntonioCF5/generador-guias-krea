import { useMemo, useState } from "react";
import useDealsList from "../hooks/useDealsList";
import useDealsStats from "../hooks/useDealsStats";
import {
  DEAL_FIELDS,
  DEAL_STAGES,
  SHIPMENT_STATUS,
  SHIPMENT_STATUS_LABELS,
} from "../utils/constants";
import {
  formatDate,
  formatDateTime,
  formatStageOrPlaceholder,
  shipmentStatusLabel,
  shipmentStatusModifier,
} from "../utils/formatters";
import { executeFunction, normalizeError } from "../utils/zohoApi";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Todos los estatus" },
  ...Object.values(SHIPMENT_STATUS).map((value) => ({
    value,
    label: SHIPMENT_STATUS_LABELS[value],
  })),
];

const STAGE_FILTER_OPTIONS = [
  { value: "", label: "Todas las etapas" },
  ...DEAL_STAGES.map((stage) => ({ value: stage, label: stage })),
];

const UPCOMING_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function rowDateClass(value, hasGuide) {
  if (hasGuide || !value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const target = startOfLocalDay(parsed);
  const today = startOfLocalDay(new Date());
  const diffDays = Math.round((target - today) / DAY_MS);
  if (diffDays < 0) return "row--overdue";
  if (diffDays <= UPCOMING_DAYS) return "row--upcoming";
  return null;
}

function formatStat(value, loading, approximate = false) {
  if (typeof value === "number") return approximate ? `${value}+` : value;
  return loading ? "…" : "—";
}

function dealHasGuide(deal) {
  return Boolean(
    deal[DEAL_FIELDS.ENVIA_LABEL_URL] ||
      deal[DEAL_FIELDS.ENVIA_TRACKING_NUMBER],
  );
}

export default function DealsList({ initialRecordId, onSelectDeal }) {
  const {
    deals,
    totalCount,
    loading,
    error,
    search,
    statusFilter,
    stageFilter,
    dateFrom,
    dateTo,
    page,
    hasMore,
    setSearch,
    setStatusFilter,
    setStageFilter,
    setDateFrom,
    setDateTo,
    setPage,
    reload,
  } = useDealsList();

  const showingFrom = useMemo(
    () => (deals.length === 0 ? 0 : page * 25 + 1),
    [deals.length, page],
  );
  const showingTo = useMemo(
    () => page * 25 + deals.length,
    [deals.length, page],
  );

  const {
    stats,
    loading: statsLoading,
    error: statsError,
    reload: reloadStats,
  } = useDealsStats();

  const [generatingId, setGeneratingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const handleGenerateLabel = async (deal) => {
    const dealId = deal[DEAL_FIELDS.ID];
    if (!dealId || generatingId) return;
    setGeneratingId(dealId);
    setActionError(null);
    try {
      await executeFunction("envia_generate_label", { deal_id: dealId });
      reload();
      reloadStats();
    } catch (err) {
      console.error("[DealsList] envia_generate_label failed:", err);
      setActionError(normalizeError(err, "No se pudo generar la guía"));
    } finally {
      setGeneratingId(null);
    }
  };

  const sortedDeals = useMemo(() => {
    const priority = (deal) => {
      const isCancelled =
        String(deal[DEAL_FIELDS.ENVIA_SHIPMENT_STATUS] || "").toUpperCase() ===
        "CANCELLED";
      const hasGuide = dealHasGuide(deal);
      if (isCancelled) return 1;
      if (!hasGuide) return 0;
      return 2;
    };
    return [...deals].sort((a, b) => priority(a) - priority(b));
  }, [deals]);

  return (
    <div className="deals-list">
      <header className="topbar">
        <div className="topbar__title">
          <h1>Guías de envío</h1>
          <p className="topbar__subtitle">
            Selecciona un Deal para cotizar y generar su guía con Envia.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            reload();
            reloadStats();
          }}
          disabled={loading || statsLoading}
        >
          {loading || statsLoading ? "Actualizando…" : "Actualizar"}
        </button>
      </header>

      <div className="stats-grid" role="group" aria-label="Resumen de envíos">
        <div className="stat-card stat-card--brand">
          <span className="stat-card__label">Total de órdenes</span>
          <span className="stat-card__value">{formatStat(stats.total, statsLoading, stats.approximate)}</span>
        </div>
        <div className="stat-card stat-card--warn">
          <span className="stat-card__label">Sin guía</span>
          <span className="stat-card__value">{formatStat(stats.withoutGuide, statsLoading, stats.approximate)}</span>
        </div>
        <div className="stat-card stat-card--danger">
          <span className="stat-card__label">Con error</span>
          <span className="stat-card__value">{formatStat(stats.withError, statsLoading)}</span>
        </div>
        <div className="stat-card stat-card--success">
          <span className="stat-card__label">Guías generadas</span>
          <span className="stat-card__value">{formatStat(stats.withGuide, statsLoading, stats.approximate)}</span>
        </div>
      </div>
      {statsError && (
        <div className="alert alert--err" role="alert">
          {statsError.message}
        </div>
      )}

      <div className="card deals-list__filters">
        <label className="field field--stacked">
          <span>Buscar</span>
          <input
            type="search"
            placeholder="Nombre del Deal…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="field field--stacked">
          <span>Estatus de envío</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field field--stacked">
          <span>Etapa</span>
          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
          >
            {STAGE_FILTER_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field field--stacked">
          <span>Fecha desde</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </label>
        <label className="field field--stacked">
          <span>Fecha hasta</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </label>
      </div>

      {error && (
        <div className="alert alert--err" role="alert">
          {error.message}
        </div>
      )}

      {actionError && (
        <div className="alert alert--err" role="alert">
          {actionError.message}
        </div>
      )}

      <div className="card deals-list__table-wrap">
        {loading && deals.length === 0 ? (
          <div className="deals-list__state">Cargando deals…</div>
        ) : !loading && deals.length === 0 ? (
          <div className="deals-list__state empty">
            No se encontraron deals con los filtros actuales.
          </div>
        ) : (
          <table className="list__table">
            <thead>
              <tr>
                <th>Deal</th>
                <th>Número de Orden</th>
                <th>Etapa</th>
                <th>Destino</th>
                <th>Fecha y hora</th>
                <th>Estatus envío</th>
                <th>Actualizado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {sortedDeals.map((deal) => {
                const id = deal[DEAL_FIELDS.ID];
                const isCurrent = id === initialRecordId;
                const status = deal[DEAL_FIELDS.ENVIA_SHIPMENT_STATUS];
                const ciudad = deal[DEAL_FIELDS.CIUDAD];
                const estado = deal[DEAL_FIELDS.ESTADO];
                const destino = [ciudad, estado].filter(Boolean).join(", ") || "—";
                const hasGuide = dealHasGuide(deal);
                const dateClass = rowDateClass(
                  deal[DEAL_FIELDS.FECHA_Y_HORA],
                  hasGuide,
                );
                const rowClass = [
                  isCurrent ? "is-current" : null,
                  dateClass,
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <tr key={id} className={rowClass || undefined}>
                    <td>
                      <div className="deals-list__name">
                        {deal[DEAL_FIELDS.NAME] || "(Sin nombre)"}
                      </div>
                      {deal[DEAL_FIELDS.ENVIA_TRACKING_NUMBER] && (
                        <div className="deals-list__sub">
                          Tracking: {deal[DEAL_FIELDS.ENVIA_TRACKING_NUMBER]}
                        </div>
                      )}
                    </td>
                    <td>{deal[DEAL_FIELDS.NUMERO_DE_ORDEN] || "—"}</td>
                    <td>{formatStageOrPlaceholder(deal[DEAL_FIELDS.STAGE])}</td>
                    <td>{destino}</td>
                    <td>{formatDateTime(deal[DEAL_FIELDS.FECHA_Y_HORA])}</td>
                    <td>
                      <span className={`pill ${shipmentStatusModifier(status)}`}>
                        {shipmentStatusLabel(status)}
                      </span>
                    </td>
                    <td>{formatDate(deal[DEAL_FIELDS.MODIFIED_TIME])}</td>
                    <td className="deals-list__actions">
                      {hasGuide ? (
                        <>
                          {deal[DEAL_FIELDS.ENVIA_LABEL_URL] && (
                            <a
                              className="btn btn--info btn--sm"
                              href={deal[DEAL_FIELDS.ENVIA_LABEL_URL]}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <span className="btn__icon" aria-hidden="true">
                                👁
                              </span>
                              Ver guía
                            </a>
                          )}
                          <button
                            type="button"
                            className="btn btn--warn btn--sm"
                            onClick={() => onSelectDeal?.(deal)}
                            disabled={!onSelectDeal}
                          >
                            <span className="btn__icon" aria-hidden="true">
                              🔄
                            </span>
                            Regenerar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--success btn--sm"
                          onClick={() => handleGenerateLabel(deal)}
                          disabled={generatingId === id || Boolean(generatingId)}
                        >
                          <span className="btn__icon" aria-hidden="true">
                            📦
                          </span>
                          {generatingId === id ? "Generando…" : "Generar guía"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <footer className="deals-list__footer">
        <span className="deals-list__count">
          {deals.length === 0
            ? "Sin resultados"
            : `Mostrando ${showingFrom}–${showingTo} de ${totalCount}`}
        </span>
        <div className="deals-list__pagination">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0 || loading}
          >
            ← Anterior
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setPage(page + 1)}
            disabled={!hasMore || loading}
          >
            Siguiente →
          </button>
        </div>
      </footer>
    </div>
  );
}
