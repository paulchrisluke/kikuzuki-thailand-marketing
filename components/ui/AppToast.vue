<template>
  <div class="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
    <TransitionGroup
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform translate-x-12 opacity-0"
      enter-to-class="transform translate-x-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-x-0 opacity-100"
      leave-to-class="transform translate-x-12 opacity-0"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto px-6 py-3 rounded-xl shadow-2xl border text-sm font-medium min-w-[280px] flex items-center justify-between gap-4"
        :class="[
          toast.type === 'success' ? 'bg-black text-white border-white/10' : 
          toast.type === 'error' ? 'bg-red-600 text-white border-red-500' : 
          'bg-stone-800 text-white border-white/5'
        ]"
      >
        <span>{{ toast.message }}</span>
        <button 
          @click="removeToast(toast.id)"
          class="opacity-50 hover:opacity-100 transition-opacity p-1"
        >
          ✕
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
const { toasts, removeToast } = useToast()
</script>
