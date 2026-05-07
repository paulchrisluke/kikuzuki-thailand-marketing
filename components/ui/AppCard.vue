<template>
  <div
    :class="[
      'rounded-xl overflow-hidden transition-all duration-200',
      variantClasses[variant],
      borderClasses[border],
      {
        'cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-1': hoverable,
        'cursor-default': !hoverable
      }
    ]"
    @click="handleClick"
    v-bind="hoverable ? { role: 'button', tabindex: 0, 'aria-pressed': false } : {}"
    @keydown="hoverable ? handleKeydown : undefined"
  >
    <slot />
  </div>
</template>

<script setup>
const props = defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'elevated', 'outlined'].includes(value)
  },
  border: {
    type: String,
    default: 'none',
    validator: (value) => ['none', 'light', 'medium', 'dark'].includes(value)
  },
  hoverable: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

const variantClasses = {
  default: 'bg-white',
  elevated: 'bg-white shadow-md', // shadow only, no border
  outlined: 'bg-white' // no border here
}

const borderClasses = {
  none: '',
  light: 'border border-stone-200',
  medium: 'border-2 border-stone-300',
  dark: 'border-2 border-stone-900'
}

const handleClick = (event) => {
  if (props.hoverable) {
    emit('click', event)
  }
}

const handleKeydown = (event) => {
  if (!props.hoverable) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    handleClick(event)
  }
}
</script>
