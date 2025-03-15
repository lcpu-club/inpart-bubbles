<template>
  <div
    ref="wrapper"
    class="bubble-wrapper"
    :style="{
      top: `${bubble.controls.coordinates.y - bubble.controls.radius}px`,
      left: `${bubble.controls.coordinates.x - bubble.controls.radius}px`,
    }"
  >
    <div
      :style="{
        width: `${bubble.controls.radius * 2}px`,
        height: `${bubble.controls.radius * 2}px`,
        backgroundImage: `url('${bubble.about.avatar}')`,
      }"
      @mouseenter="((bubble.controls.velocity = 0), (hovering = true))"
      @mouseleave="((bubble.controls.velocity = 2), (hovering = false))"
      class="bubble-inner"
      @click="$emit('inspect', bubble)"
    ></div>
    <span class="name-label">{{ bubble.about.name }}</span>
  </div>
</template>

<script setup lang="ts">
import type { Bubble } from '@/data'
import { ref } from 'vue'

defineProps<{
  bubble: Bubble
}>()

defineEmits<{
  inspect: [data: Bubble]
}>()

const hovering = ref(false)
</script>

<style lang="css" scoped>
.bubble-wrapper {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5em;
  animation: appear 1s;
}

.bubble-inner {
  --bubble-size: 80px;
  --transition-duration: 300ms;
  border-radius: 9999px;
  box-shadow:
    1px 1px 4px 0 rgba(0, 0, 0, 0.02),
    2px 2px 8px 0 rgba(0, 0, 0, 0.05),
    4px 4px 16px 0 rgba(0, 0, 0, 0.05),
    8px 8px 32px 0 rgba(0, 0, 0, 0.05),
    inset 3px 3px 8px 0 rgba(0, 0, 0, 0.05),
    inset 6px 6px 12px 0 rgba(0, 0, 0, 0.05);
  background-size: cover;
  transition:
    filter var(--transition-duration),
    box-shadow var(--transition-duration);
}

.bubble-inner:hover {
  filter: brightness(1.1);
  box-shadow:
    1px 1px 6px 0 rgba(0, 0, 0, 0.02),
    2px 2px 12px 0 rgba(0, 0, 0, 0.05),
    4px 4px 24px 0 rgba(0, 0, 0, 0.1),
    8px 8px 64px 0 rgba(0, 0, 0, 0.1),
    inset 3px 3px 8px 0 rgba(0, 0, 0, 0.1),
    inset 6px 6px 12px 0 rgba(0, 0, 0, 0.1);
  z-index: 999;
}

.name-label {
  font-size: 0.8em;
  letter-spacing: 1px;
  color: rgb(164, 164, 164);
}

@keyframes appear {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
</style>
