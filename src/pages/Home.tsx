import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { go, href } from '../lib/router'
import { supabase } from '../lib/supabase'
import { rpc, type Workspace } from '../lib/social'
import { Alert, Spinner } from '../components/ui'
import Family from '../components/Family'

type Invite = { id: string; workspace: string; name: string; role: string }

export default function Home() {
  const { session, ready, askSignIn } = useAuth()
  const [list, setList] = useState<Workspace[] | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const load = () => {
    supabase.from('sm_workspaces').select('*').order('created_at').then(({ data }) => setList((data as Workspace[]) ?? []))
    rpc<Invite[]>('sm_my_invites').then(setInvites).catch(() => {})
  }
  useEffect(() => { if (session) load() }, [session])

  if (!ready) return <Spinner />
  if (!session) return <Landing onStart={() => askSignIn('Create a free account to start. It also works on CDM Studio.')} />

  async function create(e: FormEvent) {
    e.preventDefault(); setErr('')
    const { data, error } = await supabase.from('sm_workspaces').insert({ name: name.trim().slice(0, 80) }).select('id').single()
    if (error) return setErr(error.message)
    go(`w/${data.id}/settings`)
  }
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Your brands</h1>
      {invites.length > 0 && (
        <div className="card space-y-2 border-teal-300 p-4">
          {invites.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex-1">You are invited to <b>{i.name}</b> as {i.role}</span>
              <button className="btn btn-primary px-3 py-1.5" onClick={async () => { const w = await rpc<string>('sm_accept', { p_invite: i.id, p_accept: true }); go(`w/${w}`) }}>Accept</button>
              <button className="btn btn-ghost px-3 py-1.5" onClick={async () => { await rpc('sm_accept', { p_invite: i.id, p_accept: false }); load() }}>Decline</button>
            </div>
          ))}
        </div>
      )}
      {!list ? <Spinner /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((w) => (
            <a key={w.id} href={href(`w/${w.id}`)} className="card p-5 hover:border-teal-300">
              <h2 className="font-semibold">{w.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{w.brand || 'Add your brand details so the AI writes like you.'}</p>
            </a>
          ))}
        </div>
      )}
      <form onSubmit={create} className="card flex flex-wrap gap-2 p-4">
        <input className="input min-w-0 flex-1" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Business or client name, e.g. Mama Nkechi's Kitchen" aria-label="New brand name" />
        <button className="btn btn-primary">Add a brand</button>
      </form>
      {err && <Alert>{err}</Alert>}
    </div>
  )
}

function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-12 pb-6">
      <section className="rounded-3xl bg-slate-950 px-6 py-12 text-white sm:px-12">
        <p className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-teal-200">Facebook · Instagram · LinkedIn · X</p>
        <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight sm:text-5xl">Your AI social media manager. <span className="text-teal-300">You approve every post.</span></h1>
        <p className="mt-4 max-w-xl text-lg text-slate-300">Tell it about your business once. It plans a month of posts, writes them in your voice, and posts at the best times, but only after you or your approver say yes.</p>
        <button className="btn btn-primary mt-6 px-5 py-3 text-base" onClick={onStart}>Start free</button>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['Plans and writes for you', 'A week or a month of posts from your brand facts, in English, Pidgin, French or any language.'],
          ['Nothing goes out without approval', 'Every post waits for an owner or approver. Any edit after approval needs approval again.'],
          ['Posts on time', 'Approved posts go out at their scheduled time on every account you picked.'],
          ['For agencies and teams', 'One workspace per client. Invite editors to write and approvers to sign off.'],
          ['Safe by design', 'Account connections are encrypted on the server. We never see your passwords.'],
          ['Pay as you go', 'Credits shared with CDM Studio: AI writing costs a few credits; X posts cost a little more because X charges per post.'],
        ].map(([t, d]) => <div key={t} className="card p-5"><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p></div>)}
      </section>
      <Family self="cdmsocial" />
    </div>
  )
}
