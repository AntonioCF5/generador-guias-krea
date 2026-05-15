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

function toNumberOrEmpty(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
}

function emptyDraft() {
  return {
    weight: "",
    length: "",
    width: "",
    height: "",
    declaredValue: "",
    description: "",
    status: "draft",
    shipmentId: null,
    result: null,
    errorMsg: null,
  };
}

function draftFromDeal(deal) {
  return {
    ...emptyDraft(),
    weight: toNumberOrEmpty(deal?.[DEAL_FIELDS.PACKAGE_WEIGHT_KG]),
    length: toNumberOrEmpty(deal?.[DEAL_FIELDS.PACKAGE_LENGTH_CM]),
    width: toNumberOrEmpty(deal?.[DEAL_FIELDS.PACKAGE_WIDTH_CM]),
    height: toNumberOrEmpty(deal?.[DEAL_FIELDS.PACKAGE_HEIGHT_CM]),
    declaredValue: toNumberOrEmpty(deal?.[DEAL_FIELDS.PACKAGE_DECLARED_VALUE]),
    description: deal?.[DEAL_FIELDS.PACKAGE_CONTENT] || "",
  };
}

function draftFromDealForChild(deal, totalCount) {
  const totalWeight = Number(deal?.[DEAL_FIELDS.PACKAGE_WEIGHT_KG]) || 0;
  const perGuide = totalCount > 0 ? totalWeight / totalCount : 0;
  return {
    ...emptyDraft(),
    weight: perGuide > 0 ? Number(perGuide.toFixed(2)) : "",
    length: toNumberOrEmpty(deal?.[DEAL_FIELDS.PACKAGE_LENGTH_CM]),
    width: toNumberOrEmpty(deal?.[DEAL_FIELDS.PACKAGE_WIDTH_CM]),
    height: toNumberOrEmpty(deal?.[DEAL_FIELDS.PACKAGE_HEIGHT_CM]),
    declaredValue: "",
    description: "",
  };
}

function validateDraft(draft) {
  const errors = {};
  if (!(Number(draft.weight) > 0)) errors.weight = "Peso > 0";
  if (!(Number(draft.length) > 0)) errors.length = "Largo > 0";
  if (!(Number(draft.width) > 0)) errors.width = "Ancho > 0";
  if (!(Number(draft.height) > 0)) errors.height = "Alto > 0";
  if (!draft.description || !draft.description.trim()) {
    errors.description = "Descripción requerida";
  }
  return errors;
}

function diffDealPackage(deal, draft) {
  const target = {
    [DEAL_FIELDS.PACKAGE_WEIGHT_KG]: Number(draft.weight),
    [DEAL_FIELDS.PACKAGE_LENGTH_CM]: Number(draft.length),
    [DEAL_FIELDS.PACKAGE_WIDTH_CM]: Number(draft.width),
    [DEAL_FIELDS.PACKAGE_HEIGHT_CM]: Number(draft.height),
    [DEAL_FIELDS.PACKAGE_CONTENT]: draft.description.trim(),
  };
  if (draft.declaredValue !== "" && draft.declaredValue !== null) {
    target[DEAL_FIELDS.PACKAGE_DECLARED_VALUE] = Number(draft.declaredValue);
  }
  const patch = {};
  for (const [key, value] of Object.entries(target)) {
    const current = deal?.[key];
    if (current !== value && !(current == null && value === "")) {
      patch[key] = value;
    }
  }
  return patch;
}

function shipmentPayload(draft, index, dealId) {
  const payload = {
    [SHIPMENT_FIELDS.DEAL]: dealId,
    [SHIPMENT_FIELDS.SHIPMENT_INDEX]: index + 1,
    [SHIPMENT_FIELDS.PACKAGE_WEIGHT_KG]: Number(draft.weight),
    [SHIPMENT_FIELDS.PACKAGE_LENGTH_CM]: Number(draft.length),
    [SHIPMENT_FIELDS.PACKAGE_WIDTH_CM]: Number(draft.width),
    [SHIPMENT_FIELDS.PACKAGE_HEIGHT_CM]: Number(draft.height),
    [SHIPMENT_FIELDS.PACKAGE_CONTENT]: draft.description.trim(),
  };
  if (draft.declaredValue !== "" && draft.declaredValue !== null) {
    payload[SHIPMENT_FIELDS.PACKAGE_DECLARED_VALUE] = Number(draft.declaredValue);
  }
  return payload;
}

export default function GenerateGuideModal({ deal, isOpen, onClose, onGenerated }) {
  const [mode, setMode] = useState("single");
  const [shipments, setShipments] = useState(() => [draftFromDeal(deal)]);
  const [generating, setGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(null);
  const [globalError, setGlobalError] = useState(null);
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setMode("single");
      setShipments([draftFromDeal(deal)]);
      setGlobalError(null);
      setCurrentIndex(null);
    }
  }, [isOpen, deal]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" && !generating) onClose();
    };
    document.addEventListener("keydown", onKey);
    if (firstInputRef.current) firstInputRef.current.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, generating, onClose]);

  const perDraftErrors = useMemo(
    () => shipments.map((s) => validateDraft(s)),
    [shipments],
  );
  const allValid = perDraftErrors.every((e) => Object.keys(e).length === 0);
  const okCount = shipments.filter((s) => s.status === "ok").length;
  const errorCount = shipments.filter((s) => s.status === "error").length;
  const hasFailures = errorCount > 0;
  const allOk = shipments.length > 0 && okCount === shipments.length;

  if (!isOpen) return null;

  const updateDraft = (index, patch) => {
    setShipments((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  };

  const handleModeChange = (nextMode) => {
    if (generating || nextMode === mode) return;
    if (nextMode === "multi") {
      const totalWeight =
        Number(deal?.[DEAL_FIELDS.PACKAGE_WEIGHT_KG]) || 0;
      const half = totalWeight > 0 ? Number((totalWeight / 2).toFixed(2)) : "";
      setShipments([
        { ...shipments[0], status: "draft", shipmentId: null, errorMsg: null },
        {
          ...draftFromDealForChild(deal, 2),
          weight: half,
        },
      ]);
    } else {
      // Going back to single keeps the first draft
      setShipments([{ ...shipments[0], status: "draft", shipmentId: null, errorMsg: null }]);
    }
    setMode(nextMode);
    setGlobalError(null);
  };

  const handleCountChange = (nextCount) => {
    if (generating) return;
    const clamped = Math.max(2, Math.min(MAX_SHIPMENTS_PER_DEAL, nextCount));
    if (clamped === shipments.length) return;
    if (clamped > shipments.length) {
      const additions = Array.from({ length: clamped - shipments.length }, () =>
        draftFromDealForChild(deal, clamped),
      );
      setShipments((prev) => {
        const merged = [...prev, ...additions];
        const totalWeight =
          Number(deal?.[DEAL_FIELDS.PACKAGE_WEIGHT_KG]) || 0;
        if (totalWeight > 0) {
          const per = Number((totalWeight / clamped).toFixed(2));
          return merged.map((s) =>
            s.status === "ok"
              ? s
              : { ...s, weight: s.weight === "" ? per : s.weight },
          );
        }
        return merged;
      });
    } else {
      const dropping = shipments.slice(clamped);
      const losingData = dropping.some(
        (s) =>
          s.status === "ok" ||
          s.description?.trim() ||
          s.weight !== "" ||
          s.shipmentId,
      );
      if (losingData) {
        const ok = window.confirm(
          `Se descartarán ${shipments.length - clamped} guías. ¿Continuar?`,
        );
        if (!ok) return;
      }
      setShipments((prev) => prev.slice(0, clamped));
    }
  };

  const submitSingle = async () => {
    const dealId = deal?.[DEAL_FIELDS.ID];
    const draft = shipments[0];
    const patch = diffDealPackage(deal, draft);
    if (Object.keys(patch).length > 0) {
      await updateRecord(MODULES.DEALS, dealId, patch);
    }
    const res = await executeFunction("envia_generate_label", {
      dealId: String(dealId),
    });
    const parsed = parseOutput(res);
    if (!parsed || parsed.ok !== true) {
      const msg =
        parsed?.error?.message ||
        parsed?.error ||
        parsed?.message ||
        "La función devolvió ok=false sin mensaje";
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  };

  const submitMulti = async () => {
    const dealId = deal?.[DEAL_FIELDS.ID];
    let processedOk = 0;
    let processedErr = 0;

    for (let i = 0; i < shipments.length; i += 1) {
      const draft = shipments[i];
      if (draft.status === "ok") continue;
      setCurrentIndex(i);

      try {
        let shipmentId = draft.shipmentId;
        if (!shipmentId) {
          updateDraft(i, { status: "creating", errorMsg: null });
          const payload = shipmentPayload(draft, i, dealId);
          shipmentId = await insertRecord(MODULES.ENVIA_SHIPMENTS, payload);
          if (!shipmentId) throw new Error("Zoho no devolvió un ID de shipment");
          updateDraft(i, { shipmentId });
        } else {
          updateDraft(i, { status: "creating", errorMsg: null });
          const payload = shipmentPayload(draft, i, dealId);
          delete payload[SHIPMENT_FIELDS.DEAL];
          await updateRecord(MODULES.ENVIA_SHIPMENTS, shipmentId, payload);
        }

        updateDraft(i, { status: "generating" });
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
        updateDraft(i, { status: "ok", result: parsed.data, errorMsg: null });
        processedOk += 1;
      } catch (err) {
        console.error(`[GenerateGuideModal] shipment ${i + 1} failed:`, err);
        updateDraft(i, { status: "error", errorMsg: err.message });
        processedErr += 1;
      }
    }

    setCurrentIndex(null);

    try {
      await updateRecord(MODULES.DEALS, dealId, {
        [DEAL_FIELDS.TOTAL_GUIAS]: shipments.length,
      });
    } catch (err) {
      console.warn("[GenerateGuideModal] Total_Guias update failed:", err);
    }

    return { processedOk, processedErr };
  };

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();
    if (!allValid || generating) return;
    const dealId = deal?.[DEAL_FIELDS.ID];
    if (!dealId) return;

    setGenerating(true);
    setGlobalError(null);
    try {
      if (mode === "single") {
        await submitSingle();
        await onGenerated();
        onClose();
      } else {
        const { processedErr } = await submitMulti();
        await onGenerated();
        if (processedErr === 0) onClose();
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
  const progressPct =
    shipments.length === 0
      ? 0
      : Math.round(((okCount + errorCount) / shipments.length) * 100);

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
              disabled={generating}
            >
              Múltiples guías
            </button>
          </div>

          {mode === "multi" && (
            <div className="multi-count">
              <span className="multi-count__label">¿Cuántas guías?</span>
              <div className="multi-count__stepper">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => handleCountChange(shipments.length - 1)}
                  disabled={generating || shipments.length <= 2}
                  aria-label="Menos guías"
                >
                  −
                </button>
                <span className="multi-count__value">{shipments.length}</span>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => handleCountChange(shipments.length + 1)}
                  disabled={
                    generating || shipments.length >= MAX_SHIPMENTS_PER_DEAL
                  }
                  aria-label="Más guías"
                >
                  +
                </button>
              </div>
              <span className="multi-count__hint">
                Máximo {MAX_SHIPMENTS_PER_DEAL}
              </span>
            </div>
          )}

          {mode === "single" ? (
            <p className="modal__hint">
              Confirma o ajusta los datos del paquete. Se generará{" "}
              <strong>una sola guía</strong>.
            </p>
          ) : (
            <p className="modal__hint">
              Captura el contenido y dimensiones de cada paquete. Mismo
              destinatario, mismo domicilio.
            </p>
          )}

          {generating && shipments.length > 1 && (
            <div className="progress" aria-hidden="true">
              <div
                className="progress__bar"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          {shipments.map((draft, index) => (
            <DraftCard
              key={index}
              index={index}
              total={shipments.length}
              draft={draft}
              errors={perDraftErrors[index]}
              isFocused={index === 0}
              firstInputRef={index === 0 ? firstInputRef : null}
              isCurrent={currentIndex === index}
              disabled={generating || draft.status === "ok"}
              onChange={(patch) => updateDraft(index, patch)}
              showStatus={mode === "multi"}
            />
          ))}

          {globalError && (
            <div className="alert alert--err" role="alert">
              {globalError.message}
            </div>
          )}

          {hasFailures && !generating && (
            <div className="alert alert--err" role="alert">
              {okCount} de {shipments.length} guías generadas. {errorCount} con
              error. Revisa el mensaje en cada guía y reintenta.
            </div>
          )}

          {allOk && mode === "multi" && !generating && (
            <div className="alert alert--ok" role="status">
              {okCount} guías generadas correctamente.
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
            {allOk ? "Cerrar" : "Cancelar"}
          </button>
          <button
            type="button"
            className="btn btn--success btn--sm"
            onClick={handleSubmit}
            disabled={!allValid || generating || allOk}
          >
            {generating ? (
              <>
                <span className="spinner spinner--sm" aria-hidden="true" />
                {mode === "multi"
                  ? `Generando ${(currentIndex ?? 0) + 1} de ${shipments.length}…`
                  : "Generando…"}
              </>
            ) : hasFailures ? (
              <>
                <span className="btn__icon" aria-hidden="true">
                  🔄
                </span>
                Reintentar fallidas
              </>
            ) : (
              <>
                <span className="btn__icon" aria-hidden="true">
                  📦
                </span>
                {mode === "multi"
                  ? `Generar ${shipments.length} guías`
                  : "Generar guía"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function DraftCard({
  index,
  total,
  draft,
  errors,
  firstInputRef,
  isCurrent,
  disabled,
  onChange,
  showStatus,
}) {
  const setField = (key, value) => onChange({ [key]: value });

  return (
    <div
      className={`shipment-draft${isCurrent ? " is-current" : ""}${draft.status === "ok" ? " is-ok" : ""}${draft.status === "error" ? " is-error" : ""}`}
    >
      {showStatus && (
        <div className="shipment-draft__head">
          <span className="shipment-draft__index">
            Guía {index + 1} de {total}
          </span>
          <span className={`shipment-draft__status is-${draft.status}`}>
            {draft.status === "ok" && "✓ Generada"}
            {draft.status === "error" && "✗ Error"}
            {draft.status === "creating" && "Creando…"}
            {draft.status === "generating" && "Generando…"}
            {draft.status === "draft" && "Pendiente"}
          </span>
        </div>
      )}
      <div className="shipment-draft__grid">
        <label className="field field--stacked">
          <span>Peso (kg)</span>
          <input
            ref={firstInputRef}
            type="number"
            min="0"
            step="0.01"
            value={draft.weight}
            onChange={(e) => setField("weight", e.target.value)}
            disabled={disabled}
          />
          {errors.weight && (
            <span className="field__error">{errors.weight}</span>
          )}
        </label>
        <label className="field field--stacked">
          <span>Largo (cm)</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={draft.length}
            onChange={(e) => setField("length", e.target.value)}
            disabled={disabled}
          />
          {errors.length && (
            <span className="field__error">{errors.length}</span>
          )}
        </label>
        <label className="field field--stacked">
          <span>Ancho (cm)</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={draft.width}
            onChange={(e) => setField("width", e.target.value)}
            disabled={disabled}
          />
          {errors.width && (
            <span className="field__error">{errors.width}</span>
          )}
        </label>
        <label className="field field--stacked">
          <span>Alto (cm)</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={draft.height}
            onChange={(e) => setField("height", e.target.value)}
            disabled={disabled}
          />
          {errors.height && (
            <span className="field__error">{errors.height}</span>
          )}
        </label>
        <label className="field field--stacked">
          <span>Valor declarado (MXN)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.declaredValue}
            onChange={(e) => setField("declaredValue", e.target.value)}
            disabled={disabled}
            placeholder="Opcional"
          />
        </label>
      </div>
      <label className="field field--stacked shipment-draft__full">
        <span>Contenido del paquete</span>
        <textarea
          rows={2}
          value={draft.description}
          onChange={(e) => setField("description", e.target.value)}
          disabled={disabled}
          placeholder={
            total > 1
              ? `Ej. Caja ${index + 1}: cuadros enmarcados`
              : "Ej. Cuadro enmarcado 30x40 cm"
          }
        />
        {errors.description && (
          <span className="field__error">{errors.description}</span>
        )}
      </label>
      {draft.status === "error" && draft.errorMsg && (
        <div className="shipment-draft__error" role="alert">
          {draft.errorMsg}
        </div>
      )}
      {draft.status === "ok" && draft.result?.trackingNumber && (
        <div className="shipment-draft__success">
          Tracking: <code>{draft.result.trackingNumber}</code>
        </div>
      )}
    </div>
  );
}
