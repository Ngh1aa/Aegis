import { useSyncExternalStore } from 'react'
import {
  analyst, buildEvidence, caseFor, demoClock, evidenceReady, manager, openCase, owners, pendingDispute, risk, seed, transactionFor,
  type Audit, type Data, type Entity, type Evidence, type Rule,
} from './domain'

export const storageKey = 'aegis.workspace.v1'
type Status = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; data: Data }
type Target = 'Case' | 'Dispute'
export const txDecisions = ['Clear alert', 'Block payment', 'Escalate case'] as const
export const disputeDecisions = ['Challenge dispute', 'Accept dispute'] as const
type Command =
  | { kind: 'evidence'; entity: Target; id: string; item: string; reviewed: boolean }
  | { kind: 'open'; id: string }
  | { kind: 'assign'; id: string; owner: string }
  | { kind: 'note'; id: string; text: string }
  | { kind: 'transaction'; id: string; decision: typeof txDecisions[number]; reason: string }
  | { kind: 'dispute'; id: string; decision: typeof disputeDecisions[number]; reason: string }
  | { kind: 'rule'; id: string; threshold: number; active: boolean }

const listeners = new Set<() => void>()
let snapshot: Status = { phase: 'loading' }
let loading = false

function publish(status: Status) {
  snapshot = status
  listeners.forEach(listener => listener())
}
function read() {
  const raw = localStorage.getItem(storageKey)
  if (!raw) return seed()
  const saved = JSON.parse(raw) as Data | null
  if (!saved || saved.schema !== 1 || typeof saved.revision !== 'string' ||
    ![saved.transactions, saved.alerts, saved.cases, saved.disputes, saved.rules, saved.audit].every(Array.isArray)) {
    throw Error('The saved workspace could not be read. Retry or restore the starting records.')
  }
  return saved
}
export function loadWorkspace() {
  if (loading) return
  loading = true
  publish({ phase: 'loading' })
  window.requestAnimationFrame(() => {
    try {
      publish({ phase: 'ready', data: read() })
    } catch {
      publish({ phase: 'error', message: 'The saved workspace could not be read. Retry or restore the starting records.' })
    } finally {
      loading = false
    }
  })
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return
  try {
    publish({ phase: 'ready', data: read() })
  } catch {
    // Keep an open review visible. Its next write will report the storage error.
    if (snapshot.phase !== 'ready') loadWorkspace()
  }
})

export function useWorkspace() {
  return useSyncExternalStore(subscribe, () => snapshot)
}
async function withWriteLock<T>(write: () => T): Promise<T> {
  return navigator.locks ? navigator.locks.request(storageKey, write) : write()
}

export function resetWorkspace() {
  return withWriteLock(restore)
}
function restore() {
  try {
    const data = { ...seed(), revision: crypto.randomUUID() }
    localStorage.setItem(storageKey, JSON.stringify(data))
    publish({ phase: 'ready', data })
    return { ok: true } as const
  } catch {
    return { ok: false, message: 'Browser storage is unavailable. Check site permissions and retry.' } as const
  }
}

type EventDetail = Omit<Audit, 'id' | 'actor' | 'time'>
type Result = { ok: true; message: string } | { ok: false; message: string }
const fail = (message: string): Result => ({ ok: false, message })

export function ruleMatches(rule: Pick<Rule, 'metric' | 'threshold'>, data: Data) {
  return data.transactions.filter(t => t[rule.metric] >= rule.threshold)
}
export function thresholdValid(rule: Pick<Rule, 'metric'>, threshold: number) {
  return Number.isInteger(threshold) && threshold >= 1 && threshold <= (rule.metric === 'score' ? 100 : 20)
}

export async function perform(command: Command, expectedRevision: string): Promise<Result> {
  try {
    return await withWriteLock(() => applyCommand(command, expectedRevision))
  } catch {
    return fail('Changes could not be saved. Retry after checking browser permissions.')
  }
}

function applyCommand(command: Command, expectedRevision: string): Result {
  let data: Data
  try {
    data = read()
  } catch {
    return fail('Workspace records could not be read. Retry after restoring browser storage access.')
  }
  if (data.revision !== expectedRevision) {
    publish({ phase: 'ready', data })
    return fail('Records changed in another tab. Review the latest state before trying again.')
  }
  const time = new Date(Date.parse(demoClock) + data.audit.length * 1000).toISOString()
  const events: EventDetail[] = []
  const change = (entity: Entity, objectId: string, action: string, before: string, after: string, reason: string) => {
    events.push({ entity, objectId, action, before, after, reason })
  }
  let message: string
  switch (command.kind) {
    case 'evidence': {
      const row = (command.entity === 'Case' ? data.cases : data.disputes).find(r => r.id === command.id)
      if (!row || ('caseId' in row ? !pendingDispute(row) : !openCase(row))) return fail('This record is closed.')
      if ('opened' in row && row.status === 'Escalated') return fail('Risk Manager owns this escalated case.')
      const item: Evidence | undefined = row.evidence.find(e => e.id === command.item)
      if (!item) return fail('Evidence is no longer available.')
      if (item.reviewed === command.reviewed) return { ok: true, message: 'Evidence is up to date.' }
      const before = item.reviewed ? 'Reviewed' : 'Pending'
      item.reviewed = command.reviewed
      change(command.entity, row.id, 'Evidence review', before, item.reviewed ? 'Reviewed' : 'Pending', item.title)
      message = item.reviewed ? 'Evidence reviewed.' : 'Evidence returned to pending.'
      break
    }
    case 'open': {
      const transaction = transactionFor(data, command.id)
      if (!transaction) return fail('Transaction could not be found.')
      if (caseFor(data, transaction.id)) return fail('A case already exists for this transaction.')
      const id = 'CS-' + (2401 + data.cases.length)
      data.cases.push({
        id, transaction: transaction.id, title: 'Manual payment review', priority: risk(transaction.score),
        owner: analyst, status: 'In review', opened: time, deadline: demoClock.slice(0, 10) + 'T18:00:00Z',
        evidence: buildEvidence(transaction), notes: [],
      })
      change('Case', id, 'Case opened', 'No case', 'In review', 'Manual review started for ' + transaction.id + '.')
      message = id + ' opened.'
      break
    }
    case 'assign': {
      const row = data.cases.find(c => c.id === command.id)
      if (!row || !openCase(row)) return fail('The linked case is closed.')
      if (row.status === 'Escalated') return fail('Risk Manager owns this escalated case.')
      if (!owners.some(owner => owner === command.owner)) return fail('Select a case owner.')
      const before = row.owner || 'Unassigned'
      if (before === command.owner) return { ok: true, message: 'Case owner is up to date.' }
      row.owner = command.owner
      if (row.status === 'Open') {
        row.status = 'In review'
        change('Case', row.id, 'Review started', 'Open', row.status, 'Case owner assigned.')
      }
      change('Case', row.id, 'Case assigned', before, row.owner, 'Updated the case owner.')
      message = row.id + ' assigned to ' + row.owner + '.'
      break
    }
    case 'note': {
      const row = data.cases.find(c => c.id === command.id)
      if (!row || !openCase(row)) return fail('This case is closed.')
      if (row.status === 'Escalated') return fail('Risk Manager owns this escalated case.')
      const text = command.text.trim()
      if (text.length < 3 || text.length > 500) return fail('Enter a note between 3 and 500 characters.')
      row.notes.push({ id: crypto.randomUUID(), author: analyst, time, text })
      change('Case', row.id, 'Note added', row.status, row.status, 'Investigator note added.')
      message = 'Investigator note saved.'
      break
    }
    case 'transaction': {
      const t = transactionFor(data, command.id)
      if (!t) return fail('Transaction could not be found.')
      let row = caseFor(data, t.id)
      if (row && (!openCase(row) || row.status === 'Escalated')) return fail('This transaction already has a disposition.')
      if (data.disputes.some(d => d.transaction === t.id && pendingDispute(d))) return fail('Complete the linked dispute review before closing this case.')
      const reason = command.reason.trim()
      if (reason.length < 12 || reason.length > 500) return fail('Enter a decision reason between 12 and 500 characters.')
      const escalating = command.decision === 'Escalate case'
      if (!escalating && (!row || !evidenceReady(row.evidence))) return fail('Review all required evidence or escalate the case.')
      const previous = row?.status || 'Unassigned'
      if (!row) {
        row = {
          id: 'CS-' + (2401 + data.cases.length), transaction: t.id, title: 'Manual risk escalation', priority: risk(t.score),
          owner: manager, status: 'Escalated', opened: time, deadline: demoClock.slice(0, 10) + 'T18:00:00Z', evidence: [], notes: [],
        }
        data.cases.push(row)
      }
      if (command.decision === 'Block payment' && t.status !== 'Held' && t.status !== 'Authorized') {
        return fail('This payment cannot be blocked in its current state.')
      }
      const previousPayment = t.status
      if (command.decision === 'Block payment') t.status = 'Declined'
      if (command.decision === 'Clear alert' && t.status === 'Held') t.status = 'Authorized'
      row.status = escalating ? 'Escalated' : 'Resolved'
      if (escalating) row.owner = manager
      else row.resolved = time
      change('Transaction', t.id, command.decision, previousPayment, t.status, reason)
      change('Case', row.id, escalating ? 'Case escalated' : 'Case resolved', previous, row.status, reason)
      message = escalating ? row.id + ' escalated to ' + manager + '.' : row.id + ' resolved. Decision recorded.'
      break
    }
    case 'dispute': {
      const d = data.disputes.find(row => row.id === command.id)
      if (!d || !pendingDispute(d)) return fail('This dispute already has a decision.')
      const row = data.cases.find(c => c.id === d.caseId)
      if (!row || !openCase(row)) return fail('The linked case is unavailable.')
      if (!row.owner) return fail('Assign the linked case before submitting a decision.')
      if (command.decision === 'Challenge dispute' && !evidenceReady(d.evidence)) return fail('Review all required evidence before challenging this dispute.')
      if (command.decision === 'Challenge dispute' && d.deadline < demoClock) return fail('The response deadline has passed. An acceptance can still be recorded.')
      const reason = command.reason.trim()
      if (reason.length < 12 || reason.length > 500) return fail('Enter a decision reason between 12 and 500 characters.')
      const before = d.status
      const caseBefore = row.status
      d.status = command.decision === 'Challenge dispute' ? 'Challenge submitted' : 'Accepted'
      row.status = 'Resolved'
      row.resolved = time
      change('Dispute', d.id, 'Dispute decision', before, d.status, reason)
      change('Case', row.id, 'Case resolved', caseBefore, row.status, reason)
      message = d.id + ' updated to ' + d.status.toLowerCase() + '.'
      break
    }
    case 'rule': {
      const row = data.rules.find(r => r.id === command.id)
      if (!row) return fail('Rule could not be found.')
      if (row.protected) return fail('Permission denied. A Risk Manager must publish changes to this rule.')
      if (!thresholdValid(row, command.threshold)) return fail('Enter a threshold within the allowed range.')
      const before = ruleSummary(row)
      row.threshold = command.threshold
      row.active = command.active
      change('Rule', row.id, 'Rule updated', before, ruleSummary(row), 'Reviewed ' + ruleMatches(row, data).length + ' matching transactions before publishing.')
      message = row.id + ' updated.'
      break
    }
  }
  data.audit.push(...events.map(event => ({ ...event, id: crypto.randomUUID(), time, actor: analyst })))
  data.revision = crypto.randomUUID()
  try {
    localStorage.setItem(storageKey, JSON.stringify(data))
  } catch {
    return fail('Changes could not be saved. Check browser storage and retry.')
  }
  publish({ phase: 'ready', data })
  return { ok: true, message }
}

export function ruleSummary(rule: Rule) {
  return (rule.active ? 'Active' : 'Draft') + ' / ≥ ' + rule.threshold
}
