<template>
  <div class="container" ref="container">
    <div class="bg">
      <h1 class="title" :class="{ disconnected: !wsConnected }">WELCOME TO LCPU</h1>
      <div class="ws-status" :class="{ disconnected: !wsConnected }">
        <div class="indicator"></div>
        <div class="status-msg">WebSocket {{ wsConnected ? 'Connected' : 'Disconnected' }}</div>
      </div>
    </div>
    <footer class="footer" :class="{ disconnected: !wsConnected }">
      Linux Club of Peking University, 2026 Spring.
    </footer>
    <div
      v-if="formUrl && qrCodeDataUrl"
      class="qr-corner"
      :href="formUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      <img :src="qrCodeDataUrl" alt="form qrcode" />
      <span>扫码打卡</span>
    </div>
    <BubbleElement
      v-for="entry in renderEntries"
      :key="entry[0]"
      :member="entry[1].member"
      :controls="entry[1].controls"
      @inspect="dialog?.toggleInspecting(entry[1].member)"
      @hover="setBubblePaused(entry[0], $event)"
    />
  </div>
  <Dialog ref="dialog-ref" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import QRCode from 'qrcode'
import type { BubbleControls, Member } from '@/data'
import BubbleElement from '@/components/Bubble.vue'
import Dialog from '@/components/Dialog.vue'

const members = ref(new Map<string, Member>())
const controls = ref(new Map<string, BubbleControls>())
const container = useTemplateRef('container')
const dialog = useTemplateRef('dialog-ref')
const wsConnected = ref(false)
const formUrl = ref('')
const qrCodeDataUrl = ref('')
let containerWidth: number | undefined
let containerHeight: number | undefined
let animationFrameHandle: number | undefined
let lastAnimationTs = 0
let wsClient: WebSocket
let wsClientHeartbeatIntervalHandle: ReturnType<typeof setInterval>
let isPageVisible = document.visibilityState === 'visible'
let resizeObserver = new ResizeObserver(handleResize)

const baseFrameMs = 25
const maxDeltaMs = 50
const fallbackAvatar =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Crect width='100%25' height='100%25' fill='%23e7e7e7'/%3E%3C/svg%3E"

function normalizeMember(input: unknown): Member | undefined {
  if (!input || typeof input !== 'object') return undefined
  const raw = input as {
    about?: {
      name?: unknown
      avatar?: unknown
      hobbies?: unknown
      skills?: unknown
    }
    social?: {
      github?: unknown
      website?: unknown
    }
  }
  if (!raw.about || typeof raw.about !== 'object') return undefined

  const name = typeof raw.about.name === 'string' ? raw.about.name.trim() : ''
  if (!name) return undefined

  const avatar =
    typeof raw.about.avatar === 'string' && raw.about.avatar.trim()
      ? raw.about.avatar
      : fallbackAvatar
  const hobbies = Array.isArray(raw.about.hobbies)
    ? raw.about.hobbies.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : []
  const skills = Array.isArray(raw.about.skills)
    ? raw.about.skills.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : []

  const member: Member = {
    about: {
      name,
      avatar,
      hobbies,
      skills,
    },
  }

  if (raw.social && typeof raw.social === 'object') {
    const github = typeof raw.social.github === 'string' ? raw.social.github.trim() : ''
    const website = typeof raw.social.website === 'string' ? raw.social.website.trim() : ''
    if (github || website) {
      member.social = {}
      if (github) member.social.github = github
      if (website) member.social.website = website
    }
  }

  return member
}

const renderEntries = computed(() => {
  const list = new Map<string, { member: Member; controls: BubbleControls }>()
  for (const [key, control] of controls.value.entries()) {
    const member = members.value.get(key)
    if (!member) continue
    list.set(key, { member, controls: control })
  }
  return list
})

function setBubblePaused(key: string, paused: boolean) {
  const control = controls.value.get(key)
  if (!control) return
  control.paused = paused
}

async function setupFormQrCode() {
  const url = new URL(window.location.href)
  url.hash = '/form'
  formUrl.value = url.toString()
  qrCodeDataUrl.value = await QRCode.toDataURL(formUrl.value, {
    width: 140,
    margin: 1,
  })
}

function handleResize(e: ResizeObserverEntry[]) {
  containerWidth = e[0].contentRect.width
  containerHeight = e[0].contentRect.height
}

function handleVisibilityChange() {
  isPageVisible = document.visibilityState === 'visible'
  if (isPageVisible) {
    lastAnimationTs = 0
  }
}

function tick(ts: number) {
  if (!isPageVisible) {
    animationFrameHandle = requestAnimationFrame(tick)
    return
  }

  if (lastAnimationTs === 0) {
    lastAnimationTs = ts
    animationFrameHandle = requestAnimationFrame(tick)
    return
  }

  const deltaMs = Math.min(ts - lastAnimationTs, maxDeltaMs)
  lastAnimationTs = ts
  update(deltaMs / baseFrameMs)
  animationFrameHandle = requestAnimationFrame(tick)
}

onMounted(() => {
  if (!container.value) return
  containerWidth = container.value?.clientWidth
  containerHeight = container.value?.clientHeight
  resizeObserver.observe(container.value)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  animationFrameHandle = requestAnimationFrame(tick)
  setupFormQrCode().catch((error) => {
    console.error('failed to generate form qrcode', error)
  })
  function connectWs() {
    wsClient = new WebSocket('/api/ws')
    wsClient.onopen = () => {
      console.log('WebSocket connected')
      wsConnected.value = true
    }
    wsClient.onmessage = (event) => {
      const payload = JSON.parse(event.data) as {
        m?: Record<string, unknown>
        d?: unknown
      }
      const removed = Array.isArray(payload.d)
        ? payload.d.filter((item): item is string => typeof item === 'string')
        : []
      const payloadMembers = payload.m && typeof payload.m === 'object' ? payload.m : {}

      for (const key of removed) {
        members.value.delete(key)
        controls.value.delete(key)
      }
      for (const [key, rawMember] of Object.entries(payloadMembers)) {
        if (!containerWidth || !containerHeight) return
        const member = normalizeMember(rawMember)
        if (!member) {
          continue
        }
        if (members.value.has(key)) {
          members.value.set(key, member)
          continue
        }
        const radius = Math.random() * 20 + 40
        const x = Math.random() * (containerWidth - 2 * radius) + radius
        const y = Math.random() * (containerHeight - 2 * radius) + radius
        const dirX = Math.random() * 2 - 1
        const sgnDirY = Math.random() > 0.5 ? 1 : -1
        const dirY = sgnDirY * Math.sqrt(1 - dirX ** 2)
        const speed = Math.random() + 1
        members.value.set(key, member)
        controls.value.set(key, {
          coordinates: { x, y },
          speed,
          paused: false,
          direction: { x: dirX, y: dirY },
          radius,
        })
      }
    }
    wsClient.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    wsClient.onclose = () => {
      console.log('WebSocket closed')
      clearInterval(wsClientHeartbeatIntervalHandle)
      wsConnected.value = false
      setTimeout(function () {
        console.log('reconnect ws...')
        connectWs()
      }, 1000)
    }
    wsClientHeartbeatIntervalHandle = setInterval(() => {
      if (wsClient.readyState !== wsClient.OPEN) {
        clearInterval(wsClientHeartbeatIntervalHandle)
        wsConnected.value = false
        return
      }
      wsClient.send('ping')
    }, 5000)
  }
  connectWs()
})

onBeforeUnmount(() => {
  if (animationFrameHandle !== undefined) {
    cancelAnimationFrame(animationFrameHandle)
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  clearInterval(wsClientHeartbeatIntervalHandle)
  if (wsClient) {
    wsClient.close()
  }
  if (!container.value) return
  resizeObserver.unobserve(container.value)
})

function update(speedScale = 1) {
  if (!containerHeight || !containerWidth) return
  for (const control of controls.value.values()) {
    const { coordinates, speed, paused, direction, radius } = control
    const currentSpeed = paused ? 0 : speed
    const dx = currentSpeed * direction.x * speedScale
    const dy = currentSpeed * direction.y * speedScale
    coordinates.x += dx
    coordinates.y += dy
    const nextX = coordinates.x + dx
    const nextY = coordinates.y + dy
    if (nextX + radius > containerWidth) direction.x = -Math.abs(direction.x)
    if (nextX - radius < 0) direction.x = Math.abs(direction.x)
    if (nextY + radius > containerHeight) direction.y = -Math.abs(direction.y)
    if (nextY - radius < 0) direction.y = Math.abs(direction.y)
  }
}
</script>

<style lang="css" scoped>
.container {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  position: relative;
}

.title {
  font-weight: 100;
  letter-spacing: 12px;
  text-transform: capitalize;
  color: rgb(194, 241, 194);
}

.title.disconnected {
  color: rgb(255, 207, 207);
}

.bg {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.ws-status {
  display: flex;
  align-items: center;
  margin-top: 4em;
  gap: 0.5em;
  padding: 0.5em 1em;
  border-radius: 9999px;
  background-color: rgb(251, 255, 251);
  color: rgb(194, 241, 194);
}

.ws-status.disconnected {
  background-color: rgb(255, 252, 252);
  color: rgb(255, 207, 207);
}

.ws-status .indicator {
  height: 0.5em;
  width: 0.5em;
  border-radius: 9999px;
  background-color: rgb(194, 241, 194);
  animation: pulse 1s infinite;
}

.ws-status.disconnected .indicator {
  background-color: rgb(255, 207, 207);
  animation: none;
}

@keyframes pulse {
  0% {
    outline: 1px solid rgb(194, 241, 194);
    outline-offset: 0;
  }
  75% {
    outline: 1px solid transparent;
    outline-offset: 5px;
  }
}

.footer {
  position: absolute;
  bottom: 20%;
  width: 100%;
  text-align: center;
  color: rgb(194, 241, 194);
}

.footer.disconnected {
  color: rgb(255, 207, 207);
}

.qr-corner {
  position: absolute;
  right: 20px;
  bottom: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  text-decoration: none;
  color: #3d3d3d;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.qr-corner img {
  width: 100px;
  height: 100px;
}

.qr-corner span {
  font-size: 12px;
}
</style>
