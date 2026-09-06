<template>
  <button
    type="button"
    class="inline-flex min-h-9 items-center rounded-full border border-white/40 bg-white/10 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:border-white/70 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    :disabled="!consentReady"
    @click="showConsentModal"
  >
    {{ t(consentReady ? 'legal.cookie_preferences' : 'legal.cookie_preferences_unavailable') }}
  </button>
</template>

<script setup lang="ts">
const { t } = useI18n()
const consentReady = ref(false)

function updateConsentReady() {
  consentReady.value = window.zaraz?.consent?.APIReady === true
}

function showConsentModal() {
  updateConsentReady()
  if (consentReady.value && window.zaraz?.consent) {
    window.zaraz.consent.modal = true
  }
}

onMounted(() => {
  document.addEventListener('zarazConsentAPIReady', updateConsentReady)
  updateConsentReady()
})
onBeforeUnmount(() => document.removeEventListener('zarazConsentAPIReady', updateConsentReady))
</script>
