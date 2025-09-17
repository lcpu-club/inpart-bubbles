import { Elysia, t } from 'elysia'
import { ElysiaWS } from 'elysia/dist/ws'
import { Member } from './data'

const connections = new Set<ElysiaWS>()
const data = new Map<string, Member>()
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
  const avatar = new URL(member.about.avatar, file.download_url!)
  member.about.avatar = avatar.href
  data.set(file.path, member)
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
        })
      ),
      repository: t.Object({
        name: t.String(),
        owner: t.Object({
          login: t.String(),
        }),
      }),
    }),
    afterHandle({ body }) {
      ;(async () => {
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
          const fileDownloadPath = new URL(
            entry,
            `https://gh.dragoncloud.win/https://raw.githubusercontent.com/lcpu-club/2025-fall-registration/refs/heads/main/`
          )
          const response = await fetch(fileDownloadPath.href)
          const text = await response.text()
          const info = Bun.TOML.parse(text) as Member
          const avatar = new URL(
            info.about.avatar,
            fileDownloadPath.href
          )
          info.about.avatar = avatar.href
          m.set(entry, info)
          data.set(entry, info)
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
    message(ws, msg) {},
  })
  .listen(3000)

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
