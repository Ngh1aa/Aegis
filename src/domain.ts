export const today = '2026-11-09'
export const demoClock = today + 'T14:00:00Z'
export const analyst = 'Maya Chen'
export const manager = 'Elena Ortiz'
export const owners = [analyst, 'Jordan Ellis', manager, 'Samira Patel'] as const
export const levels = ['Critical', 'High', 'Medium', 'Low'] as const
export const paymentStates = ['Held', 'Authorized', 'Settled', 'Declined'] as const
export const caseStates = ['Open', 'In review', 'Escalated', 'Resolved'] as const
export const disputeStates = ['Needs response', 'In review', 'Challenge submitted', 'Accepted'] as const

export type Level = typeof levels[number]
export type Payment = typeof paymentStates[number]
export type CaseStatus = typeof caseStates[number]
export type DisputeStatus = typeof disputeStates[number]
export type Transaction = {
  id: string
  merchant: string
  category: string
  amount: number
  currency: 'USD' | 'EUR' | 'GBP'
  origin: string
  city: string
  time: string
  score: number
  status: Payment
  account: string
  attempts: number
}
export type Signal = { name: string; observation: string; confidence: 'High' | 'Medium' | 'Low' }
export type Alert = { id: string; transaction: string; rule: string; signals: Signal[] }
export type Evidence = { id: string; title: string; source: string; detail: string; reviewed: boolean; required: boolean }
export type Note = { id: string; author: string; time: string; text: string }
export type Case = {
  id: string; transaction: string; title: string; priority: Level; owner: string; status: CaseStatus
  opened: string; deadline: string; resolved?: string; evidence: Evidence[]; notes: Note[]
}
export type Dispute = {
  id: string; transaction: string; caseId: string; reason: string; deadline: string
  status: DisputeStatus; evidence: Evidence[]
}
export type Rule = {
  id: string; name: string; metric: 'score' | 'attempts'; threshold: number; active: boolean
  priority: Level; protected?: boolean; description: string
}
export type Entity = 'Transaction' | 'Case' | 'Dispute' | 'Rule'
export type Audit = {
  id: string; actor: string; time: string; entity: Entity; objectId: string
  action: string; before: string; after: string; reason: string
}
export type Data = {
  schema: 1; revision: string
  transactions: Transaction[]; alerts: Alert[]; cases: Case[]; disputes: Dispute[]
  rules: Rule[]; audit: Audit[]
}

export function risk(score: number): Level {
  if (score >= 90) return 'Critical'
  if (score >= 75) return 'High'
  if (score >= 50) return 'Medium'
  return 'Low'
}
export const pendingDispute = (d: Dispute) => ['Needs response', 'In review'].includes(d.status)
export const openCase = (c: Case) => c.status !== 'Resolved'
export const evidenceReady = (evidence: Evidence[]) => evidence.filter(e => e.required).every(e => e.reviewed)
export const evidenceCount = (evidence: Evidence[]) => evidence.filter(e => e.reviewed).length
export const caseFor = (data: Data, tx: string) => data.cases.find(c => c.transaction === tx)
export const disputeForCase = (data: Data, id: string) => data.disputes.find(d => d.caseId === id)
export const alertFor = (data: Data, tx: string) => data.alerts.find(a => a.transaction === tx)
export const transactionFor = (data: Data, tx: string) => data.transactions.find(t => t.id === tx)
export const money = (t: Transaction) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: t.currency, currencyDisplay: 'code',
}).format(t.amount)
export const dateLabel = (date: string) => new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', timeZone: 'UTC',
}).format(new Date(date))
export const timeLabel = (date: string) => new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
}).format(new Date(date))
export function timestamp(date: string) {
  return dateLabel(date) + ', ' + timeLabel(date) + ' UTC'
}
export function dayOffset(n: number) {
  return new Date(Date.parse(today) + n * 86400000).toISOString().slice(0, 10)
}
export function deadlineLabel(deadline: string, open = true) {
  if (!open) return dateLabel(deadline)
  if (deadline < demoClock) return 'Overdue'
  if (deadline.startsWith(today)) return 'Due today'
  return 'Due ' + dateLabel(deadline)
}

const merchants = [
  ['Northline Electronics', 'Electronics', 'United States', 'Austin, US', 'USD'],
  ['Atlas Digital', 'Digital goods', 'United Kingdom', 'London, UK', 'GBP'],
  ['Kestrel Travel', 'Travel', 'Netherlands', 'Amsterdam, NL', 'EUR'],
  ['Fieldwork Supply', 'Retail', 'United States', 'Portland, US', 'USD'],
  ['Meridian Market', 'Marketplace', 'Germany', 'Berlin, DE', 'EUR'],
  ['Bramble Studio', 'Home & living', 'United Kingdom', 'Bristol, UK', 'GBP'],
  ['Sable Mobility', 'Transport', 'France', 'Lyon, FR', 'EUR'],
  ['Cairn Outdoor', 'Sporting goods', 'United States', 'Boulder, US', 'USD'],
  ['Sundial Media', 'Subscription', 'United Kingdom', 'Leeds, UK', 'GBP'],
  ['Wren & Co.', 'Retail', 'United States', 'Chicago, US', 'USD'],
] as const

function transaction(i: number, d: number, j: number): Transaction {
  const [merchant, category, origin, city, currency] = merchants[(j + d * 3) % merchants.length]
  const score = [96, 87, 78, 63, 42, 56, 93, 31, 18, 84, 65, 38][(j + d * 2) % 12]
  const status = score >= 90 ? 'Held' : score >= 75 ? 'Authorized' : j % 7 === 5 ? 'Declined' : 'Settled'
  return {
    id: 'TX-' + (8421 - i), merchant, category, origin, city, currency, score, status,
    time: dayOffset(-d) + 'T' + String(13 - j % 10).padStart(2, '0') + ':'
      + String((42 - j * 3 + 60) % 60).padStart(2, '0') + ':00Z',
    amount: i === 0 ? 2840 : Math.round((29.95 + (i * 137.43) % 2120) * 100) / 100,
    account: 'AC-' + (901 + i % 19), attempts: score >= 90 ? 7 : score >= 75 ? 4 : 1,
  }
}

const volumes = [9, 13, 11, 17, 10, 12, 8, 11, 9, 13, 8, 11, 10, 8, 12, 9, 14, 7, 10, 8, 8, 11, 9, 13, 8, 12, 9, 10, 9, 8]

export function buildEvidence(t: Transaction): Evidence[] {
  return [
    { id: 'auth', title: 'Authorization record', source: 'Payment gateway', detail: t.id + ' was received at ' + timestamp(t.time) + '. Billing address check matched the registered address. Gateway response at intake: ' + t.status + '.', reviewed: false, required: true },
    { id: 'device', title: 'Device and session record', source: 'Session telemetry', detail: 'The session associated with ' + t.account + ' originated in ' + t.city + '. ' + (t.attempts > 1 ? t.attempts + ' attempts shared a device fingerprint within ten minutes.' : 'One authorization attempt was recorded.'), reviewed: false, required: true },
    { id: 'merchant', title: 'Merchant profile', source: 'Merchant directory', detail: t.merchant + ' is registered under ' + t.category.toLowerCase() + ' in ' + t.origin + '.', reviewed: false, required: false },
  ]
}

export function seed(): Data {
  let index = 0
  const transactions = volumes.flatMap((n, d) => Array.from({ length: n }, (_, j) => transaction(index++, d, j)))
  const alerts = transactions.filter(t => t.score >= 75).map(t => ({
    id: t.id.replace('TX', 'ALT'),
    transaction: t.id, rule: t.attempts >= 6 ? 'RULE-101' : 'RULE-102',
    signals: t.attempts >= 6
      ? [
          { name: 'Authorization velocity', observation: t.attempts + ' attempts from the same device in 10 minutes. Threshold: 6 attempts.', confidence: 'High' as const },
          { name: 'First-seen device', observation: 'Device fingerprint has no prior successful payments for ' + t.account + '.', confidence: 'Medium' as const },
          { name: 'Origin differs from account history', observation: 'Session originated in ' + t.city + '. Recent successful payments used another region.', confidence: 'Low' as const },
        ]
      : [{ name: 'Elevated risk score', observation: 'Score ' + t.score + ' crossed the review threshold of 75.', confidence: 'Medium' as const }],
  }))
  const intake = [0, 1, 2, 3, 4, 6, 8, 9, 10, 12, 15, 16]
  const candidates = [...intake.map(i => transactions[i]), ...transactions.filter((t, i) => i >= 30 && t.score >= 75 && i % 3 === 0).slice(0, 25)]
  const cases = candidates.map((t, i): Case => {
    const status = i >= 12 ? 'Resolved' : (['Open', 'In review', 'Open', 'Open', 'In review', 'Escalated', 'Resolved', 'In review', 'Resolved', 'Open', 'In review', 'Open'] as const)[i]
    return {
      id: 'CS-' + (2401 + i), transaction: t.id,
      title: ([2, 3, 4, 6, 8].includes(i) ? 'Dispute review' : t.attempts >= 6 ? 'Authorization velocity' : t.score >= 75 ? 'Elevated risk review' : 'Payment review'),
      priority: risk(t.score), owner: i === 2 || i === 9 ? '' : owners[i % owners.length],
      status, opened: t.time, deadline: i < 12 ? dayOffset(i === 1 ? -1 : i < 5 ? 0 : 1 + i % 3) + 'T18:00:00Z'
        : new Date(Date.parse(t.time) + 48 * 3600000).toISOString(),
      resolved: status === 'Resolved' ? new Date(Math.min(Date.parse(t.time) + 26 * 3600000, Date.parse(demoClock) - 3600000)).toISOString() : undefined,
      evidence: buildEvidence(t).map(e => ({ ...e, reviewed: status === 'Resolved' || (status === 'In review' && e.id === 'auth') })),
      notes: [],
    }
  })
  const disputes: Dispute[] = [2, 3, 4, 6, 8].map((caseIndex, i) => {
    const c = cases[caseIndex]
    const t = transactions.find(tx => tx.id === c.transaction)!
    const reason = ['Unauthorized payment', 'Product not received', 'Duplicate charge', 'Credit not processed', 'Unauthorized payment'][i]
    const entries = [
      { id: 'receipt', title: 'Payment receipt', source: 'Payment gateway', detail: t.merchant + ' recorded ' + money(t) + ' on ' + dateLabel(t.time) + ' under ' + t.id + '.' },
      { id: 'report', title: 'Cardholder statement', source: 'Dispute intake', detail: 'Dispute reason: ' + reason + '. The statement was associated with ' + t.id + ' at intake.' },
      { id: 'proof', title: i === 1 ? 'Delivery record' : 'Merchant response', source: 'Merchant correspondence', detail: i === 1 ? 'A delivery scan was recorded for the order on ' + dateLabel(t.time) + '.' : 'The merchant supplied an order record that identifies the original payment as ' + t.id + '.' },
    ]
    return {
      id: 'DP-' + (6101 + i), transaction: t.id, caseId: c.id, reason,
      status: (['Needs response', 'In review', 'Needs response', 'Challenge submitted', 'Accepted'] as const)[i],
      deadline: dayOffset(i === 0 ? 0 : i - 1) + 'T17:00:00Z',
      evidence: entries.map(e => ({ ...e, required: true, reviewed: i >= 3 || (i === 1 && e.id === 'receipt') })),
    }
  })
  const rules: Rule[] = [
    { id: 'RULE-101', name: 'Authorization velocity', metric: 'attempts', threshold: 6, active: true, priority: 'Critical', description: 'Route repeated attempts from the same device to manual review.' },
    { id: 'RULE-102', name: 'Elevated risk review', metric: 'score', threshold: 75, active: true, priority: 'High', description: 'Route elevated risk scores to manual review.' },
    { id: 'RULE-103', name: 'Early review threshold', metric: 'score', threshold: 60, active: false, priority: 'Medium', description: 'Evaluate a broader threshold before increasing review coverage.' },
    { id: 'RULE-104', name: 'Critical score safeguard', metric: 'score', threshold: 94, active: true, priority: 'Critical', protected: true, description: 'Flag critical scores for Risk Manager oversight.' },
  ]
  const audit: Audit[] = [
    { id: 'EV-001', actor: 'Risk engine', time: transactions[0].time, entity: 'Transaction', objectId: transactions[0].id, action: 'Alert raised', before: 'Unflagged', after: 'Critical', reason: '7 attempts crossed the authorization velocity threshold.' },
    { id: 'EV-002', actor: 'Dispute intake', time: today + 'T12:25:00Z', entity: 'Dispute', objectId: disputes[0].id, action: 'Dispute received', before: '—', after: 'Needs response', reason: 'Unauthorized payment reported by the cardholder.' },
    { id: 'EV-003', actor: manager, time: today + 'T11:02:00Z', entity: 'Case', objectId: cases[1].id, action: 'Case assigned', before: 'Unassigned', after: cases[1].owner, reason: 'Routed to the investigation queue.' },
    { id: 'EV-004', actor: manager, time: dayOffset(-1) + 'T16:00:00Z', entity: 'Rule', objectId: rules[0].id, action: 'Rule published', before: 'Draft', after: 'Active', reason: 'Velocity threshold reviewed and activated.' },
    ...cases.filter(c => c.resolved).map((c): Audit => ({
      id: 'EV-' + c.id, actor: c.owner || analyst, time: c.resolved!, entity: 'Case', objectId: c.id, action: 'Case resolved', before: 'In review', after: 'Resolved', reason: 'Review completed and evidence recorded.',
    })),
    ...disputes.filter(d => !pendingDispute(d)).map((d): Audit => ({
      id: 'EV-' + d.id, actor: analyst, time: today + 'T09:15:00Z', entity: 'Dispute', objectId: d.id, action: 'Dispute decision', before: 'In review', after: d.status, reason: 'Reviewed the payment receipt and merchant response.',
    })),
  ]
  return { schema: 1, revision: 'seed', transactions, alerts, cases, disputes, rules, audit }
}
