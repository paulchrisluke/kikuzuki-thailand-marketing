<template>
  <PlatformButton variant="outline" size="lg" block :loading="loading" :disabled="disabled" @click="$emit('activate')">
    <PlatformGoogleIcon class="size-5" />
    {{ label }}
    <UBadge v-if="lastUsed" color="primary" variant="soft" size="sm" class="ml-auto shrink-0">Last used</UBadge>
  </PlatformButton>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ label?: string; lastUsed?: boolean; loading?: boolean; disabled?: boolean }>(), {
  label: 'Continue with Google',
  lastUsed: false,
  loading: false,
  disabled: false,
})
defineEmits<{ activate: [] }>()
</script>
