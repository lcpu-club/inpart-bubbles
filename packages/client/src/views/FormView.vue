<template>
  <main class="form-page">
    <form class="form" @submit.prevent="handleSubmit">
      <header class="head">
        <p class="eyebrow">LCPU</p>
        <h1>百团大战打卡</h1>
        <p class="sub">请填写以下信息，提交后将实时同步到展示页面。</p>
      </header>

      <section class="field">
        <label class="label" for="name"><span class="required">*</span>姓名</label>
        <input id="name" v-model="form.name" type="text" required />
      </section>

      <section class="field">
        <label class="label" for="avatar"><span class="required">*</span>头像</label>
        <input id="avatar" type="file" accept="image/*" required @change="onFileChange" />
        <p class="hint">最多上传1张图片，单张图片10MB以内</p>
      </section>

      <section class="field">
        <label class="label" for="hobbies">爱好</label>
        <p class="hint">使用半角逗号 "," 分隔</p>
        <input
          id="hobbies"
          v-model="form.hobbies"
          type="text"
          placeholder="例如：羽毛球, 电影, 徒步"
        />
      </section>

      <section class="field">
        <label class="label" for="skills">技能</label>
        <p class="hint">使用半角逗号 "," 分隔</p>
        <input
          id="skills"
          v-model="form.skills"
          type="text"
          placeholder="例如：Go, Linux, Docker"
        />
      </section>

      <section class="field">
        <label class="label" for="website">个人网站</label>
        <input id="website" v-model="form.website" type="url" placeholder="https://example.com" />
      </section>

      <section class="field">
        <label class="label" for="github">GitHub 用户名</label>
        <input id="github" v-model="form.github" type="text" placeholder="yourname" />
      </section>

      <div class="action-row">
        <button :disabled="submitting" type="submit">
          {{ submitting ? '卡...' : '打' }}
        </button>
        <p v-if="message" class="message" :class="{ error: messageType === 'error' }">
          {{ message }}
        </p>
      </div>
    </form>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue'

const form = reactive({
  name: '',
  hobbies: '',
  skills: '',
  website: '',
  github: '',
})

const avatar = ref(null)
const submitting = ref(false)
const message = ref('')
const messageType = ref('success')

function onFileChange(event) {
  const input = event.target
  const file = input.files?.[0]
  avatar.value = file || null
}

async function handleSubmit() {
  if (!avatar.value) {
    messageType.value = 'error'
    message.value = '请先上传头像。'
    return
  }
  if (avatar.value.size > 10 * 1024 * 1024) {
    messageType.value = 'error'
    message.value = '图片大小不能超过 10MB。'
    return
  }

  submitting.value = true
  message.value = ''

  try {
    const payload = new FormData()
    payload.set('name', form.name)
    payload.set('hobbies', form.hobbies)
    payload.set('skills', form.skills)
    payload.set('website', form.website)
    payload.set('github', form.github)
    payload.set('avatar', avatar.value)

    const response = await fetch('/api/form-pushed', {
      method: 'POST',
      body: payload,
    })

    if (!response.ok) {
      throw new Error(await response.text())
    }

    messageType.value = 'success'
    message.value = '打到了！'
    form.name = ''
    form.hobbies = ''
    form.skills = ''
    form.website = ''
    form.github = ''
    avatar.value = null
    const input = document.getElementById('avatar')
    if (input instanceof HTMLInputElement) {
      input.value = ''
    }
  } catch (error) {
    messageType.value = 'error'
    message.value = `没打到：${error instanceof Error ? error.message : '未知错误'}`
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.form-page {
  --accent: #2f6fed;
  --accent-strong: #1f56c1;
  --text-main: #1f2937;
  --text-muted: #64748b;
  --border: #d4deee;
  --surface: #ffffff;
  --surface-soft: #f6f9ff;

  display: flex;
  justify-content: center;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 36px 16px 0 16px;
  background:
    radial-gradient(circle at 0% 0%, #eef5ff 0, transparent 38%),
    radial-gradient(circle at 100% 100%, #f0fff8 0, transparent 42%), #f7f9fc;
}

.form {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px;
  border-radius: 18px 18px 0 0;
  border: 1px solid var(--border);
  border-bottom: none;
  box-sizing: border-box;
  background: var(--surface);
  box-shadow:
    0 20px 40px rgba(29, 46, 86, 0.07),
    0 2px 6px rgba(20, 31, 61, 0.04);
}

.head {
  margin-bottom: 4px;
}

.eyebrow {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
  font-weight: 700;
}

.head h1 {
  margin: 8px 0 6px;
  font-size: 30px;
  color: var(--text-main);
  line-height: 1.18;
}

.sub {
  margin: 0;
  color: var(--text-muted);
  font-size: 15px;
  line-height: 1.5;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--text-main);
}

.required {
  color: #de3c3c;
  margin-right: 4px;
}

.hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
}

input[type='text'],
input[type='url'],
input[type='file'] {
  border: 1px solid #c6d4ec;
  border-radius: 10px;
  padding: 12px 13px;
  font-size: 16px;
  background: #fff;
  color: var(--text-main);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

input::placeholder {
  color: #9ba8bf;
}

input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(47, 111, 237, 0.15);
}

input[type='file'] {
  padding: 9px 10px;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 4px;
}

button {
  min-width: 140px;
  border: 0;
  border-radius: 10px;
  background: var(--accent);
  color: white;
  font-size: 16px;
  font-weight: 600;
  padding: 11px 16px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  box-shadow: none;
}

.message {
  margin: 0;
  font-size: 14px;
  color: #0f7a3e;
}

.message.error {
  color: #c33131;
}

@media (max-width: 640px) {
  .form-page {
    padding: 0;
  }

  .form {
    padding: 36px 12px;
    gap: 12px;
    border: none;
    border-radius: 0;
  }

  .head h1 {
    font-size: 25px;
  }

  .head {
    padding: 0 12px;
  }

  .field {
    padding: 12px;
  }

  .label {
    font-size: 16px;
  }

  .action-row {
    flex-direction: column;
    align-items: flex-start;
    padding: 0 12px;
    gap: 8px;
  }
}
</style>
