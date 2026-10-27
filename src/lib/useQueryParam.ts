import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

/** Filtro guardado en la URL (?nombre=valor) para poder compartir o recargar la vista. */
export function useQueryParam(name: string, fallback = '') {
  const route = useRoute();
  const router = useRouter();
  return computed({
    get: () => (typeof route.query[name] === 'string' ? (route.query[name] as string) : fallback),
    set: (value: string) =>
      router.replace({ query: { ...route.query, [name]: value === fallback ? undefined : value || undefined } }),
  });
}
