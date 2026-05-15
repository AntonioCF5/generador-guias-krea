import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEAL_FIELDS,
  MAX_SHIPMENTS_PER_DEAL,
  MODULES,
  SHIPMENT_FIELDS,
} from "../utils/constants";
import {
  executeFunction,
  insertRecord,
  normalizeError,
  parseOutput,
  updateRecord,
} from "../utils/zohoApi";
import useDealCuadros from "../hooks/useDealCuadros";
import { totalsForUnits } from "../utils/cuadroCalc";

const UNASSIGNED = -1;

function buildAssignmentState(units, count, prevAssignments = null) {
  const next = {};
  units.forEach((u) => {
    const prev = prevAssignments ? prevAssignments[u.key] : undefined;
    if (
      count === 1 ||
      (Number.isInteger(prev) && prev >= 0 && prev < count)
    ) {
      next[u.key] = count === 1 ? 0 : prev;
    } else {
      next[u.key] = UNASSIGNED;
    }
  });
  return next;
}

function unitsForBucket(units, assignments, bucketIdx) {
  return units.filter((u) => assignments[u.key] === bucketIdx);
}

function unassignedCount(units, assignments) {
  return units.filter((u) => assignments[u.key] === UNASSIGNED).length;
}

function emptyBucketsCount(units, assignments, totalBuckets) {
  let empty = 0;
  for (let i = 0; i < totalBuckets; i += 1) {
    if (unitsForBucket(units, assignments, i).length === 0) empty += 1;
  }
  return empty;
}

function dealsPackagePatch(totals) {
  return {
    [DEAL_FIELDS.PACKAGE_WEIGHT_KG]: totals.weight,
    [DEAL_FIELDS.PACKAGE_LENGTH_CM]: totals.length,
    [DEAL_FIELDS.PACKAGE_WIDTH_CM]: totals.width,
    [DEAL_FIELDS.PACKAGE_HEIGHT_CM]: totals.height,
    [DEAL_FIELDS.PACKAGE_CONTENT]: totals.description,
  };
}

function shipmentPayloadFor(totals, index, dealId) {
  return {
    [SHIPMENT_FIELDS.DEAL]: dealId,
    [SHIPMENT_FIELDS.SHIPMENT_INDEX]: index + 1,
    [SHIPMENT_FIELDS.PACKAGE_WEIGHT_KG]: totals.weight,
    [SHIPMENT_FIELDS.PACKAGE_LENGTH_CM]: totals.length,
    [SHIPMENT_FIELDS.PACKAGE_WIDTH_CM]: totals.width,
    [SHIPMENT_FIELDS.PACKAGE_HEIGHT_CM]: totals.height,
    [SHIPMENT_FIELDS.PACKAGE_CONTENT]: totals.description,
  };
}

export default function GenerateGuideModal({ deal, isOpen, onClose, onGenerated }) {
  const dealId = deal?.[DEAL_FIELDS.ID];
  const isDealMulti = Number(deal?.[DEAL_FIELDS.TOTAL_GUIAS]) > 1;

  const { units, loading: loadingCuadros, error: cuadrosError } = useDealCuadros(
    dealId,
    isOpen,
  );

  const [mode, setMode] = useState(isDealMulti ? "multi" : "single");
  const [count, setCount] = useState(isDealMulti
    ? Math.max(2, Number(deal?.[DEAL_FIELDS.TOTAL_GUIAS]) || 2)
    : 1);
  const [assignments, setAssignments] = useState({});
  const [shipmentResults, setShipmentResults] = useState({});
  const [generating, setGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(null);
  const [globalError, setGlobalError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setGlobalError(null);
    setCurrentIndex(null);
    setShipmentResults({});
    const desiredCount = Number(deal?.[DEAL_FIELDS.TOTAL_GUIAS]) || 2;
    const upperBound = Math.min(
      MAX_SHIPMENTS_PER_DEAL,
      Math.max(2, units.length),
    );
    const initialCount = isDealMulti
      ? Math.max(2, Math.min(upperBound, desiredCount))
      : 1;
    const initialMode = isDealMulti && units.length >= 2 ? "multi" : "single";
    setMode(initialMode);
    setCount(initialMode === "multi" ? initialCount : 1);
    setAssignments(buildAssignmentState(units, initialMode === "multi" ? initialCount : 1));
  }, [isOpen, deal, isDealMulti, units]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" && !generating) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, generating, onClose]);

  const bucketTotals = useMemo(() => {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      out.push(totalsForUnits(unitsForBucket(units, assignments, i)));
    }
    return out;
  }, [units, assignments, count]);

  if (!isOpen) return null;

  const hasUnits = units.length > 0;
  const incomplete = units.some((u) => u.incomplete);
  const pendingUnits = unassignedCount(units, assignments);
  const emptyBuckets = emptyBucketsCount(units, assignments, count);

  const canGenerate =
    !generating &&
    hasUnits &&
    !incomplete &&
    (mode === "single"
      ? true
      : pendingUnits === 0 && emptyBuckets === 0 && count >= 2);

  const handleModeChange = (next) => {
    if (generating || next === mode) return;
    if (next === "multi") {
      const initial = Math.max(2, count >= 2 ? count : 2);
      setMode("multi");
      setCount(initial);
      setAssignments(buildAssignmentState(units, initial));
    } else {
      setMode("single");
      setCount(1);
      setAssignments(buildAssignmentState(units, 1));
    }
  };

  const handleCountChange = (next) => {
    if (generating) return;
    const clamped = Math.max(2, Math.min(MAX_SHIPMENTS_PER_DEAL, next));
    if (clamped === count) return;
    setCount(clamped);
    setAssignments((prev) => buildAssignmentState(units, clamped, prev));
  };

  const assignUnit = (unitKey, bucketIdx) => {
    if (generating) return;
    setAssignments((prev) => ({ ...prev, [unitKey]: bucketIdx }));
  };

  const submitSingle = async () => {
    const totals = bucketTotals[0];
    await updateRecord(MODULES.DEALS, dealId, dealsPackagePatch(totals));
    const res = await executeFunction("envia_generate_label", {
      dealId: String(dealId),
    });
    const parsed = parseOutput(res);
    if (!parsed || parsed.ok !== true) {
      const msg =
        parsed?.error?.message ||
        parsed?.error ||
        parsed?.message ||
        "ok=false sin mensaje";
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  };

  const submitMulti = async () => {
    let okCount = 0;
    let errCount = 0;
    const results = {};

    for (let i = 0; i < count; i += 1) {
      const totals = bucketTotals[i];
      setCurrentIndex(i);
      try {
        const payload = shipmentPayloadFor(totals, i, dealId);
        const shipmentId = await insertRecord(MODULES.ENVIA_SHIPMENTS, payload);
        if (!shipmentId) throw new Error("Zoho no devolvió shipmentId");

        const res = await executeFunction(
          "envia_generate_label_for_shipment",
          { shipmentId: String(shipmentId) },
        );
        const parsed = parseOutput(res);
        if (!parsed || parsed.ok !== true) {
          const msg =
            parsed?.error?.message ||
            parsed?.error ||
            parsed?.message ||
            "ok=false sin mensaje";
          throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
        }
        results[i] = { status: "ok", data: parsed.data, shipmentId };
        okCount += 1;
      } catch (err) {
        console.error(`[GenerateGuideModal] shipment ${i + 1} failed:`, err);
        results[i] = { status: "error", error: err.message };
        errCount += 1;
      }
      setShipmentResults({ ...results });
    }

    setCurrentIndex(null);

    try {
      await updateRecord(MODULES.DEALS, dealId, {
        [DEAL_FIELDS.TOTAL_GUIAS]: count,
      });
    } catch (err) {
      console.warn("[GenerateGuideModal] Total_Guias update failed:", err);
    }

    return { okCount, errCount };
  };

  const handleSubmit = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setGlobalError(null);
    try {
      if (mode === "single") {
        await submitSingle();
        await onGenerated();
        onClose();
      } else {
        const { errCount } = await submitMulti();
        await onGenerated();
        if (errCount === 0) onClose();
      }
    } catch (err) {
      console.error("[GenerateGuideModal] submit failed:", err);
      setGlobalError(normalizeError(err, "No se pudo generar la guía"));
    } finally {
      setGenerating(false);
    }
  };

  const handleBackdrop = (event) => {
    if (event.target === event.currentTarget && !generating) onClose();
  };

  const dealName = deal?.[DEAL_FIELDS.NAME] || "este pedido";
  const orderNumber = deal?.[DEAL_FIELDS.NUMERO_DE_ORDEN];
  const totalUnits = units.length;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-guide-title"
      onClick={handleBackdrop}
    >
      <div className="modal">
        <div className="modal__header">
          <div>
            <div className="modal__title" id="generate-guide-title">
              Generar guía
            </div>
            <div className="modal__subtitle">
              {dealName}
              {orderNumber ? ` · Orden ${orderNumber}` : ""}
            </div>
          </div>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            disabled={generating}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="modal__body">
          <div className="guide-mode-toggle" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "single"}
              className={`guide-mode-toggle__btn${mode === "single" ? " is-active" : ""}`}
              onClick={() => handleModeChange("single")}
              disabled={generating}
            >
              Una sola guía
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "multi"}
              className={`guide-mode-toggle__btn${mode === "multi" ? " is-active" : ""}`}
              onClick={() => handleModeChange("multi")}
              disabled={generating || totalUnits < 2}
              title={totalUnits < 2 ? "Necesitas al menos 2 cuadros" : ""}
            >
              Múltiples guías
            </button>
          </div>

          {loadingCuadros && (
            <div className="deals-list__state">Cargando cuadros…</div>
          )}

          {cuadrosError && (
            <div className="alert alert--err" role="alert">
              {cuadrosError.message}
            </div>
          )}

          {!loadingCuadros && !hasUnits && (
            <div className="alert alert--err" role="alert">
              Este pedido no tiene cuadros capturados en{" "}
              <strong>Cuadros_Orden</strong>. Agrega al menos un cuadro al
              Deal antes de generar la guía.
            </div>
          )}

          {hasUnits && incomplete && (
            <div className="alert alert--err" role="alert">
              Hay cuadros sin medidas (Base o Altura en 0). Completa los
              datos en el subform <strong>Cuadros_Orden</strong> antes de
              continuar.
            </div>
          )}

          {hasUnits && mode === "multi" && (
            <div className="multi-count">
              <span className="multi-count__label">¿Cuántas guías?</span>
              <div className="multi-count__stepper">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => handleCountChange(count - 1)}
                  disabled={generating || count <= 2}
                >
                  −
                </button>
                <span className="multi-count__value">{count}</span>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => handleCountChange(count + 1)}
                  disabled={
                    generating ||
                    count >= Math.min(MAX_SHIPMENTS_PER_DEAL, totalUnits)
                  }
                >
                  +
                </button>
              </div>
              <span className="multi-count__hint">
                Máx. {Math.min(MAX_SHIPMENTS_PER_DEAL, totalUnits)} ·{" "}
                {pendingUnits === 0
                  ? "Todos los cuadros asignados ✓"
                  : `${pendingUnits} cuadro${pendingUnits === 1 ? "" : "s"} sin asignar`}
              </span>
            </div>
          )}

          {hasUnits && mode === "single" && (
            <SingleSummary totals={bucketTotals[0]} units={units} />
          )}

          {hasUnits && mode === "multi" && (
            <MultiAssignment
              units={units}
              count={count}
              assignments={assignments}
              bucketTotals={bucketTotals}
              shipmentResults={shipmentResults}
              currentIndex={currentIndex}
              disabled={generating}
              onAssign={assignUnit}
            />
          )}

          {globalError && (
            <div className="alert alert--err" role="alert">
              {globalError.message}
            </div>
          )}
        </div>

        <div className="modal__footer">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onClose}
            disabled={generating}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--success btn--sm"
            onClick={handleSubmit}
            disabled={!canGenerate}
          >
            {generating ? (
              <>
                <span className="spinner spinner--sm" aria-hidden="true" />
                {mode === "multi"
                  ? `Generando ${(currentIndex ?? 0) + 1} de ${count}…`
                  : "Generando…"}
              </>
            ) : (
              <>
                <span className="btn__icon" aria-hidden="true">
                  📦
                </span>
                {mode === "multi"
                  ? `Generar ${count} guías`
                  : "Generar guía"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SingleSummary({ totals, units }) {
  return (
    <div className="single-summary">
      <div className="single-summary__head">
        <strong>{units.length}</strong>{" "}
        cuadro{units.length === 1 ? "" : "s"} en una sola guía
      </div>
      <ul className="cuadro-list">
        {units.map((u) => (
          <li key={u.key} className="cuadro-list__item">
            <span className="cuadro-list__name">{u.name}</span>
            <span className="cuadro-list__dims">
              {u.base}×{u.altura} cm
              {u.unitsInRow > 1 && (
                <span className="cuadro-list__unit">
                  {" "}
                  · u{u.unitIndex}/{u.unitsInRow}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <TotalsRow totals={totals} />
    </div>
  );
}

function MultiAssignment({
  units,
  count,
  assignments,
  bucketTotals,
  shipmentResults,
  currentIndex,
  disabled,
  onAssign,
}) {
  const buckets = [];
  for (let i = 0; i < count; i += 1) {
    buckets.push({ idx: i, units: unitsForBucket(units, assignments, i) });
  }
  const unassigned = units.filter((u) => assignments[u.key] === UNASSIGNED);

  return (
    <div className="bucket-board">
      {unassigned.length > 0 && (
        <div className="bucket bucket--unassigned">
          <div className="bucket__head">
            <span>Sin asignar</span>
            <span className="bucket__count">
              {unassigned.length} cuadro{unassigned.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="cuadro-list">
            {unassigned.map((u) => (
              <UnitRow
                key={u.key}
                unit={u}
                bucket={UNASSIGNED}
                bucketCount={count}
                disabled={disabled}
                onAssign={onAssign}
              />
            ))}
          </ul>
        </div>
      )}

      {buckets.map(({ idx, units: bucketUnits }) => {
        const result = shipmentResults[idx];
        const isCurrent = currentIndex === idx;
        const cls = [
          "bucket",
          isCurrent ? "is-current" : null,
          result?.status === "ok" ? "is-ok" : null,
          result?.status === "error" ? "is-error" : null,
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div key={idx} className={cls}>
            <div className="bucket__head">
              <span>Guía {idx + 1}</span>
              {result?.status === "ok" && (
                <span className="bucket__status is-ok">✓ Generada</span>
              )}
              {result?.status === "error" && (
                <span className="bucket__status is-error">✗ Error</span>
              )}
              {isCurrent && !result && (
                <span className="bucket__status is-creating">Generando…</span>
              )}
            </div>
            {bucketUnits.length === 0 ? (
              <div className="bucket__empty">Sin cuadros asignados</div>
            ) : (
              <>
                <ul className="cuadro-list">
                  {bucketUnits.map((u) => (
                    <UnitRow
                      key={u.key}
                      unit={u}
                      bucket={idx}
                      bucketCount={count}
                      disabled={disabled}
                      onAssign={onAssign}
                    />
                  ))}
                </ul>
                <TotalsRow totals={bucketTotals[idx]} />
              </>
            )}
            {result?.status === "ok" && result.data?.trackingNumber && (
              <div className="bucket__success">
                Tracking: <code>{result.data.trackingNumber}</code>
              </div>
            )}
            {result?.status === "error" && (
              <div className="bucket__error">{result.error}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UnitRow({ unit, bucket, bucketCount, disabled, onAssign }) {
  return (
    <li className="cuadro-list__item">
      <span className="cuadro-list__name">{unit.name}</span>
      <span className="cuadro-list__dims">
        {unit.base}×{unit.altura} cm
        {unit.unitsInRow > 1 && (
          <span className="cuadro-list__unit">
            {" "}
            · u{unit.unitIndex}/{unit.unitsInRow}
          </span>
        )}
      </span>
      <select
        className="cuadro-list__select"
        value={bucket}
        onChange={(e) => onAssign(unit.key, Number(e.target.value))}
        disabled={disabled}
      >
        <option value={UNASSIGNED}>Sin asignar</option>
        {Array.from({ length: bucketCount }).map((_, i) => (
          <option key={i} value={i}>
            Guía {i + 1}
          </option>
        ))}
      </select>
    </li>
  );
}

function TotalsRow({ totals }) {
  return (
    <div className="totals-row" aria-label="Totales calculados">
      <span>
        <strong>{totals.weight}</strong> kg
      </span>
      <span>
        <strong>{totals.length}</strong>×<strong>{totals.width}</strong>×
        <strong>{totals.height}</strong> cm
      </span>
    </div>
  );
}
