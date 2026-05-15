import { useEffect, useMemo, useRef, useState } from "react";
import { DEAL_FIELDS, MODULES } from "../utils/constants";
import {
  executeFunction,
  normalizeError,
  parseOutput,
  updateRecord,
} from "../utils/zohoApi";

function toNumberOrEmpty(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
}

function buildSingleDraft(deal) {
  return {
    weight: toNumberOrEmpty(deal?.[DEAL_FIELDS.PACKAGE_WEIGHT_KG]),
    length: toNumberOrEmpty(deal?.[DEAL_FIELDS.PACKAGE_LENGTH_CM]),
    width: toNumberOrEmpty(deal?.[DEAL_FIELDS.PACKAGE_WIDTH_CM]),
    height: toNumberOrEmpty(deal?.[DEAL_FIELDS.PACKAGE_HEIGHT_CM]),
    declaredValue: toNumberOrEmpty(deal?.[DEAL_FIELDS.PACKAGE_DECLARED_VALUE]),
    description: deal?.[DEAL_FIELDS.PACKAGE_CONTENT] || "",
  };
}

function validateSingleDraft(draft) {
  const errors = {};
  if (!(Number(draft.weight) > 0)) errors.weight = "Peso requerido (> 0)";
  if (!(Number(draft.length) > 0)) errors.length = "Largo requerido (> 0)";
  if (!(Number(draft.width) > 0)) errors.width = "Ancho requerido (> 0)";
  if (!(Number(draft.height) > 0)) errors.height = "Alto requerido (> 0)";
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

export default function GenerateGuideModal({ deal, isOpen, onClose, onGenerated }) {
  const [draft, setDraft] = useState(() => buildSingleDraft(deal));
  const [generating, setGenerating] = useState(false);
  const [globalError, setGlobalError] = useState(null);
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(buildSingleDraft(deal));
      setGlobalError(null);
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

  const errors = useMemo(() => validateSingleDraft(draft), [draft]);
  const isValid = Object.keys(errors).length === 0;

  if (!isOpen) return null;

  const updateField = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isValid || generating) return;
    const dealId = deal?.[DEAL_FIELDS.ID];
    if (!dealId) return;
    setGenerating(true);
    setGlobalError(null);
    try {
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
      await onGenerated();
      onClose();
    } catch (err) {
      console.error("[GenerateGuideModal] single submit failed:", err);
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

        <form className="modal__body" onSubmit={handleSubmit}>
          <p className="modal__hint">
            Confirma o ajusta los datos del paquete. Se generará{" "}
            <strong>una sola guía</strong> con los datos del pedido.
          </p>

          <div className="shipment-draft">
            <div className="shipment-draft__grid">
              <label className="field field--stacked">
                <span>Peso (kg)</span>
                <input
                  ref={firstInputRef}
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.weight}
                  onChange={(e) => updateField("weight", e.target.value)}
                  disabled={generating}
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
                  onChange={(e) => updateField("length", e.target.value)}
                  disabled={generating}
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
                  onChange={(e) => updateField("width", e.target.value)}
                  disabled={generating}
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
                  onChange={(e) => updateField("height", e.target.value)}
                  disabled={generating}
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
                  onChange={(e) => updateField("declaredValue", e.target.value)}
                  disabled={generating}
                  placeholder="Opcional"
                />
              </label>
            </div>
            <label className="field field--stacked shipment-draft__full">
              <span>Contenido del paquete</span>
              <textarea
                rows={2}
                value={draft.description}
                onChange={(e) => updateField("description", e.target.value)}
                disabled={generating}
                placeholder="Ej. Cuadro enmarcado 30x40 cm"
              />
              {errors.description && (
                <span className="field__error">{errors.description}</span>
              )}
            </label>
          </div>

          {globalError && (
            <div className="alert alert--err" role="alert">
              {globalError.message}
            </div>
          )}
        </form>

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
            disabled={!isValid || generating}
          >
            {generating ? (
              <>
                <span className="spinner spinner--sm" aria-hidden="true" />
                Generando…
              </>
            ) : (
              <>
                <span className="btn__icon" aria-hidden="true">
                  📦
                </span>
                Generar guía
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
