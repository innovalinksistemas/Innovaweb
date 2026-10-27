<script setup lang="ts">
import { computed, ref } from 'vue';

/**
 * Gráfico de línea de UNA serie por día, con área suave, eje Y limpio,
 * cruceta y tooltip al pasar el cursor (o con flechas del teclado).
 */
const props = withDefaults(
  defineProps<{ points: { date: string; value: number }[]; label: string; format?: (v: number) => string; height?: number }>(),
  { format: (v: number) => v.toLocaleString('es'), height: 240 },
);

const W = 720; // ancho interno del viewBox; el SVG escala al contenedor
const M = { top: 12, right: 16, bottom: 28, left: 48 };
const innerW = W - M.left - M.right;
const innerH = computed(() => props.height - M.top - M.bottom);

/** Máximo "redondo" y 4 marcas: 0, ¼, ½, ¾, máx. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

const geo = computed(() => {
  const pts = props.points;
  const max = niceMax(Math.max(...pts.map((p) => p.value), 0));
  const x = (i: number) => M.left + (pts.length > 1 ? (i / (pts.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => M.top + innerH.value - (v / max) * innerH.value;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const base = M.top + innerH.value;
  const area = pts.length ? `${line} L${x(pts.length - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z` : '';
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: max * f, y: y(max * f) }));
  // Etiquetas de fecha: ~6 repartidas
  const step = Math.max(1, Math.ceil(pts.length / 6));
  const xLabels = pts.map((p, i) => ({ i, x: x(i), text: shortDate(p.date) })).filter((l) => l.i % step === 0 || l.i === pts.length - 1);
  return { x, y, line, area, ticks, xLabels, base };
});

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

// ---- Interacción ----
const hover = ref<number | null>(null);
const svgEl = ref<SVGSVGElement | null>(null);

function onMove(e: PointerEvent) {
  const el = svgEl.value;
  if (!el || props.points.length === 0) return;
  const rect = el.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * W;
  const i = Math.round(((px - M.left) / innerW) * (props.points.length - 1));
  hover.value = Math.min(props.points.length - 1, Math.max(0, i));
}
function onKey(e: KeyboardEvent) {
  const last = props.points.length - 1;
  if (e.key === 'ArrowRight') hover.value = Math.min(last, (hover.value ?? -1) + 1);
  else if (e.key === 'ArrowLeft') hover.value = Math.max(0, (hover.value ?? last + 1) - 1);
  else return;
  e.preventDefault();
}

const tip = computed(() => {
  if (hover.value === null) return null;
  const p = props.points[hover.value];
  const xPct = (geo.value.x(hover.value) / W) * 100;
  return {
    p,
    cx: geo.value.x(hover.value),
    cy: geo.value.y(p.value),
    style: { left: `${xPct}%`, transform: `translateX(${xPct > 70 ? '-105%' : '5%'})` },
  };
});

const compactTick = (v: number) => new Intl.NumberFormat('es', { notation: v >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(v);
const showTable = ref(false);
</script>

<template>
  <div>
    <div class="relative">
      <svg
        ref="svgEl"
        :viewBox="`0 0 ${W} ${height}`"
        class="w-full touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        role="img"
        :aria-label="`${label} por día`"
        tabindex="0"
        @pointermove="onMove"
        @pointerleave="hover = null"
        @keydown="onKey"
        @blur="hover = null"
      >
        <!-- Rejilla y eje Y -->
        <g v-for="t in geo.ticks" :key="t.v">
          <line :x1="M.left" :x2="W - M.right" :y1="t.y" :y2="t.y" :stroke="t.v === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'" stroke-width="1" />
          <text :x="M.left - 8" :y="t.y" text-anchor="end" dominant-baseline="middle" font-size="11" fill="var(--viz-muted)" style="font-variant-numeric: tabular-nums">
            {{ compactTick(t.v) }}
          </text>
        </g>
        <!-- Eje X -->
        <text v-for="l in geo.xLabels" :key="l.i" :x="l.x" :y="height - 8" text-anchor="middle" font-size="11" fill="var(--viz-muted)">{{ l.text }}</text>

        <!-- Serie -->
        <path :d="geo.area" fill="var(--viz-series)" fill-opacity="0.1" />
        <path :d="geo.line" fill="none" stroke="var(--viz-series)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />

        <!-- Cruceta -->
        <g v-if="tip">
          <line :x1="tip.cx" :x2="tip.cx" :y1="M.top" :y2="geo.base" stroke="var(--viz-axis)" stroke-width="1" />
          <circle :cx="tip.cx" :cy="tip.cy" r="4.5" fill="var(--viz-series)" stroke="#fff" stroke-width="2" />
        </g>
      </svg>

      <div
        v-if="tip"
        class="pointer-events-none absolute top-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
        :style="tip.style"
        role="status"
      >
        <p class="text-base font-semibold" style="color: var(--viz-ink)">{{ format(tip.p.value) }}</p>
        <p class="flex items-center gap-1.5" style="color: var(--viz-ink-2)">
          <span class="inline-block h-0.5 w-3 rounded" style="background: var(--viz-series)" />{{ label }} · {{ shortDate(tip.p.date) }}
        </p>
      </div>
    </div>

    <button class="mt-2 text-xs text-slate-500 hover:underline" type="button" @click="showTable = !showTable">
      {{ showTable ? 'Ocultar tabla' : 'Ver como tabla' }}
    </button>
    <div v-if="showTable" class="mt-2 max-h-64 overflow-y-auto rounded-md border border-slate-200">
      <table class="w-full text-left text-xs">
        <thead class="sticky top-0 bg-slate-50 text-slate-500">
          <tr><th class="px-3 py-2">Fecha</th><th class="px-3 py-2 text-right">{{ label }}</th></tr>
        </thead>
        <tbody class="divide-y divide-slate-100" style="font-variant-numeric: tabular-nums">
          <tr v-for="p in [...points].reverse()" :key="p.date">
            <td class="px-3 py-1.5">{{ shortDate(p.date) }}</td>
            <td class="px-3 py-1.5 text-right">{{ format(p.value) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
