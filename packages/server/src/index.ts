import { Elysia, t } from 'elysia'
import { ElysiaWS } from 'elysia/dist/ws'
import { FormPersistedData, Member } from './data'
import { existsSync, readFileSync } from 'fs'
import * as path from "path"
import * as fs from 'fs/promises'
import fg from 'fast-glob'

const connections = new Set<ElysiaWS>()
const data = new Map<string, Member>()

const mode = process.env["BUBBLE_SOURCE"]
const dataDir = path.join(process.cwd(), "data")
const imageDir = path.join(dataDir, "images")
const recordDir = path.join(dataDir, "records")
const maxImageSize = 10 * 1024 * 1024

const checkAndCreateDir = async (dir: string) => {
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true })
  }
}

const parseCsvList = (value: unknown): string[] => {
  if (typeof value !== 'string') return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const normalizeGithub = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
}

const normalizeWebsite = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

const getFileExt = (file: File): string => {
  const ext = path.extname(file.name).toLowerCase()
  if (ext) return ext
  const byMime: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
  }
  return byMime[file.type] ?? '.bin'
}

if (mode === "git") {
  const initialRepository = 'lcpu/2025-fall-registration'
  const initialRepositoryContent = (await (
    await fetch(`https://code.lcpu.dev/api/v1/repos/${initialRepository}/contents/.`)
  ).json()) as {
    name: string
    path: string
    download_url: string | null
    type: 'file' | 'dir'
  }[]

  for (const file of initialRepositoryContent
    .filter((x) => x.type === 'file')
    .filter((x) => x.download_url)
    .filter((x) => x.path.endsWith('.toml'))) {
    const member = Bun.TOML.parse(await (await fetch(file.download_url!)).text()) as Member
    const avatar = new URL(
      member.about.avatar,
      'https://gh.dragoncloud.win/https://raw.githubusercontent.com/lcpu-club/2025-fall-registration/refs/heads/main/',
    )
    member.about.avatar = avatar.href
    data.set(file.path, member)
  }
} else if (mode === "form") {
  await checkAndCreateDir(dataDir)
  await checkAndCreateDir(imageDir)
  await checkAndCreateDir(recordDir)

  const recordFiles = (await fg(path.join(recordDir, '*.json'), {
    absolute: true,
    objectMode: true,
  })) as { name: string, path: string }[]
  recordFiles.sort((a, b) => a.name.localeCompare(b.name)).forEach((file) => {
    try {
      const content = JSON.parse(readFileSync(file.path, 'utf-8')) as {
        time: number
        member: Member
      }
      data.set(file.name.replace(/\.json$/, ''), content.member)
    } catch { }
  })
} else {
  console.error('set env BUBBLE_SOURCE to either "git" or "form"')
  process.exit(1)
}




const app = new Elysia()
  .post('/api/repository-pushed', () => 'thank you.', {
    body: t.Object({
      commits: t.Array(
        t.Object({
          id: t.String(),
          added: t.Array(t.String()),
          removed: t.Array(t.String()),
          modified: t.Array(t.String()),
        }),
      ),
      repository: t.Object({
        name: t.String(),
        owner: t.Object({
          login: t.String(),
        }),
      }),
    }),
    afterHandle({ body }) {
      // avoid blocking response by doing this asynchronously
      ; (async () => {
        const added = new Set<string>()
        const modified = new Set<string>()
        const removed = new Set<string>()
        for (const commit of body.commits) {
          for (const removal of commit.removed.filter((x) => x.endsWith('.toml'))) {
            if (added.has(removal)) {
              added.delete(removal)
              continue
            }
            if (modified.has(removal)) modified.delete(removal)
            removed.add(removal)
          }
          for (const modification of commit.modified.filter((x) => x.endsWith('.toml'))) {
            if (added.has(modification)) continue
            if (removed.has(modification)) continue // should never happen...
            modified.add(modification)
          }
          for (const addition of commit.added.filter((x) => x.endsWith('.toml'))) {
            if (removed.has(addition)) {
              removed.delete(addition)
              modified.add(addition)
            }
            if (modified.has(addition)) continue // should never happen...
            if (removed.has(addition)) {
              removed.delete(addition)
              modified.add(addition)
            }
            added.add(addition)
          }
        }
        const m = new Map()
        for (const entry of [...added, ...modified]) {
          try {
            const fileDownloadPath = new URL(
              entry,
              `https://gh.dragoncloud.win/https://raw.githubusercontent.com/lcpu-club/2025-fall-registration/refs/heads/main/`,
            )
            const response = await fetch(fileDownloadPath.href)
            const text = await response.text()
            // this can throw
            const info = Bun.TOML.parse(text) as Member
            const avatar = new URL(info.about.avatar, fileDownloadPath.href)
            info.about.avatar = avatar.href
            m.set(entry, info)
            data.set(entry, info)
          } catch (e) {
            continue;
          }
        }
        for (const entry of removed) {
          if (data.has(entry)) data.delete(entry)
        }
        const patch = {
          m: Object.fromEntries(m),
          d: Array.from(removed),
        }
        for (const client of connections) {
          client.send(patch)
        }
      })()
    },
  })
  .post('/api/form-pushed', async ({ body, set }) => {
    if (mode !== 'form') {
      set.status = 400
      return 'form mode is disabled'
    }

    const payload = body as Record<string, unknown>
    const name = typeof payload.name === 'string' ? payload.name.trim() : ''
    const avatar = payload.avatar

    if (!name) {
      set.status = 400
      return 'name is required'
    }
    if (!(avatar instanceof File)) {
      set.status = 400
      return 'avatar is required'
    }
    if (avatar.size > maxImageSize) {
      set.status = 413
      return 'avatar is too large'
    }

    const uuid = Bun.randomUUIDv7()
    const imageFileName = `${uuid}${getFileExt(avatar)}`
    const imagePath = path.join(imageDir, imageFileName)
    await Bun.write(imagePath, avatar)

    const member: Member = {
      about: {
        name,
        hobbies: parseCsvList(payload.hobbies),
        skills: parseCsvList(payload.skills),
        avatar: `/api/image/${encodeURIComponent(imageFileName)}`,
      },
    }

    const github = normalizeGithub(payload.github)
    const website = normalizeWebsite(payload.website)
    if (github || website) {
      member.social = {}
      if (github) member.social.github = github
      if (website) member.social.website = website
    }

    const persisted: FormPersistedData = {
      time: Date.now(),
      member,
    }

    const recordPath = path.join(recordDir, `${uuid}.json`)
    await fs.writeFile(recordPath, JSON.stringify(persisted))

    data.set(uuid, member)
    const patch = {
      m: { [uuid]: member },
      d: [],
    }
    for (const client of connections) {
      client.send(patch)
    }

    return { ok: true, id: uuid }
  }, {
    body: t.Any(),
  })
  .get('/api/image/:id', async ({ params, set }) => {
    const fileName = decodeURIComponent(params.id)
    const requestedPath = path.resolve(imageDir, fileName)

    // Prevent path traversal outside imageDir.
    if (!(requestedPath === imageDir || requestedPath.startsWith(imageDir + path.sep))) {
      set.status = 400
      return 'invalid image path'
    }

    const file = Bun.file(requestedPath)
    if (!(await file.exists())) {
      set.status = 404
      return 'image not found'
    }

    return new Response(file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  })
  .get('/api/records/', () => {
    return Object.fromEntries(data)
  })
  .ws('/api/ws', {
    open(ws) {
      connections.add(ws)
      console.log('new connection established')
      ws.send({
        m: Object.fromEntries(data),
        d: [],
      })
    },
    close(ws) {
      connections.delete(ws)
      console.log('connection closed')
    },
    message(ws, msg) { },
  })
  .listen({
    port: 3000,
    hostname: "0.0.0.0"
  })

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)