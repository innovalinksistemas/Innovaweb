import { num } from '@/lib/money';
import type { ProjectFinancials } from '@/lib/types';

/**
 * Indicadores de un proyecto.
 * - Costo real = horas × costo/hora de cada persona + gastos ligados al proyecto.
 * - Ingreso = lo facturado sin impuestos; si aún no hay facturas, el presupuesto (ingreso esperado).
 * - Margen = ingreso − costo real.
 */
export function analyze(f: ProjectFinancials) {
  const cost = num(f.total_cost);
  const budget = f.budget == null ? null : num(f.budget);
  const invoicedNet = num(f.invoiced_net);
  const incomeSource: 'facturado' | 'presupuesto' | null = invoicedNet > 0 ? 'facturado' : budget ? 'presupuesto' : null;
  const income = incomeSource === 'facturado' ? invoicedNet : (budget ?? 0);
  const margin = incomeSource ? income - cost : null;
  return {
    cost,
    budget,
    income,
    incomeSource,
    margin,
    marginPct: margin !== null && income > 0 ? margin / income : null,
    budgetUsed: budget ? cost / budget : null,
    missingCostHours: num(f.missing_cost_hours),
  };
}

/** Color según el margen: rojo si pierde, ámbar si es bajo (<20%), verde si es sano. */
export function marginTone(pct: number | null) {
  if (pct === null) return 'text-slate-500';
  if (pct < 0) return 'text-red-700';
  if (pct < 0.2) return 'text-amber-700';
  return 'text-green-700';
}
