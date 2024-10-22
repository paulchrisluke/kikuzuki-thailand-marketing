<template>
  <div v-if="show" id="offcanvasBottom" class="offcanvas-content transition-all ease-in-out duration-100 bg-black rounded-t-[32px] pb-12 pt-4 fixed left-0 w-full z-[99] show-offcanvse">
    <div id="offcanvasContent" class="text-center relative z-[999]">
      <div class="-mt-[100px] mb-[34px]">
        <img :src="content.image" class="inline-block xl:max-w-full xl:w-auto lg:max-w-[400px] max-w-[322px] w-full" :alt="content.title" />
      </div>
      <h2 class="text-white text-[34px] font-extrabold max-w-[237px] mx-auto w-full leading-10">{{ content.title }}</h2>
      <p class="text-white max-w-[313px] mx-auto pt-[30px] pb-[35px] text-base font-normal">{{ content.description }}</p>
      <button @click="$emit('close')" type="button" class="btn-close rounded-[64px] border border-white/[30%] flex items-center justify-center uppercase h-[47px] text-white text-[10px] font-bold max-w-[104px] w-full mx-auto gap-3">
        <span>
          <img src="~/assets/images/close.svg" alt="">
        </span>
        close
      </button>
    </div>
    <div class="fixed top-0 left-0 h-screen w-[100vw] bg-black/[50%] z-[99]" @click="$emit('close')"></div>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    required: true,
  },
  content: {
    type: Object,
    required: true,
  },
});
</script>

<style scoped>
/* Add any additional styles if needed */
</style>