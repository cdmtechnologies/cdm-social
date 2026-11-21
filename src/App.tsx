import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { href, useRoute } from './lib/router'
import { notConfigured, supabase } from './lib/supabase'
import { needsSecondStep, verifiedFactor, verifyCode } from './lib/twoStep'
import AuthModal from './components/AuthModal'
import { Alert, Icon, Spinner } from './components/ui'
import Home from './pages/Home'
import { STUDIO_ACCOUNT } from './lib/social'

const WorkspacePage = lazy(() => import('./pages/Workspace'))
const Account = lazy(() => import('./pages/Account'))

export default function App() {
  return (
    <AuthProvider>
      <Shell />
      <AuthModal />
    </AuthProvider>
  )
}

function Shell() {
  const route = useRoute()
  const { session, ready, credits, askSignIn } = useAuth()
  const [gate, setGate] = useState(false)
  useEffect(() => { if (session) needsSecondStep().then(setGate); else setGate(false) }, [session])
  if (notConfigured) return <div className="mx-auto max-w-lg p-6"><Alert>CDM Social is being set up. Please check back soon.</Alert></div>
  if (ready && gate) return <TwoStep onDone={() => setGate(false)} />
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-6">
          <a href="#/" className="flex items-center gap-2 font-display text-lg font-bold"><img src="./icon.svg" alt="" width={28} height={28} /><span>CDM <span className="text-teal-700">Social</span></span></a>
          <div className="ml-auto flex items-center gap-2">
            {session && <a href={STUDIO_ACCOUNT} target="_blank" rel="noreferrer" className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800" title="Credits (shared with CDM Studio)">{credits.toLocaleString()} credits</a>}
            {session
              ? <a href={href('account')} className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-teal-800" aria-label="Your account"><Icon.user /></a>
              : <button className="btn btn-primary px-3 py-2" onClick={() => askSignIn('Sign in to manage your social media.')}>Sign in</button>}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <Suspense fallback={<Spinner />}>
          {route[0] === 'w' && route[1] ? <WorkspacePage id={route[1]} tab={route[2]} />
            : route[0] === 'account' ? <Account />
            : <Home />}
        </Suspense>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} CDM Technologies, Abuja. Nothing is posted without your approval.</p>
          <p className="flex flex-wrap gap-4"><a className="hover:text-teal-700" href="./privacy.html">Privacy</a><a className="hover:text-teal-700" href="./terms.html">Terms</a><a className="hover:text-teal-700" href="./data-deletion.html">Delete your data</a><a className="hover:text-teal-700" href="https://cdmtechnologies.github.io">CDM Technologies</a><a className="hover:text-teal-700" href="https://wa.me/2348064068800">WhatsApp 0806 406 8800</a></p>
        </div>
      </footer>
    </div>
  )
}

function TwoStep({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  async function go(e: FormEvent) {
    e.preventDefault(); setErr('')
    try { const f = await verifiedFactor(); if (f) await verifyCode(f.id, code); onDone() } catch (x) { setErr((x as Error).message) }
  }
  return (
    <form onSubmit={go} className="card mx-auto mt-16 max-w-sm space-y-4 p-6">
      <h1 className="text-xl font-bold">Two-step sign-in</h1>
      <input className="input text-center text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} autoFocus aria-label="6-digit code" />
      {err && <Alert>{err}</Alert>}
      <button className="btn btn-primary w-full">Continue</button>
      <button type="button" className="w-full text-sm text-slate-500" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </form>
  )
}
