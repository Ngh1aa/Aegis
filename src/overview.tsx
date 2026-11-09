import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconArrowUpRight, IconCalendarWeek, IconClockHour4, IconExclamationCircle, IconScale } from '@tabler/icons-react'
import {
  caseFor, dateLabel, dayOffset, demoClock, money, openCase, pendingDispute, risk, timestamp, today,
  type Data, type Transaction,
} from './domain'
import { ActionLink, Badge, PageHeader, Panel, RecordLink, Select, State, Table, type Column } from './ui'

export function transactionColumns(data: Data, compact = false): Column<Transaction>[] {
  const columns: Column<Transaction>[] = [
    { key: 'id', label: 'Transaction', render: t => <span className="transaction-identity">
      <RecordLink entity="Transaction" id={t.id} />
      <span className="identity-merchant">{t.merchant}</span>
    </span> },
    { key: 'merchant', label: 'Merchant', render: t => <span className="cell-stack"><strong>{t.merchant}</strong><span>{t.category}</span></span> },
    { key: 'risk', label: 'Risk level', render: t => <span className="risk-cell"><Badge value={risk(t.score)} /><span className="subtle numeric">{t.score}</span></span> },
    { key: 'amount', label: 'Amount', numeric: true, render: t => <strong>{money(t)}</strong> },
    { key: 'origin', label: 'Origin', render: t => t.city },
    { key: 'status', label: 'Payment', render: t => <Badge value={t.status} /> },
    { key: 'case', label: 'Investigation', render: t => <Badge value={caseFor(data, t.id)?.status ?? 'No case'} /> },
    { key: 'time', label: 'Received', render: t => <time dateTime={t.time}>{timestamp(t.time)}</time> },
  ]
  return compact ? columns.filter(c => !['origin', 'status', 'time'].includes(c.key)) : columns
}

type Bucket = { date: string; count: number; to: string }
export function Chart({ buckets, label, series = 'olive' }: { buckets: Bucket[]; label: string; series?: 'olive' | 'ink' }) {
  const maximum = Math.max(4, ...buckets.map(b => b.count))
  const step = Math.ceil((maximum + 1) / 4)
  const upper = step * 4
  if (!buckets.some(b => b.count)) return <State title="No activity in this period">Choose a longer period to see more activity.</State>
  return <figure className={'chart ' + series} aria-label={label}>
    <div className="chart-scale" aria-hidden="true">{[4, 3, 2, 1, 0].map(tick =>
      <span key={tick} style={{ top: (4 - tick) * 25 + '%' }}>{tick * step}</span>)}</div>
    <div className="chart-scroll">
      <div className="chart-plot" style={{ gridTemplateColumns: 'repeat(' + buckets.length + ', minmax(var(--chart-column-min), 1fr))' }}>
        {buckets.map((b, i) => <Link to={b.to} key={b.date} aria-label={dateLabel(b.date) + ' ' + b.count + ' ' + label.toLowerCase()}
          aria-current={b.date === today ? 'date' : undefined}
          className={'chart-day' + (i === buckets.length - 1 ? ' current' : '')}>
          <span className="chart-date">{dateLabel(b.date)}</span>{' '}
          <span className="bar-track">
            <span className="bar" aria-hidden="true" style={{ height: (b.count / upper) * 100 + '%' }} />
            <span className="bar-value" style={{ bottom: 'calc(' + (b.count / upper) * 100 + '% + 2px)' }}>{b.count}</span>
          </span>
        </Link>)}
      </div>
    </div>
  </figure>
}

function days(n: number) {
  return Array.from({ length: n }, (_, i) => dayOffset(i + 1 - n))
}

export function alertBuckets(data: Data, period: number): Bucket[] {
  return days(period).map(date => ({
    date,
    count: data.transactions.filter(t => t.time.startsWith(date) && data.alerts.some(a => a.transaction === t.id)).length,
    to: '/transactions?flagged=1&date=' + date,
  }))
}
const periodOptions = [{ label: 'Last 7 days', value: '7' }, { label: 'Last 14 days', value: '14' }]

export function Overview({ data }: { data: Data }) {
  const [period, setPeriod] = useState('7')
  const critical = data.transactions.filter(t => risk(t.score) === 'Critical' && !['Resolved', 'Escalated'].includes(caseFor(data, t.id)?.status ?? ''))
  const overdue = data.cases.filter(c => openCase(c) && c.deadline < demoClock)
  const urgentDisputes = data.disputes.filter(d => pendingDispute(d) && d.deadline.slice(0, 10) <= today)
  const unassigned = data.cases.filter(c => openCase(c) && !c.owner)
  const entries = [
    { title: 'Critical alerts', detail: 'Open triage backlog', count: critical.length, to: '/transactions?risk=Critical&attention=1', icon: IconExclamationCircle, tone: 'red' },
    { title: 'Overdue cases', detail: 'Past investigation deadline', count: overdue.length, to: '/cases?deadline=overdue', icon: IconClockHour4, tone: 'amber' },
    { title: 'Disputes due today', detail: 'Response required', count: urgentDisputes.length, to: '/disputes?deadline=due', icon: IconScale, tone: 'olive' },
  ]
  const recent = data.transactions.filter(t => data.alerts.some(a => a.transaction === t.id)).sort((a, b) => b.time.localeCompare(a.time)).slice(0, 5)
  const buckets = alertBuckets(data, Number(period))
  return <>
    <PageHeader title="Risk overview" action={<div className="date-stamp"><IconCalendarWeek size={17} />Monday, 9 November 2026</div>} />
    <div className="overview-grid">
      <section className="priority-panel panel">
        <header className="panel-head"><h2>Needs attention</h2><span className="queue-total">{entries.reduce((sum, item) => sum + item.count, 0)} items</span></header>
        <ul className="priority-list">{entries.map(({ title, detail, count, to, icon: Icon, tone }) =>
          <li key={title}><Link to={to} className="priority-row">
            <span className={'priority-icon ' + tone}><Icon size={21} /></span>
            <span className="priority-label"><strong>{title}</strong><span>{detail}</span></span>
            <span className="priority-count">{count}</span><IconArrowUpRight className="priority-arrow" size={17} />
          </Link></li>)}</ul>
        <footer className="panel-foot"><ActionLink to="/cases?owner=Unassigned">{unassigned.length} unassigned {unassigned.length === 1 ? 'case' : 'cases'}</ActionLink><span>As of {timestamp(demoClock)}</span></footer>
      </section>
      <Panel title="Alert volume" className="trend-panel" action={<Select label="Alert period" value={period} change={setPeriod} options={periodOptions} />}>
        <div className="trend-summary"><strong>{buckets.reduce((sum, bucket) => sum + bucket.count, 0)}</strong><span>alerts / {period} days</span></div>
        <Chart buckets={buckets} label="Alerts" />
      </Panel>
      <Panel title="Recent flagged transactions" className="recent-panel" action={<ActionLink to="/transactions?flagged=1">View transactions</ActionLink>}>
        {recent.length ? <Table label="Recent flagged transactions" rows={recent} columns={transactionColumns(data, true)} />
          : <State title="No flagged transactions" />}
      </Panel>
    </div>
  </>
}

export function Analytics({ data }: { data: Data }) {
  const [period, setPeriod] = useState('7')
  const buckets = alertBuckets(data, Number(period))
  const resolved = days(Number(period)).map(date => ({
    date, count: data.cases.filter(c => c.resolved?.startsWith(date)).length, to: '/cases?closed=' + date,
  }))
  const periodCases = data.cases.filter(c => resolved.some(d => c.resolved?.startsWith(d.date)))
  const hours = periodCases.map(c => (Date.parse(c.resolved!) - Date.parse(c.opened)) / 3600000)
  const average = hours.length ? (hours.reduce((sum, h) => sum + h, 0) / hours.length).toFixed(1) + ' h' : '—'
  const workload = [...new Set([...data.cases.map(c => c.owner || 'Unassigned')])].sort().map(owner => ({
    id: owner, owner, open: data.cases.filter(c => (c.owner || 'Unassigned') === owner && openCase(c)).length,
    overdue: data.cases.filter(c => (c.owner || 'Unassigned') === owner && openCase(c) && c.deadline < demoClock).length,
  }))
  const window = dateLabel(buckets[0].date) + ' to ' + dateLabel(today)
  return <>
    <PageHeader title="Risk analytics" action={<Select label="Analytics period" value={period} change={setPeriod} options={periodOptions} />} />
    <div className="metric-strip" aria-label="Period totals">
      <div><span>Alerts / {period} days</span><strong>{buckets.reduce((sum, d) => sum + d.count, 0)}</strong><small>{window}</small></div>
      <div><span>Cases resolved / {period} days</span><strong>{periodCases.length}</strong><small>{window}</small></div>
      <div><span>Mean time to resolution</span><strong>{average}</strong><small>{periodCases.length} closed cases in period</small></div>
    </div>
    <div className="analytics-grid">
      <Panel title="Alerts per day"><Chart buckets={buckets} label="Alerts" /></Panel>
      <Panel title="Cases resolved per day"><Chart buckets={resolved} label="Cases resolved" series="ink" /></Panel>
    </div>
    <Panel title="Current investigation workload" className="section-gap">
      {workload.length ? <Table label="Current investigation workload" rows={workload} columns={[
        { key: 'owner', label: 'Owner', render: w => <Link className="record-link" to={'/cases?active=1&owner=' + encodeURIComponent(w.owner)}>{w.owner}</Link> },
        { key: 'open', label: 'Open workload', numeric: true, render: w => w.open },
        { key: 'overdue', label: 'Overdue cases', numeric: true, render: w => w.overdue },
      ]} /> : <State title="No cases assigned" />}
    </Panel>
  </>
}
