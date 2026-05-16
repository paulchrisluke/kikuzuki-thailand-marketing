<template>
  <div
    class="tenant-layout saya-theme min-h-screen flex flex-col font-sans bg-default text-default"
    :style="themeStyles"
  >
    <UTheme :ui="{}">
      <SayaHeader />
      <main class="grow">
        <slot />
      </main>
      <SayaFooter />
      <SayaUpgradeModal />
    </UTheme>
  </div>
</template>

<script setup>
const { siteId } = useTenantSite()

const { data: siteConfig } = await useFetch(
  `/api/public/sites/${siteId}/config`,
  { default: () => ({ config: {} }) }
)

const brandColor = computed(() => siteConfig.value?.config?.brand_color || null)
const brandTextColor = computed(() => getContrastColor(brandColor.value))

const themeStyles = computed(() => {
  if (!brandColor.value) return {}
  return {
    '--ui-primary': brandColor.value,
    '--color-primary': brandColor.value,
    '--brand-text-color': brandTextColor.value
  }
})
</script>

<style>
/* Tenant-specific base styles */
.saya-theme .u-button-solid-primary,
.saya-theme .u-button-solid-primary *,
.saya-theme .u-button--solid.u-button--primary,
.saya-theme .u-button--solid.u-button--primary * {
  color: var(--brand-text-color, white) !important;
}

/* Ensure icons also inherit the contrast color when in a primary button */
.saya-theme .u-button-solid-primary .u-icon,
.saya-theme .u-button--solid.u-button--primary .u-icon {
  color: var(--brand-text-color, white) !important;
}
</style>
