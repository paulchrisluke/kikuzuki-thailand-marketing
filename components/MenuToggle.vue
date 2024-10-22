<template>
    <a
      href="#"
      class="bg-black menuToggle w-16 h-16 flex items-center justify-center fixed right-4 rounded-[50%] bottom-4 z-[9999]"
      @click.prevent="$emit('toggle')"
    >
      <img v-if="!isOpen" src="~/assets/images/menu-icon.svg" alt="" class="menu-icon-img" />
      <img v-else src="~/assets/images/cross.svg" alt="" class="cross-icon" />
    </a>
  </template>
  
  <script setup>
  const props = defineProps({
    isOpen: {
      type: Boolean,
      required: true,
    },
  });
  </script>
  