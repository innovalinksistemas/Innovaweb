import { ref, shallowRef, watch, type WatchSource } from 'vue';

/**
 * Ejecuta una consulta a Supabase y expone data / error / loading.
 * Se vuelve a ejecutar cuando cambia alguna de las fuentes en `deps`.
 * `T` es la forma esperada de los datos (sin tipos generados, Supabase no la conoce).
 */
export function useQuery<T>(
  fetcher: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  deps: WatchSource[] = [],
) {
  const data = shallowRef<T | null>(null);
  const error = ref<string | null>(null);
  const loading = ref(true);

  async function run() {
    loading.value = true;
    const res = await fetcher();
    data.value = res.data as T | null;
    error.value = res.error?.message ?? null;
    loading.value = false;
  }

  watch(deps, run, { immediate: true });
  return { data, error, loading, reload: run };
}
