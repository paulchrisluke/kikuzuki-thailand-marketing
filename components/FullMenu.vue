<template>
  <div v-if="isOpen" @click.self="closeModal" class="fixed inset-0 h-screen w-screen bg-gray-500/70 z-[99] flex items-center justify-center">
     <!-- Modal Content -->
     <div class="sm:max-w-[540px] max-w-[360px] h-full example overflow-y-auto bg-white mx-auto relative z-[999] rounded-lg">
        <div class="flex items-center p-4 bg-black justify-between">
           <img src="~/assets/images/brand.svg" alt="" class="sm:h-auto h-[30px]">
           <ul>
              <!-- <li class="flex mb-2 items-center justify-center gap-2">
                 <span>
                 <img src="~/assets/images/insta.svg" alt="">
                 </span>
                 <a href="#" class="text-base text-white font-normal">eat.sando</a>
              </li> -->
              <li class="flex mb-2 items-center justify-center gap-2">
                 <button @click="showOrderModal = true" class="text-base text-black bg-white font-semibold py-0 px-8 h-[50px] leading-[18px] hover:bg-transparent hover:border-white hover:text-white flex items-center justify-center border border-solid border-transparent rounded-[48px]">
                   Order Now
                 </button>
              </li>
           </ul>
           <OrderNowModal :show="showOrderModal" @close="showOrderModal = false" />
           <h2 class="text-white sm:text-[40px] text-xl leading-[30px] sm:leading-[40px] font-bold">
              MENU
           </h2>
        </div>
        <menu-html />
     </div>
  </div>
</template>
<script setup>
import { ref } from 'vue';
  const props = defineProps({
    isOpen: {
      type: Boolean,
      required: true,
    },
  });
  const showOrderModal = ref(false);
  const emit = defineEmits(['close'])
  
  function closeModal() {
    emit('close');
  }

  
</script>