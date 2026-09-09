<template>
  <!-- A legal-bar link, styled like the Privacy and Terms links it sits between.
       It carries no colour of its own so it inherits each footer's legal bar;
       the previous hardcoded white was invisible on a light footer. When Zaraz
       has not published its consent API there is nothing to open, so the link
       is not rendered at all rather than shown as a dead control. -->
  <button
    v-if="consentReady"
    type="button"
    class="cursor-pointer bg-transparent p-0 underline-offset-2 transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
    @click="showConsentModal"
  >
    {{ t('legal.cookie_preferences') }}
  </button>
</template>

<script setup lang="ts">
const { t } = useI18n()
const consentReady = ref(false)

function updateConsentReady() {
  consentReady.value = window.zaraz?.consent?.APIReady === true
}

function showConsentModal() {
  if (window.zaraz?.consent) window.zaraz.consent.modal = true
}

onMounted(() => {
  document.addEventListener('zarazConsentAPIReady', updateConsentReady)
  updateConsentReady()
})
onBeforeUnmount(() => document.removeEventListener('zarazConsentAPIReady', updateConsentReady))
</script>
