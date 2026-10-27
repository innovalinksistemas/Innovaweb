<script setup lang="ts">
defineProps<{ message?: string | null }>();
</script>

<template>
  <p v-if="message" class="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{{ message }}</p>
</template>
