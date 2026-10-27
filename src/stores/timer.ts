import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { supabase } from '@/lib/supabase';
import type { TimeEntry } from '@/lib/types';

type RunningEntry = TimeEntry & { projects: { id: string; name: string } | null; tasks: { title: string } | null };

/** Cronómetro del usuario actual (uno a la vez, guardado en la base). */
export const useTimerStore = defineStore('timer', () => {
  const running = ref<RunningEntry | null>(null);
  const now = ref(Date.now());
  const error = ref<string | null>(null);
  let tick: ReturnType<typeof setInterval> | null = null;

  const elapsedSeconds = computed(() =>
    running.value?.started_at ? Math.max(0, Math.floor((now.value - new Date(running.value.started_at).getTime()) / 1000)) : 0,
  );
  const elapsedLabel = computed(() => {
    const s = elapsedSeconds.value;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  });

  function setRunning(entry: RunningEntry | null) {
    running.value = entry;
    if (entry && !tick) tick = setInterval(() => (now.value = Date.now()), 1000);
    if (!entry && tick) {
      clearInterval(tick);
      tick = null;
    }
  }

  async function load(memberId: string | null) {
    if (!memberId) return setRunning(null);
    const { data } = await supabase
      .from('time_entries')
      .select('*, projects(id, name), tasks(title)')
      .eq('member_id', memberId)
      .is('hours', null)
      .maybeSingle();
    setRunning((data as RunningEntry | null) ?? null);
  }

  async function start(projectId: string, taskId: string | null = null, description: string | null = null) {
    error.value = null;
    const { data, error: err } = await supabase
      .rpc('start_timer', { p_project: projectId, p_task: taskId, p_description: description })
      .select('*, projects(id, name), tasks(title)')
      .single();
    if (err) return void (error.value = err.message);
    setRunning(data as RunningEntry);
  }

  /** Detiene el cronómetro; devuelve true si se registraron horas. */
  async function stop() {
    error.value = null;
    const { error: err } = await supabase.rpc('stop_timer');
    if (err) {
      error.value = err.message;
      return false;
    }
    setRunning(null);
    return true;
  }

  return { running, elapsedLabel, error, load, start, stop, reset: () => setRunning(null) };
});
