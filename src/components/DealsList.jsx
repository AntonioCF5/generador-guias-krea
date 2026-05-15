import { useMemo, useRef, useState } from "react";
import useDealsList from "../hooks/useDealsList";
import useDealsStats from "../hooks/useDealsStats";
import {
  DEAL_FIELDS,
  DEAL_STAGES,
  SHIPMENT_STATUS,
  SHIPMENT_STATUS_LABELS,
} from "../utils/constants";
import {
  carrierLabel,
  formatDate,
  formatDateTime,
  formatStageOrPlaceholder,
  shipmentCountLabel,
  shipmentStatusLabel,
  shipmentStatusModifier,
  trackingUrlFor,
} from "../utils/formatters";
import {
  getDeal,
  normalizeError,
} from "../utils/zohoApi";
import GenerateGuideModal from "./GenerateGuideModal";
import ShipmentsViewModal from "./ShipmentsViewModal";

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

function dealGuidesCount(deal) {
  const n = Number(deal?.[DEAL_FIELDS.TOTAL_GUIAS]);
  return Number.isFinite(n) ? n : 0;
}

function dealIsMulti(deal) {
  return dealGuidesCount(deal) > 1;
}

function dealSubline(deal) {
  const carrier = deal[DEAL_FIELDS.ENVIA_CARRIER];
  const tracking = deal[DEAL_FIELDS.ENVIA_TRACKING_NUMBER];
  return [
    carrier ? carrierLabel(carrier) : null,
    tracking ? `Tracking: ${tracking}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Action buttons for a deal. Reused by the desktop table row and the
 * mobile card so the button logic lives in exactly one place.
 */
function DealActions({
  deal,
  generatingId,
  trackingFetchId,
  downloadingId,
  trackingUrlCache,
  onGenerate,
  onTrack,
  onDownload,
  onViewShipments,
}) {
  const id = deal[DEAL_FIELDS.ID];
  const hasGuide = dealHasGuide(deal);
  const isMulti = dealIsMulti(deal);
  const labelUrl = deal[DEAL_FIELDS.ENVIA_LABEL_URL];
  const tracking = deal[DEAL_FIELDS.ENVIA_TRACKING_NUMBER];
  const carrier = deal[DEAL_FIELDS.ENVIA_CARRIER];
  const cachedTrackUrl = trackingUrlCache.current.get(id);
  const fallbackTrackUrl = trackingUrlFor(carrier, tracking);
  const showTrack = hasGuide && Boolean(cachedTrackUrl || fallbackTrackUrl);
  const isTrackFetching = trackingFetchId === id;
  const isDownloadingThis = downloadingId === id;
  const downloadLocked = Boolean(downloadingId);
  const isGenerating = generatingId === id;
  const generationLocked = Boolean(generatingId);

  if (!hasGuide && !isMulti) {
    return (
      <button
        type="button"
        className="btn btn--success btn--sm"
        onClick={() => onGenerate(deal)}
        disabled={isGenerating || generationLocked}
      >
        {isGenerating ? (
          <span className="spinner spinner--sm" aria-hidden="true" />
        ) : (
          <span className="btn__icon" aria-hidden="true">
            📦
          </span>
        )}
        {isGenerating ? "Generando…" : "Generar guía"}
      </button>
    );
  }

  if (isMulti) {
    return (
      <>
        <button
          type="button"
          className="btn btn--info btn--sm"
          onClick={() => onViewShipments(deal)}
        >
          <span className="btn__icon" aria-hidden="true">
            📦
          </span>
          Ver guías
        </button>
        <button
          type="button"
          className="btn btn--warn btn--sm"
          onClick={() => onGenerate(deal)}
          disabled={isGenerating || generationLocked}
        >
          {isGenerating ? (
            <span className="spinner spinner--sm" aria-hidden="true" />
          ) : (
            <span className="btn__icon" aria-hidden="true">
              🔄
            </span>
          )}
          {isGenerating ? "Generando…" : "Regenerar guías"}
        </button>
      </>
    );
  }

  return (
    <>
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
      {labelUrl && (
        <button
          type="button"
          className="btn btn--info btn--sm"
          onClick={() => onDownload(deal)}
          disabled={isDownloadingThis || downloadLocked}
        >
          {isDownloadingThis ? (
            <span className="spinner spinner--sm" aria-hidden="true" />
          ) : (
            <span className="btn__icon" aria-hidden="true">
              ⬇
            </span>
          )}
          {isDownloadingThis ? "Descargando…" : "Descargar PDF"}
        </button>
      )}
      {showTrack && (
        <button
          type="button"
          className="btn btn--info btn--sm"
          onClick={() => onTrack(deal)}
          disabled={isTrackFetching}
        >
          {isTrackFetching ? (
            <span className="spinner spinner--sm" aria-hidden="true" />
          ) : (
            <span className="btn__icon" aria-hidden="true">
              📍
            </span>
          )}
          Rastrear guía
        </button>
      )}
      <button
        type="button"
        className="btn btn--warn btn--sm"
        onClick={() => onGenerate(deal)}
        disabled={isGenerating || generationLocked}
      >
        {isGenerating ? (
          <span className="spinner spinner--sm" aria-hidden="true" />
        ) : (
          <span className="btn__icon" aria-hidden="true">
            🔄
          </span>
        )}
        {isGenerating ? "Generando…" : "Regenerar guía"}
      </button>
    </>
  );
}

/** Desktop table row. */
function DealRow({ deal, isCurrent, actionsProps }) {
  const status = deal[DEAL_FIELDS.ENVIA_SHIPMENT_STATUS];
  const ciudad = deal[DEAL_FIELDS.CIUDAD];
  const estado = deal[DEAL_FIELDS.ESTADO];
  const destino = [ciudad, estado].filter(Boolean).join(", ") || "—";
  const hasGuide = dealHasGuide(deal);
  const isMulti = dealIsMulti(deal);
  const guidesCount = dealGuidesCount(deal);
  const countLabel = shipmentCountLabel(guidesCount);
  const subline = isMulti ? null : dealSubline(deal);
  const dateClass = rowDateClass(deal[DEAL_FIELDS.FECHA_Y_HORA], hasGuide || isMulti);
  const rowClass = [isCurrent ? "is-current" : null, dateClass]
    .filter(Boolean)
    .join(" ");
  return (
    <tr className={rowClass || undefined}>
      <td>
        <div className="deals-list__name">
          {deal[DEAL_FIELDS.NAME] || "(Sin nombre)"}
        </div>
        {subline && <div className="deals-list__sub">{subline}</div>}
      </td>
      <td>{deal[DEAL_FIELDS.NUMERO_DE_ORDEN] || "—"}</td>
      <td>{formatStageOrPlaceholder(deal[DEAL_FIELDS.STAGE])}</td>
      <td>{destino}</td>
      <td>{formatDateTime(deal[DEAL_FIELDS.FECHA_Y_HORA])}</td>
      <td>
        <div className="deals-list__pills">
          <span className={`pill ${shipmentStatusModifier(status)}`}>
            {shipmentStatusLabel(status)}
          </span>
          {countLabel && (
            <span className="pill pill--count">📦 {countLabel}</span>
          )}
        </div>
      </td>
      <td>{formatDate(deal[DEAL_FIELDS.MODIFIED_TIME])}</td>
      <td className="deals-list__actions">
        <DealActions deal={deal} {...actionsProps} />
      </td>
    </tr>
  );
}

/** Mobile card: name + status + actions, with an expandable details block. */
function DealCard({
  deal,
  isCurrent,
  isExpanded,
  onToggleExpand,
  actionsProps,
}) {
  const id = deal[DEAL_FIELDS.ID];
  const status = deal[DEAL_FIELDS.ENVIA_SHIPMENT_STATUS];
  const ciudad = deal[DEAL_FIELDS.CIUDAD];
  const estado = deal[DEAL_FIELDS.ESTADO];
  const destino = [ciudad, estado].filter(Boolean).join(", ") || "—";
  const hasGuide = dealHasGuide(deal);
  const isMulti = dealIsMulti(deal);
  const guidesCount = dealGuidesCount(deal);
  const countLabel = shipmentCountLabel(guidesCount);
  const subline = isMulti ? null : dealSubline(deal);
  const dateClass = rowDateClass(deal[DEAL_FIELDS.FECHA_Y_HORA], hasGuide || isMulti);
  const cardClass = [
    "deals-list__card",
    isCurrent ? "is-current" : null,
    dateClass,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cardClass}>
      <div className="deals-list__card-head">
        <div className="deals-list__name">
          {deal[DEAL_FIELDS.NAME] || "(Sin nombre)"}
        </div>
        <div className="deals-list__pills">
          <span className={`pill ${shipmentStatusModifier(status)}`}>
            {shipmentStatusLabel(status)}
          </span>
          {countLabel && (
            <span className="pill pill--count">📦 {countLabel}</span>
          )}
        </div>
      </div>
      {subline && <div className="deals-list__sub">{subline}</div>}
      <div className="deals-list__card-actions">
        <DealActions deal={deal} {...actionsProps} />
      </div>
      <button
        type="button"
        className="deals-list__details-toggle"
        onClick={() => onToggleExpand(id)}
        aria-expanded={isExpanded}
      >
        {isExpanded ? "Ocultar detalles ▲" : "Detalles ▼"}
      </button>
      {isExpanded && (
        <dl className="deals-list__card-details">
          <div>
            <dt>Número de orden</dt>
            <dd>{deal[DEAL_FIELDS.NUMERO_DE_ORDEN] || "—"}</dd>
          </div>
          <div>
            <dt>Etapa</dt>
            <dd>{formatStageOrPlaceholder(deal[DEAL_FIELDS.STAGE])}</dd>
          </div>
          <div>
            <dt>Destino</dt>
            <dd>{destino}</dd>
          </div>
          <div>
            <dt>Fecha y hora</dt>
            <dd>{formatDateTime(deal[DEAL_FIELDS.FECHA_Y_HORA])}</dd>
          </div>
          <div>
            <dt>Actualizado</dt>
            <dd>{formatDate(deal[DEAL_FIELDS.MODIFIED_TIME])}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

export default function DealsList({ initialRecordId }) {
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
    refreshDeal,
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
  const [trackingFetchId, setTrackingFetchId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [modalDeal, setModalDeal] = useState(null);
  const [viewShipmentsDeal, setViewShipmentsDeal] = useState(null);
  const trackingUrlCache = useRef(new Map());

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenGenerateModal = (deal) => {
    if (!deal?.[DEAL_FIELDS.ID] || generatingId) return;
    setActionError(null);
    setModalDeal(deal);
  };

  const handleCloseModal = () => {
    setModalDeal(null);
  };

  const handleAfterGenerated = async () => {
    const dealId = modalDeal?.[DEAL_FIELDS.ID];
    if (!dealId) return;
    setGeneratingId(dealId);
    try {
      const fresh = await refreshDeal(dealId);
      if (fresh) {
        trackingUrlCache.current.set(
          dealId,
          fresh[DEAL_FIELDS.ENVIA_TRACKING_URL] || null,
        );
      }
      reloadStats();
    } finally {
      setGeneratingId(null);
    }
  };

  const handleTrack = async (deal) => {
    const id = deal[DEAL_FIELDS.ID];
    const carrier = deal[DEAL_FIELDS.ENVIA_CARRIER];
    const tracking = deal[DEAL_FIELDS.ENVIA_TRACKING_NUMBER];

    let persistedUrl = trackingUrlCache.current.get(id);

    if (persistedUrl === undefined) {
      setTrackingFetchId(id);
      try {
        const fresh = await getDeal(id);
        persistedUrl = fresh?.[DEAL_FIELDS.ENVIA_TRACKING_URL] || null;
        trackingUrlCache.current.set(id, persistedUrl);
      } catch (err) {
        console.error("[tracking] getDeal failed:", err);
        persistedUrl = null;
      } finally {
        setTrackingFetchId(null);
      }
    }

    const finalUrl = persistedUrl || trackingUrlFor(carrier, tracking);
    console.log("[tracking] carrier:", carrier);
    console.log("[tracking] trackingUrl:", finalUrl);

    if (finalUrl) {
      window.open(finalUrl, "_blank", "noopener,noreferrer");
    } else {
      setActionError(
        normalizeError(
          new Error("No hay URL de rastreo disponible para esta guía"),
        ),
      );
    }
  };

  const handleDownloadPdf = async (deal) => {
    const id = deal[DEAL_FIELDS.ID];
    const labelUrl = deal[DEAL_FIELDS.ENVIA_LABEL_URL];
    if (!labelUrl || downloadingId) return;
    const filename = `guia-${deal[DEAL_FIELDS.NUMERO_DE_ORDEN] || id}.pdf`;
    setDownloadingId(id);
    try {
      const response = await fetch(labelUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.warn(
        "[label] descarga directa bloqueada, abriendo pestaña:",
        err,
      );
      window.open(labelUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
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

  const actionsProps = {
    generatingId,
    trackingFetchId,
    downloadingId,
    trackingUrlCache,
    onGenerate: handleOpenGenerateModal,
    onTrack: handleTrack,
    onDownload: handleDownloadPdf,
    onViewShipments: setViewShipmentsDeal,
  };

  const isEmpty = !loading && deals.length === 0;
  const isInitialLoading = loading && deals.length === 0;

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

      <div className="deals-list__results">
        {generatingId && (
          <div
            className="deals-list__overlay"
            role="status"
            aria-live="polite"
          >
            <span className="spinner" aria-hidden="true" />
            <span className="deals-list__overlay-text">
              Generando guía…
            </span>
          </div>
        )}
        {isInitialLoading ? (
          <div className="card deals-list__state">Cargando deals…</div>
        ) : isEmpty ? (
          <div className="card deals-list__state empty">
            No se encontraron deals con los filtros actuales.
          </div>
        ) : (
          <>
            <div className="card deals-list__table-wrap">
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
                  {sortedDeals.map((deal) => (
                    <DealRow
                      key={deal[DEAL_FIELDS.ID]}
                      deal={deal}
                      isCurrent={deal[DEAL_FIELDS.ID] === initialRecordId}
                      actionsProps={actionsProps}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="deals-list__cards">
              {sortedDeals.map((deal) => (
                <DealCard
                  key={deal[DEAL_FIELDS.ID]}
                  deal={deal}
                  isCurrent={deal[DEAL_FIELDS.ID] === initialRecordId}
                  isExpanded={expandedIds.has(deal[DEAL_FIELDS.ID])}
                  onToggleExpand={toggleExpand}
                  actionsProps={actionsProps}
                />
              ))}
            </div>
          </>
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

      <GenerateGuideModal
        deal={modalDeal}
        isOpen={Boolean(modalDeal)}
        onClose={handleCloseModal}
        onGenerated={handleAfterGenerated}
      />

      <ShipmentsViewModal
        deal={viewShipmentsDeal}
        isOpen={Boolean(viewShipmentsDeal)}
        onClose={() => setViewShipmentsDeal(null)}
      />
    </div>
  );
}
