import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { startEnrol, turnOff, verifiedFactor, verifyCode } from '../lib/twoStep'
import { STUDIO_ACCOUNT } from '../lib/social'
import { Alert, Spinner } from '../components/ui'

export default function Account() {
  const { session, ready, credits, askSignIn } = useAuth()
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const resetting = location.hash.includes('reset=1')
  if (!ready) return <Spinner />
  if (!session) return <Alert tone="info">Sign in to see your account. <button className="font-semibold underline" onClick={() => askSignIn()}>Sign in</button></Alert>
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between"><h1 className="font-display text-3xl font-bold">Your account</h1><button className="btn btn-ghost" onClick={() => supabase.auth.signOut().then(() => { location.hash = '#/' })}>Sign out</button></div>
      {resetting && (
        <section className="card space-y-3 p-5"><h2 className="font-semibold">Choose a new password</h2>
          <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="New password" />
          <button className="btn btn-primary" onClick={async () => { if (pw.length < 8) return setMsg('Use at least 8 characters.'); const { error } = await supabase.auth.updateUser({ password: pw }); setMsg(error ? error.message : 'Password changed.'); setPw('') }}>Save</button></section>
      )}
      <section className="card p-5">
        <h2 className="font-semibold">Credits: {credits.toLocaleString()}</h2>
        <p className="mt-1 text-sm text-slate-600">CDM Social and CDM Studio share one account and one credit balance. The AI writer uses a few credits per post or plan; each X post uses a few credits because X charges per post. Facebook, Instagram and LinkedIn posting is free.</p>
        <a className="btn btn-primary mt-3" href={STUDIO_ACCOUNT} target="_blank" rel="noreferrer">Buy credits</a>
      </section>
      <TwoStep />
      <p className="text-sm text-slate-500">Signed in as {session.user.email}</p>
      {msg && <Alert tone="info">{msg}</Alert>}
    </div>
  )
}

function TwoStep() {
  const [factor, setFactor] = useState<{ id: string } | null | undefined>(undefined)
  const [enrol, setEnrol] = useState<{ factorId: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => { verifiedFactor().then(setFactor).catch(() => setFactor(null)) }, [])
  if (factor === undefined) return null
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">Two-step sign-in</h2>
      <p className="text-sm text-slate-600">Strongly recommended: your account can post to your business pages.</p>
      {factor ? <button className="btn btn-ghost" onClick={async () => { if (confirm('Turn off two-step sign-in?')) { await turnOff(factor.id); setFactor(null) } }}>Turn off</button>
        : enrol ? (
          <div className="space-y-2"><img src={enrol.qr} alt="QR code for your authenticator app" className="h-44 w-44 rounded-lg border" /><p className="break-all font-mono text-xs">{enrol.secret}</p>
            <div className="flex gap-2"><input className="input w-40 text-center" inputMode="numeric" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} aria-label="6-digit code" />
              <button className="btn btn-primary" onClick={async () => { try { await verifyCode(enrol.factorId, code); setEnrol(null); setFactor(await verifiedFactor()) } catch (e) { setMsg((e as Error).message) } }}>Turn on</button></div></div>
        ) : <button className="btn btn-ghost" onClick={async () => { try { setEnrol(await startEnrol()) } catch (e) { setMsg((e as Error).message) } }}>Set up two-step sign-in</button>}
      {msg && <p className="text-sm text-slate-600">{msg}</p>}
    </section>
  )
}
