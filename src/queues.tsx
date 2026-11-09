import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { IconX } from '@tabler/icons-react'
import {
  caseFor, caseStates, dateLabel, demoClock, disputeForCase, disputeStates, evidenceCount, levels, money, openCase, owners,
  paymentStates, pendingDispute, risk, timestamp, today, transactionFor,
  type Audit, type Case, type Data, type Dispute,
} from './domain'
import { transactionColumns } from './overview'
import { all, Badge, Deadline, PageHeader, Pages, RecordLink, Search, Select, State, Table, type Column } from './ui'

const pageSize = 8
const textMatches = (q: string, ...values: string[]) => values.join(' ').toLowerCase().includes(q.trim().toLowerCase())

function useFilters() {
  const [params, set] = useSearchParams()
  return {
    get: (key: string) => params.get(key) ?? '',
    change: (key: string, value: string) => {
      const next = new URLSearchParams(params)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      set(next, { replace: key === 'q', preventScrollReset: true })
    },
    clear: () => set({}, { preventScrollReset: true }),
    filtered: [...params.keys()].some(k => k !== 'page' && k !== 'sort'),
    requestedPage: Math.max(1, Math.trunc(Number(params.get('page'))) || 1),
  }
}
type Filters = ReturnType<typeof useFilters>

function Chip({ filters, name, children }: { filters: Filters; name: string; children: string }) {
  if (!filters.get(name)) return null
  return <button className="filter-chip" aria-label={'Remove filter: ' + children}
    onClick={() => filters.change(name, '')}>{children}<IconX size={14} /></button>
}
function Queue<T extends { id: string }>({ title, rows, filters, columns, tools, chips }: {
  title: string; rows: T[]; filters: Filters; columns: Column<T>[]; tools: ReactNode; chips?: ReactNode
}) {
  const page = Math.min(filters.requestedPage, Math.max(1, Math.ceil(rows.length / pageSize)))
  return <>
    <PageHeader title={title} />
    <section className="panel queue-panel" aria-label={title + ' results'}>
      <div className="toolbar">{tools}</div>
      {filters.filtered && <div className="filters">{chips}<button className="filter-chip" onClick={filters.clear}>Clear filters</button></div>}
      {rows.length ? <><Table label={title} rows={rows.slice((page - 1) * pageSize, page * pageSize)} columns={columns} />
        <Pages total={rows.length} size={pageSize} page={page} change={value => filters.change('page', String(value))} /></>
        : <State title={filters.filtered ? 'No matching records' : 'No records yet'}>
          {filters.filtered ? 'Try a different search or clear the filters.' : 'Records will appear here when activity is available.'}
        </State>}
    </section>
  </>
}

export function Transactions({ data }: { data: Data }) {
  const f = useFilters()
  const alerts = new Set(data.alerts.map(a => a.transaction))
  const rows = data.transactions.filter(t => {
    const investigation = caseFor(data, t.id)?.status ?? 'No case'
    return textMatches(f.get('q'), t.id, t.merchant, t.origin, t.account) &&
      (!f.get('risk') || risk(t.score) === f.get('risk')) &&
      (!f.get('payment') || t.status === f.get('payment')) &&
      (!f.get('case') || investigation === f.get('case')) &&
      (!f.get('flagged') || alerts.has(t.id)) &&
      (!f.get('attention') || !['Resolved', 'Escalated'].includes(investigation)) &&
      (!f.get('date') || t.time.startsWith(f.get('date')))
  }).sort((a, b) => {
    if (f.get('sort') === 'risk') return b.score - a.score || b.time.localeCompare(a.time)
    if (f.get('sort') === 'oldest') return a.time.localeCompare(b.time)
    if (f.get('sort') === 'amount') return a.currency.localeCompare(b.currency) || b.amount - a.amount
    return b.time.localeCompare(a.time)
  })
  return <Queue title="Transaction monitoring" rows={rows} filters={f} columns={transactionColumns(data)}
    tools={<>
      <Search label="Search transactions" placeholder="Search ID, merchant or origin" value={f.get('q')} change={v => f.change('q', v)} />
      <Select label="Risk level" options={[all('All risk levels'), ...levels]} value={f.get('risk')} change={v => f.change('risk', v)} />
      <Select label="Payment status" options={[all('All payments'), ...paymentStates]} value={f.get('payment')} change={v => f.change('payment', v)} />
      <Select label="Investigation status" options={[all('All investigations'), ...caseStates, 'No case']} value={f.get('case')} change={v => f.change('case', v)} />
      <Select label="Sort transactions" options={[all('Newest first'), { label: 'Oldest first', value: 'oldest' }, { label: 'Highest risk', value: 'risk' }, { label: 'Amount by currency', value: 'amount' }]} value={f.get('sort')} change={v => f.change('sort', v)} />
    </>}
    chips={<>
      <Chip filters={f} name="flagged">Flagged only</Chip><Chip filters={f} name="attention">Needs attention</Chip>
      <Chip filters={f} name="date">{f.get('date')}</Chip>
    </>}
  />
}

export function Cases({ data }: { data: Data }) {
  const f = useFilters()
  const rows = data.cases.filter(c =>
    textMatches(f.get('q'), c.id, c.transaction, c.title, c.owner) &&
    (!f.get('priority') || c.priority === f.get('priority')) &&
    (!f.get('status') || c.status === f.get('status')) &&
    (!f.get('owner') || (c.owner || 'Unassigned') === f.get('owner')) &&
    (!f.get('deadline') || (openCase(c) && c.deadline < demoClock)) &&
    (!f.get('active') || openCase(c)) &&
    (!f.get('closed') || c.resolved?.startsWith(f.get('closed')))
  ).sort((a, b) => Number(openCase(b)) - Number(openCase(a)) || a.deadline.localeCompare(b.deadline))
  const columns: Column<Case>[] = [
    { key: 'id', label: 'Case', render: c => <RecordLink entity="Case" id={c.id} /> },
    { key: 'name', label: 'Investigation', render: c => <span className="cell-stack"><strong>{c.title}</strong><span>{c.transaction}</span></span> },
    { key: 'priority', label: 'Priority', render: c => <Badge value={c.priority} /> },
    { key: 'status', label: 'Status', render: c => <Badge value={c.status} /> },
    { key: 'owner', label: 'Owner', render: c => c.owner || 'Unassigned' },
    { key: 'deadline', label: 'Deadline', render: c => <Deadline value={c.deadline} open={openCase(c)} showTime /> },
    { key: 'evidence', label: 'Evidence reviewed', numeric: true, render: c => {
      const items = disputeForCase(data, c.id)?.evidence ?? c.evidence
      return items.length ? evidenceCount(items) + ' / ' + items.length : '—'
    } },
  ]
  return <Queue title="Case management" rows={rows} filters={f} columns={columns}
    tools={<>
      <Search label="Search cases" placeholder="Search case or transaction" value={f.get('q')} change={v => f.change('q', v)} />
      <Select label="Case priority" options={[all('All priorities'), ...levels]} value={f.get('priority')} change={v => f.change('priority', v)} />
      <Select label="Case status" options={[all('All statuses'), ...caseStates]} value={f.get('status')} change={v => f.change('status', v)} />
      <Select label="Case owner" options={[all('All owners'), 'Unassigned', ...owners]} value={f.get('owner')} change={v => f.change('owner', v)} />
    </>}
    chips={<>
      <Chip filters={f} name="deadline">Overdue</Chip><Chip filters={f} name="active">Open workload</Chip>
      <Chip filters={f} name="closed">{'Resolved on ' + f.get('closed')}</Chip>
    </>}
  />
}

export function Disputes({ data }: { data: Data }) {
  const f = useFilters()
  const rows = data.disputes.filter(d =>
    textMatches(f.get('q'), d.id, d.transaction, d.reason, transactionFor(data, d.transaction)?.merchant ?? '') &&
    (!f.get('status') || d.status === f.get('status')) &&
    (!f.get('deadline') || (pendingDispute(d) && d.deadline.slice(0, 10) <= today))
  ).sort((a, b) => Number(pendingDispute(b)) - Number(pendingDispute(a)) || a.deadline.localeCompare(b.deadline))
  const columns: Column<Dispute>[] = [
    { key: 'id', label: 'Dispute', render: d => <RecordLink entity="Dispute" id={d.id} /> },
    { key: 'reason', label: 'Reason', render: d => <span className="cell-stack"><strong>{d.reason}</strong><span>{transactionFor(data, d.transaction)?.merchant}</span></span> },
    { key: 'amount', label: 'Amount', numeric: true, render: d => <strong>{money(transactionFor(data, d.transaction)!)}</strong> },
    { key: 'status', label: 'Status', render: d => <Badge value={d.status} /> },
    { key: 'deadline', label: 'Deadline', render: d => <Deadline value={d.deadline} open={pendingDispute(d)} showTime /> },
    { key: 'owner', label: 'Case owner', render: d => data.cases.find(c => c.id === d.caseId)?.owner || 'Unassigned' },
    { key: 'evidence', label: 'Evidence reviewed', numeric: true, render: d => evidenceCount(d.evidence) + ' / ' + d.evidence.length },
  ]
  return <Queue title="Dispute resolution" rows={rows} filters={f} columns={columns}
    tools={<>
      <Search label="Search disputes" placeholder="Search dispute, reason or merchant" value={f.get('q')} change={v => f.change('q', v)} />
      <Select label="Dispute status" options={[all('All statuses'), ...disputeStates]} value={f.get('status')} change={v => f.change('status', v)} />
      <Select label="Dispute deadline" options={[all('All deadlines'), { label: 'Due today or earlier', value: 'due' }]} value={f.get('deadline')} change={v => f.change('deadline', v)} />
    </>}
  />
}

export function AuditTrail({ data }: { data: Data }) {
  const f = useFilters()
  const rows = data.audit.filter(e =>
    textMatches(f.get('q'), e.actor, e.action, e.reason, e.objectId) &&
    (!f.get('entity') || e.entity === f.get('entity')) &&
    (!f.get('actor') || e.actor === f.get('actor')) &&
    (!f.get('object') || e.objectId === f.get('object'))
  ).sort((a, b) => b.time.localeCompare(a.time))
  const columns: Column<Audit>[] = [
    { key: 'object', label: 'Record', render: e => <span className="cell-stack"><RecordLink entity={e.entity} id={e.objectId} /><span>{e.entity}</span></span> },
    { key: 'action', label: 'Action', render: e => <strong>{e.action}</strong> },
    { key: 'actor', label: 'Actor', render: e => e.actor },
    { key: 'time', label: 'Timestamp', render: e => <time dateTime={e.time} title={timestamp(e.time)}>{dateLabel(e.time)}<br />{e.time.slice(11, 19)} UTC</time> },
    { key: 'status', label: 'Previous / new', render: e => <span className="cell-stack"><span>{e.before}</span><strong>{e.after}</strong></span> },
    { key: 'reason', label: 'Reason', render: e => <span className="audit-reason">{e.reason}</span> },
  ]
  return <Queue title="Audit trail" rows={rows} filters={f} columns={columns}
    tools={<>
      <Search label="Search audit events" placeholder="Search actor, action or record" value={f.get('q')} change={v => f.change('q', v)} />
      <Select label="Record type" options={[all('All records'), 'Transaction', 'Case', 'Dispute', 'Rule']} value={f.get('entity')} change={v => f.change('entity', v)} />
      <Select label="Actor" options={[all('All actors'), ...new Set(data.audit.map(e => e.actor))]} value={f.get('actor')} change={v => f.change('actor', v)} />
    </>}
    chips={<Chip filters={f} name="object">{f.get('object')}</Chip>}
  />
}
