import { useCallback, useEffect, useState } from "react";
import { getDeal, normalizeError } from "../utils/zohoApi";
import { CUADROS_SUBFORM } from "../utils/constants";
import {
  expandCuadrosToUnits,
  readCuadrosFromDeal,
} from "../utils/cuadroCalc";

/**
 * Fetch a Deal record fresh and expose:
 *   - cuadros: raw subform rows from Cuadros_Orden
 *   - units:   each row expanded by Cantidad into shippable units
 *
 * The subform is included automatically in getRecord, so a single
 * getDeal() round-trip is enough — no extra call to the subform module.
 */
export default function useDealCuadros(dealId, enabled = true) {
  const [cuadros, setCuadros] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCuadros = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const fresh = await getDeal(dealId);
      const rows = readCuadrosFromDeal(fresh, CUADROS_SUBFORM);
      setCuadros(rows);
      setUnits(expandCuadrosToUnits(rows));
    } catch (err) {
      console.error("[useDealCuadros] fetch failed:", err);
      setError(normalizeError(err, "No se pudieron cargar los cuadros"));
      setCuadros([]);
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    if (enabled && dealId) fetchCuadros();
  }, [enabled, dealId, fetchCuadros]);

  return { cuadros, units, loading, error, reload: fetchCuadros };
}
