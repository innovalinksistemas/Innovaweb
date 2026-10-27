<script setup lang="ts">
defineProps<{ href: string | null; label: string }>();
</script>

<template>
  <a v-if="href" :href="href" target="_blank" rel="noopener noreferrer" class="btn-secondary">{{ label }} ↗</a>
</template>
