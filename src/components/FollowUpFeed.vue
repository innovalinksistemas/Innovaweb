<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import AppBadge from '@/components/AppBadge.vue';
import ErrorBox from '@/components/ErrorBox.vue';
import { supabase } from '@/lib/supabase';
import { label } from '@/lib/labels';
import { daysLabel, daysUntil, expiryTone, formatDate } from '@/lib/utils';
import { FOLLOW_UP_KINDS, type FollowUp, type FollowUpKind } from '@/lib/types';

const props = defineProps<{ projectId: string; items: FollowUp[] }>();
const emit = defineEmits<{ changed: [] }>();

const error = ref<string | null>(null);
const busy = ref(false);
const draft = reactive({ kind: 'nota' as FollowUpKind, content: '', due_date: '', pinned: false });

const filter = ref<FollowUpKind | ''>('');
const visible = computed(() => {
  const list = filter.value ? props.items.filter((f) => f.kind === filter.value) : props.items;
  // Fijados primero, luego lo más reciente.
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
});

async function run(action: PromiseLike<{ error: { message: string } | null }>) {
  const { error: err } = await action;
  error.value = err?.message ?? null;
  if (!err) emit('changed');
  return !err;
}

async function add() {
  if (!draft.content.trim()) return;
  busy.value = true;
  const saved = await run(
    supabase.from('follow_ups').insert({
      project_id: props.projectId,
      kind: draft.kind,
      content: draft.content.trim(),
      pinned: draft.pinned,
      due_date: draft.kind === 'proximo_paso' && draft.due_date ? draft.due_date : null,
    }),
  );
  busy.value = false;
  if (saved) Object.assign(draft, { content: '', due_date: '', pinned: false });
}

const togglePin = (f: FollowUp) => run(supabase.from('follow_ups').update({ pinned: !f.pinned }).eq('id', f.id));
const toggleDone = (f: FollowUp) => run(supabase.from('follow_ups').update({ done: !f.done }).eq('id', f.id));
const remove = (f: FollowUp) => {
  if (window.confirm('¿Eliminar este seguimiento?')) void run(supabase.from('follow_ups').delete().eq('id', f.id));
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
</script>

<template>
  <div class="space-y-4">
    <ErrorBox :message="error" />

    <form class="card space-y-3" @submit.prevent="add">
      <div class="flex flex-wrap gap-2">
        <label
          v-for="k in FOLLOW_UP_KINDS"
          :key="k"
          class="cursor-pointer rounded-full border px-3 py-1 text-xs"
          :class="draft.kind === k ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-600'"
        >
          <input v-model="draft.kind" class="sr-only" type="radio" :value="k" />{{ label(k) }}
        </label>
      </div>
      <textarea
        v-model="draft.content"
        class="input"
        rows="3"
        :placeholder="draft.kind === 'proximo_paso' ? '¿Qué hay que hacer a continuación?' : draft.kind === 'reunion' ? 'Resumen de la reunión, acuerdos…' : 'Escribe el seguimiento…'"
        required
      />
      <div class="flex flex-wrap items-center gap-4">
        <label v-if="draft.kind === 'proximo_paso'" class="flex items-center gap-2 text-sm">
          Para el <input v-model="draft.due_date" class="input w-auto" type="date" />
        </label>
        <label class="flex items-center gap-2 text-sm text-slate-600">
          <input v-model="draft.pinned" type="checkbox" /> Fijar arriba
        </label>
        <button class="btn ml-auto" type="submit" :disabled="busy">Agregar</button>
      </div>
    </form>

    <div class="flex flex-wrap items-center gap-2 text-sm">
      <span class="text-slate-500">Ver:</span>
      <button type="button" class="rounded-full px-3 py-1" :class="filter === '' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'" @click="filter = ''">
        Todo ({{ items.length }})
      </button>
      <button
        v-for="k in FOLLOW_UP_KINDS"
        :key="k"
        type="button"
        class="rounded-full px-3 py-1"
        :class="filter === k ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'"
        @click="filter = k"
      >
        {{ label(k) }}
      </button>
    </div>

    <p v-if="visible.length === 0" class="card text-sm text-slate-500">Todavía no hay seguimientos.</p>
    <ul v-else class="space-y-3">
      <li v-for="f in visible" :key="f.id" class="card" :class="{ 'border-amber-300 bg-amber-50/40': f.pinned }">
        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span v-if="f.pinned" title="Fijado">📌</span>
          <AppBadge :value="f.kind" />
          <span>{{ f.author_name || f.author_email || 'Equipo' }} · {{ when(f.created_at) }}</span>
          <span v-if="f.kind === 'proximo_paso' && f.due_date && !f.done" :class="expiryTone(daysUntil(f.due_date))">
            · para el {{ formatDate(f.due_date) }} ({{ daysLabel(daysUntil(f.due_date)) }})
          </span>
          <span v-if="f.done" class="text-green-700">· Hecho</span>
        </div>
        <p class="mt-2 whitespace-pre-line text-sm" :class="{ 'text-slate-400 line-through': f.done }">{{ f.content }}</p>
        <div class="mt-3 flex flex-wrap gap-3 text-xs">
          <button v-if="f.kind === 'proximo_paso'" class="link" type="button" @click="toggleDone(f)">
            {{ f.done ? 'Marcar pendiente' : '✓ Marcar hecho' }}
          </button>
          <button class="link" type="button" @click="togglePin(f)">{{ f.pinned ? 'Desfijar' : 'Fijar' }}</button>
          <button class="text-red-700 hover:underline" type="button" @click="remove(f)">Eliminar</button>
        </div>
      </li>
    </ul>
  </div>
</template>
