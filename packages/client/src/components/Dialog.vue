<template>
  <Transition>
    <div v-if="bubble" class="dialog-backdrop" @click="toggleInspecting(undefined)">
      <div class="dialog" @click.stop>
        <img class="avatar" :src="bubble.about.avatar" alt="avatar" />
        <h2 class="name">{{ bubble.about.name }}</h2>
        <div class="horizontal-list">
          <span v-for="hobby in bubble.about.hobbies" :key="hobby">{{ hobby }}</span>
        </div>
        <div class="horizontal-list">
          <span v-for="skill in bubble.about.skills" :key="skill">{{ skill }}</span>
        </div>
        <div v-if="bubble.social" class="horizontal-list">
          <a
            v-if="bubble.social.github"
            :href="`https://github.com/${bubble.social.github}`"
            target="_blank"
          >
            <img class="github-mark" :src="GithubMark" alt="github" />
          </a>
          <a v-if="bubble.social.website" :href="bubble.social.website" target="_blank">
            <img class="website-mark" :src="WebsiteMark" alt="website" />
          </a>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { type Bubble } from '@/data'
import { ref } from 'vue'
import GithubMark from '@/assets/github-mark.svg'
import WebsiteMark from '@/assets/website-mark.svg'
const bubble = ref<Bubble | undefined>()

function toggleInspecting(_bubble: Bubble | undefined) {
  bubble.value = _bubble
}

defineExpose({ toggleInspecting })
</script>

<style lang="css" scoped>
.dialog-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.dialog {
  width: 400px;
  background: white;
  padding: 2em;
  border-radius: 1em;
  box-shadow:
    2px 2px 12px 0 rgba(0, 0, 0, 0.02),
    4px 4px 24px 0 rgba(0, 0, 0, 0.05),
    6px 6px 32px 0 rgba(0, 0, 0, 0.05),
    12px 12px 64px 0 rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 1em;
  align-items: center;
}

.avatar {
  box-shadow:
    1px 1px 4px 0 rgba(0, 0, 0, 0.02),
    2px 2px 8px 0 rgba(0, 0, 0, 0.05),
    4px 4px 16px 0 rgba(0, 0, 0, 0.05),
    8px 8px 32px 0 rgba(0, 0, 0, 0.05),
    inset 3px 3px 8px 0 rgba(0, 0, 0, 0.05),
    inset 6px 6px 12px 0 rgba(0, 0, 0, 0.05);
  height: 80px;
  width: 80px;
  border-radius: 9999px;
  object-fit: cover;
}

.name {
  margin: 0;
}

.horizontal-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
}

.horizontal-list * {
  padding: 0 0.5em;
}

.horizontal-list *:not(:last-child) {
  border-right: 1px solid rgba(0, 0, 0, 0.1);
}

.github-mark {
  height: 1.2em;
}

.website-mark {
  height: 1.4em;
}

.v-enter-active,
.v-leave-active {
  transition: opacity 300ms;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
