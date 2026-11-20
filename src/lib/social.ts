// CDM Social data helpers for the browser.
import { supabase } from './supabase'

export type Platform = 'facebook' | 'instagram' | 'linkedin' | 'x'
export type Workspace = { id: string; owner: string; name: string; brand: string; language: string; timezone: string; created_at: string }
export type Account = { id: string; workspace: string; platform: Platform; external_id: string; name: string; expires_at: string | null; status: string; last_error: string | null }
export type Media = { url: string; path: string }
export type Post = {
  id: string; workspace: string; text: string; media: Media[]; accounts: string[]; scheduled_at: string | null
  status: 'awaiting' | 'approved' | 'rejected' | 'posting' | 'posted' | 'partly' | 'failed'
  source: 'user' | 'ai'; idea: string | null; note: string | null; approved_by: string | null; approved_at: string | null; created_at: string; updated_at: string
}
export type Result = { id: number; post: string; account: string | null; platform: Platform; ok: boolean; url: string | null; error: string | null; at: string }

export const NETWORKS: { id: Platform; name: string; colour: string; limit: number; note: string }[] = [
  { id: 'facebook', name: 'Facebook Page', colour: '#1877f2', limit: 63000, note: 'Business Pages you manage' },
  { id: 'instagram', name: 'Instagram', colour: '#e1306c', limit: 2200, note: 'Business or Creator accounts linked to a Facebook Page. Every post needs a picture.' },
  { id: 'linkedin', name: 'LinkedIn', colour: '#0a66c2', limit: 3000, note: 'Your personal profile' },
  { id: 'x', name: 'X', colour: '#111111', limit: 280, note: 'X charges per post: a few credits each (more with a link)' },
]
export const net = (p: Platform) => NETWORKS.find((n) => n.id === p)!

export const STATUS: Record<Post['status'], { label: string; tone: string }> = {
  awaiting: { label: 'Waiting for approval', tone: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', tone: 'bg-teal-100 text-teal-800' },
  rejected: { label: 'Rejected', tone: 'bg-slate-200 text-slate-700' },
  posting: { label: 'Posting…', tone: 'bg-sky-100 text-sky-800' },
  posted: { label: 'Posted', tone: 'bg-emerald-100 text-emerald-800' },
  partly: { label: 'Partly posted', tone: 'bg-orange-100 text-orange-800' },
  failed: { label: 'Failed', tone: 'bg-red-100 text-red-800' },
}

/** X counts each link as 23 characters. */
export const xLength = (t: string) => [...t.replace(/https?:\/\/\S+/g, 'x'.repeat(23))].length
export function lengthFor(p: Platform, text: string) { return p === 'x' ? xLength(text) : [...text].length }

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

/** Uploads a picture into the workspace's folder (public, so Instagram and Facebook can fetch it). */
export async function uploadPicture(ws: string, file: File): Promise<Media> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use a JPG, PNG or WebP picture.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Pictures can be up to 5 MB.')
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${ws}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('social').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(error.message)
  return { path, url: supabase.storage.from('social').getPublicUrl(path).data.publicUrl }
}

/** "2026-11-21T09:30" in the browser's time for a date input, and back. */
export const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)
export const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'As soon as approved')
export const STUDIO_ACCOUNT = 'https://cdmtechnologies.github.io/cdm-studio/#/account'
