import {
  CUADRO_FIELDS,
  PROFUNDIDAD_CM_PER_CUADRO,
  VOLUMETRIC_DIVISOR,
} from "./constants";

function toPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Expand a subform row into individual shippable units. A row with
 * Cantidad=3 becomes 3 units sharing the same dimensions and design.
 * Each unit gets its own stable key so React can list them and so the
 * user can assign them to different shipments.
 */
function displayNameFor(row, fallbackIdx) {
  const diseno = row[CUADRO_FIELDS.NUMERO_DE_DISENO];
  if (diseno) return String(diseno);
  const integrante = row[CUADRO_FIELDS.INTEGRANTES_NOMBRES];
  if (integrante) return String(integrante);
  const productName = row[CUADRO_FIELDS.PRODUCT]?.name;
  if (productName) return String(productName);
  return `Cuadro ${fallbackIdx}`;
}

export function expandCuadrosToUnits(cuadros = []) {
  const units = [];
  cuadros.forEach((row, rowIdx) => {
    const cantidad = Math.max(1, Math.trunc(Number(row[CUADRO_FIELDS.CANTIDAD]) || 1));
    const base = toPositiveNumber(row[CUADRO_FIELDS.BASE_CM]);
    const altura = toPositiveNumber(row[CUADRO_FIELDS.ALTURA_CM]);
    const name = displayNameFor(row, rowIdx + 1);
    const notas = row[CUADRO_FIELDS.NOTAS] || "";
    const esPers = Boolean(row[CUADRO_FIELDS.ES_PERSONALIZADO]);
    const productName = row[CUADRO_FIELDS.PRODUCT]?.name || "";
    const rowId = row[CUADRO_FIELDS.ID] || `row-${rowIdx}`;
    for (let i = 0; i < cantidad; i += 1) {
      units.push({
        key: `${rowId}__${i + 1}`,
        rowId,
        unitIndex: i + 1,
        unitsInRow: cantidad,
        name,
        productName,
        base,
        altura,
        notas,
        esPersonalizado: esPers,
        incomplete: base <= 0 || altura <= 0,
      });
    }
  });
  return units;
}

/**
 * Compute peso, dims and a human-readable content description for a
 * set of units assigned to the same shipment.
 *
 *   weight  = Σ (Base × Altura × 5 / 5000)        [kg, volumetric]
 *   length  = max(Base) across assigned units      [cm]
 *   width   = max(Altura) across assigned units    [cm]
 *   height  = 5                                    [cm, constant]
 */
export function totalsForUnits(units = []) {
  if (units.length === 0) {
    return {
      weight: 0,
      length: 0,
      width: 0,
      height: PROFUNDIDAD_CM_PER_CUADRO,
      description: "",
      incomplete: false,
      count: 0,
    };
  }

  let weight = 0;
  let maxBase = 0;
  let maxAltura = 0;
  let incomplete = false;
  const byGroup = new Map();

  units.forEach((u) => {
    if (u.incomplete) incomplete = true;
    weight += (u.base * u.altura * PROFUNDIDAD_CM_PER_CUADRO) / VOLUMETRIC_DIVISOR;
    if (u.base > maxBase) maxBase = u.base;
    if (u.altura > maxAltura) maxAltura = u.altura;

    // Group identical pieces (same product + dims) for a compact description.
    const groupKey = `${u.productName || u.name}|${u.base}x${u.altura}`;
    const existing = byGroup.get(groupKey) || {
      label: u.productName || u.name,
      base: u.base,
      altura: u.altura,
      count: 0,
    };
    existing.count += 1;
    byGroup.set(groupKey, existing);
  });

  const description = Array.from(byGroup.values())
    .map((item) => {
      const dims = `${item.base}×${item.altura}cm`;
      return `${item.count}× ${item.label} ${dims}`;
    })
    .join(", ");

  return {
    weight: Number(weight.toFixed(2)),
    length: Number(maxBase.toFixed(1)),
    width: Number(maxAltura.toFixed(1)),
    height: PROFUNDIDAD_CM_PER_CUADRO,
    description,
    incomplete,
    count: units.length,
  };
}

/**
 * Read the Cuadros_Orden subform array out of a Deal record returned
 * by ZOHO.CRM.API.getRecord. Defensive against missing or non-array
 * payloads.
 */
export function readCuadrosFromDeal(deal, subformKey) {
  const raw = deal?.[subformKey];
  if (!Array.isArray(raw)) return [];
  return raw;
}
