<template>
  <div class="tenant-layout min-h-screen flex flex-col font-sans">
    <DefaultHeader />
    <main class="flex-grow">
      <slot />
    </main>
    <DefaultFooter />
  </div>
</template>

<script setup>
import DefaultHeader from '~/components/global/DefaultHeader.vue'
import DefaultFooter from '~/components/global/DefaultFooter.vue'
</script>

<style>
/* Tenant-specific base styles can go here */
</style>
