<template>
  <div class="container" ref="container">
    <div class="bg">
      <h1 class="title" :class="{ disconnected: !wsConnected }">
        WELCOME TO LCPU
      </h1>
      <div class="ws-status" :class="{ disconnected: !wsConnected }">
        <div class="indicator"></div>
        <div class="status-msg">
          WebSocket {{ wsConnected ? "Connected" : "Disconnected" }}
        </div>
      </div>
    </div>
    <footer class="footer" :class="{ disconnected: !wsConnected }">
      Linux Club of Peking University, 2025 Fall.
    </footer>
    <BubbleElement
      v-for="entry in bubbles"
      :key="entry[0]"
      :bubble="entry[1]"
      @inspect="dialog?.toggleInspecting(entry[1])"
    />
  </div>
  <Dialog ref="dialog-ref" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";
import type { Bubble, Member } from "./data";
import BubbleElement from "./components/Bubble.vue";
import Dialog from "./components/Dialog.vue";

const bubbles = ref(new Map<string, Bubble>());
const container = useTemplateRef("container");
const dialog = useTemplateRef("dialog-ref");
const wsConnected = ref(false);
let containerWidth: number | undefined;
let containerHeight: number | undefined;
let renderIntervalHandle: number;
let wsClient: WebSocket;
let wsClientHeartbeatIntervalHandle: number;
let resizeOberserver = new ResizeObserver(handleResize);

function handleResize(e: ResizeObserverEntry[]) {
  containerWidth = e[0].contentRect.width;
  containerHeight = e[0].contentRect.height;
}

onMounted(() => {
  if (!container.value) return;
  containerWidth = container.value?.clientWidth;
  containerHeight = container.value?.clientHeight;
  resizeOberserver.observe(container.value);
  renderIntervalHandle = setInterval(update, 25);
  function connectWs() {
    wsClient = new WebSocket("/api/ws");
    wsClient.onopen = () => {
      console.log("WebSocket connected");
      wsConnected.value = true;
    };
    wsClient.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        m: { [key: string]: Member };
        d: string[];
      };
      for (const key of data.d) {
        bubbles.value.delete(key);
      }
      for (const [key, member] of Object.entries(data.m)) {
        if (!containerWidth || !containerHeight) return;
        if (bubbles.value.has(key)) {
          bubbles.value.get(key)!.about = member.about;
          bubbles.value.get(key)!.social = member.social;
          continue;
        }
        const radius = Math.random() * 20 + 40;
        const x = Math.random() * (containerWidth - 2 * radius) + radius;
        const y = Math.random() * (containerHeight - 2 * radius) + radius;
        const dirX = Math.random() * 2 - 1;
        const sgnDirY = Math.random() > 0.5 ? 1 : -1;
        const dirY = sgnDirY * Math.sqrt(1 - dirX ** 2);
        const velocity = Math.random() + 1;
        bubbles.value.set(key, {
          about: member.about,
          social: member.social,
          controls: {
            coordinates: { x, y },
            velocity,
            direction: { x: dirX, y: dirY },
            radius,
          },
        });
      }
    };
    wsClient.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
    wsClient.onclose = () => {
      console.log("WebSocket closed");
      clearInterval(wsClientHeartbeatIntervalHandle);
      wsConnected.value = false;
      setTimeout(function () {
        console.log("reconnect ws...");
        connectWs();
      }, 1000);
    };
    wsClientHeartbeatIntervalHandle = setInterval(() => {
      if (wsClient.readyState !== wsClient.OPEN) {
        clearInterval(wsClientHeartbeatIntervalHandle);
        wsConnected.value = false;
        return;
      }
      wsClient.send("ping");
    }, 5000);
  }
  connectWs();
});

onBeforeUnmount(() => {
  clearInterval(renderIntervalHandle);
  clearInterval(wsClientHeartbeatIntervalHandle);
  wsClient.close();
  if (!container.value) return;
  resizeOberserver.unobserve(container.value);
});

function update() {
  if (!containerHeight || !containerWidth) return;
  for (const bubble of bubbles.value.values()) {
    const { coordinates, velocity, direction, radius } = bubble.controls;
    const dx = velocity * direction.x;
    const dy = velocity * direction.y;
    coordinates.x += dx;
    coordinates.y += dy;
    const nextFrame = {
      x: coordinates.x + dx,
      y: coordinates.y + dy,
    };
    // handle boundaries
    if (nextFrame.x + radius > containerWidth)
      direction.x = -Math.abs(direction.x);
    if (nextFrame.x - radius < 0) direction.x = Math.abs(direction.x);
    if (nextFrame.y + radius > containerHeight)
      direction.y = -Math.abs(direction.y);
    if (nextFrame.y - radius < 0) direction.y = Math.abs(direction.y);
  }
}
</script>

<style lang="css" scoped>
.container {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
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
</style>
