import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { go, href } from '../lib/router'
import { callFunction, supabase } from '../lib/supabase'
import { fromLocalInput, lengthFor, net, NETWORKS, rpc, STATUS, STUDIO_ACCOUNT, toLocalInput, uploadPicture, when, type Account, type Media, type Platform, type Post, type Result, type Workspace } from '../lib/social'
import { Alert, Icon, Modal, Spinner } from '../components/ui'

const TABS = [['', 'Posts'], ['plan', 'AI plan'], ['accounts', 'Accounts'], ['team', 'Team'], ['settings', 'Brand']] as const

export default function WorkspacePage({ id, tab = '' }: { id: string; tab?: string }) {
  const { session, ready, askSignIn } = useAuth()
  const [w, setW] = useState<Workspace | null | undefined>(undefined)
  const [role, setRole] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const loadAccounts = useCallback(() => supabase.from('sm_accounts').select('*').eq('workspace', id).order('platform').then(({ data }) => setAccounts((data as Account[]) ?? [])), [id])
  useEffect(() => {
    if (!session) return
    supabase.from('sm_workspaces').select('*').eq('id', id).maybeSingle().then(({ data }) => setW((data as Workspace) ?? null))
    rpc<string>('sm_role', { p_ws: id }).then((r) => setRole(r ?? '')).catch(() => {})
    loadAccounts()
  }, [session, id, loadAccounts])
  if (!ready) return <Spinner />
  if (!session) return <Alert tone="info">Sign in to open this brand. <button className="font-semibold underline" onClick={() => askSignIn()}>Sign in</button></Alert>
  if (w === undefined) return <Spinner />
  if (!w) return <Alert>Brand not found. <a className="underline" href="#/">Your brands</a></Alert>
  const approver = role === 'owner' || role === 'approver'
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><a href="#/" className="text-sm text-slate-500 hover:underline">← Your brands</a><h1 className="font-display text-3xl font-bold">{w.name}</h1></div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">You: {role || '…'}</span>
      </div>
      <nav className="flex gap-1 overflow-x-auto" role="tablist">
        {TABS.map(([k, l]) => <a key={k} role="tab" aria-selected={tab === k} href={href(`w/${id}${k ? '/' + k : ''}`)} className={`chip shrink-0 ${tab === k ? 'chip-on' : 'chip-off'}`}>{l}</a>)}
      </nav>
      {tab === '' && <Posts w={w} accounts={accounts} approver={approver} />}
      {tab === 'plan' && <Plan w={w} accounts={accounts} />}
      {tab === 'accounts' && <Accounts w={w} accounts={accounts} approver={approver} reload={loadAccounts} owner={role === 'owner'} />}
      {tab === 'team' && <Team w={w} owner={role === 'owner'} />}
      {tab === 'settings' && <Brand w={w} owner={role === 'owner'} onSaved={setW} />}
    </div>
  )
}

function useRun() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: ReactNode } | null>(null)
  const run = async (fn: () => Promise<ReactNode | void>) => {
    setBusy(true); setMsg(null)
    try { const t = await fn(); if (t) setMsg({ ok: true, text: t }) } catch (e) {
      const m = (e as Error).message
      setMsg({ ok: false, text: <>{m} {/credits/i.test(m) && <a className="font-semibold underline" href={STUDIO_ACCOUNT} target="_blank" rel="noreferrer">Buy credits</a>}</> })
    } finally { setBusy(false) }
  }
  return { busy, run, note: msg && <Alert tone={msg.ok ? 'ok' : undefined}>{msg.text}</Alert> }
}

// ---------- posts: queue, approvals, editor ----------
function Posts({ w, accounts, approver }: { w: Workspace; accounts: Account[]; approver: boolean }) {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [results, setResults] = useState<Record<string, Result[]>>({})
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open')
  const [edit, setEdit] = useState<Post | 'new' | null>(null)
  const { busy, run, note } = useRun()
  const load = useCallback(async () => {
    const { data } = await supabase.from('sm_posts').select('*').eq('workspace', w.id).order('scheduled_at', { ascending: true, nullsFirst: true }).limit(300)
    const list = (data as Post[]) ?? []
    setPosts(list)
    const done = list.filter((p) => ['posted', 'partly', 'failed'].includes(p.status)).map((p) => p.id)
    if (done.length) {
      const { data: r } = await supabase.from('sm_results').select('*').in('post', done)
      const by: Record<string, Result[]> = {}
      for (const x of (r as Result[]) ?? []) (by[x.post] ||= []).push(x)
      setResults(by)
    }
  }, [w.id])
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])
  const shown = (posts ?? []).filter((p) => filter === 'all' || (filter === 'open' ? ['awaiting', 'approved', 'rejected', 'posting'].includes(p.status) : ['posted', 'partly', 'failed'].includes(p.status)))
  const waiting = (posts ?? []).filter((p) => p.status === 'awaiting').length
  const name = (aid: string) => { const a = accounts.find((x) => x.id === aid); return a ? `${net(a.platform).name}: ${a.name}` : 'Removed account' }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={() => setEdit('new')}><Icon.sparkle /> New post</button>
        {(['open', 'done', 'all'] as const).map((f) => <button key={f} className={`chip ${filter === f ? 'chip-on' : 'chip-off'}`} onClick={() => setFilter(f)}>{f === 'open' ? `To do${waiting ? ` (${waiting} to approve)` : ''}` : f === 'done' ? 'Sent' : 'All'}</button>)}
      </div>
      {accounts.length === 0 && <Alert tone="info">Connect your accounts first: <a className="font-semibold underline" href={href(`w/${w.id}/accounts`)}>Accounts</a>.</Alert>}
      {note}
      {!posts ? <Spinner /> : shown.length === 0 ? <p className="text-slate-500">Nothing here. Write a post, or let the AI plan a week of posts.</p> : (
        <div className="space-y-3">
          {shown.map((p) => (
            <article key={p.id} className="card space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-0.5 font-semibold ${STATUS[p.status].tone}`}>{STATUS[p.status].label}</span>
                <span className="text-slate-500">{when(p.scheduled_at)}</span>
                {p.source === 'ai' && <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-800">AI draft</span>}
                <span className="text-slate-400">· {p.accounts.map(name).join(', ') || 'no accounts yet'}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{p.text}</p>
              {p.media.length > 0 && <div className="flex gap-2">{p.media.map((m) => <img key={m.path} src={m.url} alt="" className="h-20 w-20 rounded-lg object-cover" />)}</div>}
              {p.idea && <p className="text-xs text-slate-500">Idea: {p.idea}</p>}
              {p.note && <p className="text-xs text-slate-600">Note: {p.note}</p>}
              {results[p.id] && <ul className="space-y-1 text-xs">{results[p.id].map((r) => <li key={r.id} className={r.ok ? 'text-emerald-700' : 'text-red-700'}>{r.ok ? '✓' : '✗'} {net(r.platform).name}{r.url ? <> · <a className="underline" href={r.url} target="_blank" rel="noreferrer">view</a></> : null}{r.error ? `: ${r.error}` : ''}</li>)}</ul>}
              <div className="flex flex-wrap gap-2">
                {!['posting', 'posted', 'partly'].includes(p.status) && <button className="btn btn-ghost px-3 py-1.5" onClick={() => setEdit(p)}>Edit</button>}
                {approver && ['awaiting', 'rejected', 'failed'].includes(p.status) && <button className="btn btn-primary px-3 py-1.5" disabled={busy} onClick={() => run(async () => { await rpc('sm_decide', { p_post: p.id, p_approve: true }); await load(); return p.scheduled_at && new Date(p.scheduled_at) > new Date() ? `Approved. It goes out ${when(p.scheduled_at)}.` : 'Approved. It goes out within 5 minutes.' })}><Icon.check /> Approve</button>}
                {approver && p.status === 'approved' && (!p.scheduled_at || new Date(p.scheduled_at) <= new Date()) && <button className="btn btn-primary px-3 py-1.5" disabled={busy} onClick={() => run(async () => { await callFunction('social-publish', { action: 'now', post: p.id }); await load(); return 'Sent. See the results on the post.' })}>Post now</button>}
                {approver && p.status === 'awaiting' && <button className="btn btn-ghost px-3 py-1.5" disabled={busy} onClick={() => { const n = prompt('Why? (the writer sees this)') ?? ''; run(async () => { await rpc('sm_decide', { p_post: p.id, p_approve: false, p_note: n || null }); await load() }) }}>Reject</button>}
                {approver && !['posting'].includes(p.status) && <button className="ml-auto text-xs font-semibold text-red-700 hover:underline" onClick={() => confirm('Delete this post?') && run(async () => { const { error } = await supabase.from('sm_posts').delete().eq('id', p.id); if (error) throw new Error(error.message); await load() })}>Delete</button>}
              </div>
            </article>
          ))}
        </div>
      )}
      {edit && <Editor w={w} accounts={accounts} post={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </div>
  )
}

function Editor({ w, accounts, post, onClose, onSaved }: { w: Workspace; accounts: Account[]; post: Post | null; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState(post?.text ?? '')
  const [media, setMedia] = useState<Media[]>(post?.media ?? [])
  const [pick, setPick] = useState<string[]>(post?.accounts ?? accounts.filter((a) => a.status === 'ok').map((a) => a.id))
  const [at, setAt] = useState(toLocalInput(post?.scheduled_at ?? null))
  const [idea, setIdea] = useState('')
  const { busy, run, note } = useRun()
  const chosen = accounts.filter((a) => pick.includes(a.id))
  const platforms = [...new Set(chosen.map((a) => a.platform))] as Platform[]
  async function save() {
    const row = { text: text.trim(), media, accounts: pick, scheduled_at: fromLocalInput(at) }
    const { error } = post ? await supabase.from('sm_posts').update(row).eq('id', post.id) : await supabase.from('sm_posts').insert({ ...row, workspace: w.id })
    if (error) throw new Error(error.message)
    onSaved()
  }
  return (
    <Modal open title={post ? 'Edit post' : 'New post'} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 rounded-xl bg-teal-50 p-3">
          <input className="input min-w-0 flex-1" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Idea for the AI, e.g. Friday jollof special, free delivery in Wuse" aria-label="Idea for the AI" />
          <button className="btn btn-primary" disabled={busy || idea.trim().length < 3} onClick={() => run(async () => { const r = await callFunction<{ text: string; charged: number }>('social-ai', { action: 'write', workspace: w.id, idea, accounts: pick }); setText(r.text); return `Written (${r.charged} credits). Check it, then save.` })}><Icon.sparkle /> Write it</button>
          {text && <button className="btn btn-ghost" disabled={busy} onClick={() => run(async () => { const r = await callFunction<{ text: string }>('social-ai', { action: 'improve', workspace: w.id, text, instruction: idea || '' }); setText(r.text) })}>Improve</button>}
        </div>
        <textarea className="input min-h-[160px]" value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} placeholder="Write your post…" aria-label="Post text" />
        <div className="flex flex-wrap gap-3 text-xs">{platforms.map((p) => { const n = lengthFor(p, text); return <span key={p} className={n > net(p).limit ? 'font-semibold text-red-700' : 'text-slate-500'}>{net(p).name}: {n}/{net(p).limit}</span> })}
          {platforms.includes('instagram') && !media.length && <span className="font-semibold text-red-700">Instagram needs a picture</span>}</div>
        <div className="flex flex-wrap items-center gap-2">
          {media.map((m) => <span key={m.path} className="relative"><img src={m.url} alt="" className="h-16 w-16 rounded-lg object-cover" /><button className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 shadow" aria-label="Remove picture" onClick={() => setMedia(media.filter((x) => x !== m))}><Icon.x className="h-3 w-3" /></button></span>)}
          {media.length < 4 && <label className="btn btn-ghost cursor-pointer">Add picture<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) run(async () => { setMedia([...media, await uploadPicture(w.id, f)]) }); e.target.value = '' }} /></label>}
        </div>
        <fieldset className="space-y-1">
          <legend className="label">Post to</legend>
          {accounts.length === 0 && <p className="text-sm text-slate-500">No accounts connected yet.</p>}
          {accounts.map((a) => <label key={a.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-teal-700" checked={pick.includes(a.id)} onChange={(e) => setPick(e.target.checked ? [...pick, a.id] : pick.filter((x) => x !== a.id))} />{net(a.platform).name}: {a.name}{a.status !== 'ok' && <span className="text-red-700"> (reconnect)</span>}</label>)}
        </fieldset>
        <label className="block text-sm"><span className="label">When (your time). Empty = as soon as it is approved</span><input type="datetime-local" className="input w-64" value={at} onChange={(e) => setAt(e.target.value)} /></label>
        <p className="text-xs text-slate-500">Saving sends it for approval. Nothing is posted until an owner or approver approves it.</p>
        {note}
        <div className="flex gap-2"><button className="btn btn-primary" disabled={busy || (!text.trim() && !media.length)} onClick={() => run(save)}>Save for approval</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
      </div>
    </Modal>
  )
}

// ---------- AI plan ----------
function Plan({ w, accounts }: { w: Workspace; accounts: Account[] }) {
  const [days, setDays] = useState(7)
  const [count, setCount] = useState(5)
  const [topics, setTopics] = useState('')
  const [pick, setPick] = useState<string[]>(accounts.filter((a) => a.status === 'ok').map((a) => a.id))
  const { busy, run, note } = useRun()
  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold">Let the AI plan your posts</h2>
      <p className="text-sm text-slate-600">It reads your brand details and writes drafts with suggested times. They all wait for approval in Posts. {w.brand ? '' : <b>Add your brand details first for much better posts.</b>}</p>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm"><span className="label">Posts</span><input type="number" min={1} max={30} className="input w-24" value={count} onChange={(e) => setCount(Number(e.target.value))} /></label>
        <label className="text-sm"><span className="label">Over the next … days</span><input type="number" min={1} max={60} className="input w-24" value={days} onChange={(e) => setDays(Number(e.target.value))} /></label>
      </div>
      <textarea className="input" maxLength={1000} value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="Themes or events (optional), e.g. Christmas orders, new branch in Kubwa, weekend promo" aria-label="Themes" />
      <fieldset className="space-y-1"><legend className="label">For accounts</legend>
        {accounts.map((a) => <label key={a.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-teal-700" checked={pick.includes(a.id)} onChange={(e) => setPick(e.target.checked ? [...pick, a.id] : pick.filter((x) => x !== a.id))} />{net(a.platform).name}: {a.name}</label>)}
      </fieldset>
      <button className="btn btn-primary" disabled={busy} onClick={() => run(async () => { const r = await callFunction<{ saved: number; charged: number }>('social-ai', { action: 'plan', workspace: w.id, days, count, topics, accounts: pick }); setTimeout(() => go(`w/${w.id}`), 1200); return `${r.saved} drafts saved for approval (${r.charged} credits).` })}><Icon.sparkle /> {busy ? 'Planning… (up to a minute)' : 'Plan my posts'}</button>
      {note}
    </div>
  )
}

// ---------- accounts ----------
function Accounts({ w, accounts, approver, owner, reload }: { w: Workspace; accounts: Account[]; approver: boolean; owner: boolean; reload: () => void }) {
  const { busy, run, note } = useRun()
  // the network sends people back with ?connected=… or ?error=… before the #
  const [q] = useState(() => new URLSearchParams(location.search || location.hash.split('?')[1] || ''))
  useEffect(() => { if (q.get('connected') || q.get('error')) { reload(); history.replaceState(null, '', location.pathname + location.hash.split('?')[0]) } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const back = `${location.origin}${location.pathname}#/w/${w.id}/accounts`
  return (
    <div className="space-y-4">
      {q.get('connected') && <Alert tone="ok">Connected {q.get('connected')} account(s).</Alert>}
      {q.get('error') && <Alert>{q.get('error')}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        {NETWORKS.filter((n) => n.id !== 'instagram').map((n) => (
          <div key={n.id} className="card space-y-2 p-4">
            <h3 className="font-semibold" style={{ color: n.colour }}>{n.id === 'facebook' ? 'Facebook Pages + Instagram' : n.name}</h3>
            <p className="text-xs text-slate-500">{n.id === 'facebook' ? 'Your Pages, and the Instagram Business or Creator accounts linked to them. Every Instagram post needs a picture.' : n.note}</p>
            {approver && <button className="btn btn-primary" disabled={busy} onClick={() => run(async () => { const r = await callFunction<{ url: string }>('social-connect', { action: 'start', workspace: w.id, platform: n.id, return_to: back }); location.assign(r.url) })}>Connect</button>}
          </div>
        ))}
      </div>
      {note}
      <ul className="card divide-y divide-slate-100">
        {accounts.length === 0 && <li className="p-4 text-sm text-slate-500">No accounts connected yet.</li>}
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center gap-3 p-3 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: net(a.platform).colour }} />
            <span className="flex-1">{net(a.platform).name}: <b>{a.name}</b>{a.status !== 'ok' && <span className="text-red-700"> · needs reconnecting{a.last_error ? ` (${a.last_error})` : ''}</span>}{a.expires_at && <span className="text-slate-400"> · until {new Date(a.expires_at).toLocaleDateString()}</span>}</span>
            {owner && <button className="text-xs font-semibold text-red-700 hover:underline" onClick={() => confirm(`Disconnect ${a.name}?`) && run(async () => { const { error } = await supabase.from('sm_accounts').delete().eq('id', a.id); if (error) throw new Error(error.message); reload() })}>Disconnect</button>}
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">CDM Social never sees your passwords. Each network asks you to approve the connection, and the keys are encrypted on our server. You can also remove access from the network's own settings any time.</p>
    </div>
  )
}

// ---------- team ----------
type Person = { user_id: string | null; name: string | null; email: string | null; role: string; invite_id: string | null }
function Team({ w, owner }: { w: Workspace; owner: boolean }) {
  const [people, setPeople] = useState<Person[]>([])
  const [email, setEmail] = useState('')
  const [as, setAs] = useState<'approver' | 'editor'>('approver')
  const { busy, run, note } = useRun()
  const load = () => rpc<Person[]>('sm_people', { p_ws: w.id }).then(setPeople).catch(() => {})
  useEffect(() => { load() }, [w.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600"><b>Approvers</b> approve, reject and post. <b>Editors</b> write and edit; their posts wait for approval. Only the owner connects or removes accounts and invites people. For agencies: make your client the approver.</p>
      <ul className="card divide-y divide-slate-100">
        {people.map((p, i) => <li key={i} className="flex items-center gap-3 p-3 text-sm"><span className="flex-1">{p.name || p.email}{p.name && p.email ? <span className="text-slate-500"> · {p.email}</span> : null}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">{p.role}</span>
          {owner && p.role !== 'owner' && <button className="text-xs font-semibold text-red-700" onClick={() => run(async () => { await rpc('sm_remove', { p_ws: w.id, p_user: p.user_id, p_invite: p.invite_id }); await load() })}>Remove</button>}</li>)}
      </ul>
      {owner && (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await rpc('sm_invite', { p_ws: w.id, p_email: email, p_role: as }); setEmail(''); await load(); return 'Invited. They accept after signing in to CDM Social with that email.' }) }}>
          <input className="input min-w-0 flex-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" aria-label="Email" />
          <select className="input w-36" value={as} onChange={(e) => setAs(e.target.value as 'approver' | 'editor')} aria-label="Role"><option value="approver">Approver</option><option value="editor">Editor</option></select>
          <button className="btn btn-primary" disabled={busy}>Invite</button>
        </form>
      )}
      {note}
    </div>
  )
}

// ---------- brand ----------
function Brand({ w, owner, onSaved }: { w: Workspace; owner: boolean; onSaved: (w: Workspace) => void }) {
  const [f, setF] = useState({ name: w.name, brand: w.brand, language: w.language, timezone: w.timezone })
  const { busy, run, note } = useRun()
  return (
    <div className="card space-y-3 p-5">
      <label className="block text-sm"><span className="label">Name</span><input className="input" disabled={!owner} value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="block text-sm"><span className="label">About the brand: what you sell, prices, where, opening hours, who your customers are, how you like to sound, words to avoid</span>
        <textarea className="input min-h-[180px]" disabled={!owner} maxLength={3000} value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} placeholder="Mama Nkechi's Kitchen, Wuse 2 Abuja. Home-style Nigerian food: jollof ₦3,500, egusi ₦4,000. Delivery in Abuja via WhatsApp 0801 234 5678. Open 10am–9pm daily. Customers: office workers and families. Warm, friendly, a little Pidgin. Never promise delivery times." /></label>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm"><span className="label">Language</span><input className="input w-48" disabled={!owner} value={f.language} maxLength={40} onChange={(e) => setF({ ...f, language: e.target.value })} /></label>
        <label className="text-sm"><span className="label">Time zone</span><input className="input w-56" disabled={!owner} value={f.timezone} maxLength={60} onChange={(e) => setF({ ...f, timezone: e.target.value })} /></label>
      </div>
      {owner && <button className="btn btn-primary" disabled={busy} onClick={() => run(async () => { const { data, error } = await supabase.from('sm_workspaces').update(f).eq('id', w.id).select('*').single(); if (error) throw new Error(error.message); onSaved(data as Workspace); return 'Saved.' })}>Save</button>}
      {note}
      {owner && <button className="block text-xs font-semibold text-red-700 hover:underline" onClick={() => confirm(`Delete ${w.name} with all its posts and connections?`) && run(async () => { const { error } = await supabase.from('sm_workspaces').delete().eq('id', w.id); if (error) throw new Error(error.message); go('') })}>Delete this brand</button>}
    </div>
  )
}
