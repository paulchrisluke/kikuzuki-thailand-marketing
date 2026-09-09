<template>
  <PlatformButton variant="outline" size="lg" block :disabled="disabled" @click="$emit('activate')">
    <UIcon name="i-simple-icons-whatsapp" class="size-5" />
    {{ label }}
    <UBadge v-if="lastUsed" color="primary" variant="soft" size="sm" class="ml-auto shrink-0">Last used</UBadge>
  </PlatformButton>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ label?: string; lastUsed?: boolean; disabled?: boolean }>(), {
  label: 'Continue with WhatsApp',
  lastUsed: false,
  disabled: false,
})
defineEmits<{ activate: [] }>()
</script>
