import { useMemo } from "react";
import useDealsList from "../hooks/useDealsList";
import { DEAL_FIELDS, SHIPMENT_STATUS, SHIPMENT_STATUS_LABELS } from "../utils/constants";
import {
  formatDate,
  formatDateTime,
  formatStageOrPlaceholder,
  shipmentStatusLabel,
  shipmentStatusModifier,
} from "../utils/formatters";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Todos los estatus" },
  ...Object.values(SHIPMENT_STATUS).map((value) => ({
    value,
    label: SHIPMENT_STATUS_LABELS[value],
  })),
];

export default function DealsList({ initialRecordId, onSelectDeal }) {
  const {
    deals,
    loading,
    error,
    search,
    statusFilter,
    page,
    hasMore,
    setSearch,
    setStatusFilter,
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
          onClick={reload}
          disabled={loading}
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </header>

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
      </div>

      {error && (
        <div className="alert alert--err" role="alert">
          {error.message}
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
              {deals.map((deal) => {
                const id = deal[DEAL_FIELDS.ID];
                const isCurrent = id === initialRecordId;
                const status = deal[DEAL_FIELDS.ENVIA_SHIPMENT_STATUS];
                const ciudad = deal[DEAL_FIELDS.CIUDAD];
                const estado = deal[DEAL_FIELDS.ESTADO];
                const destino = [ciudad, estado].filter(Boolean).join(", ") || "—";
                return (
                  <tr
                    key={id}
                    className={isCurrent ? "is-current" : undefined}
                  >
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
                    <td>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => onSelectDeal?.(deal)}
                        disabled={!onSelectDeal}
                      >
                        Ver detalle
                      </button>
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
            : `Mostrando ${showingFrom}–${showingTo}`}
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
