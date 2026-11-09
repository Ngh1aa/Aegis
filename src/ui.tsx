import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { IconAlertTriangle, IconArrowLeft, IconArrowRight, IconArrowsHorizontal, IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconInbox, IconSearch, IconX } from '@tabler/icons-react'
import { deadlineLabel, timestamp, type Entity } from './domain'

export const entityPath = (entity: Entity, id: string) => ({
  Transaction: '/transactions/', Case: '/cases/', Dispute: '/disputes/', Rule: '/rules/',
}[entity] + id)

export function RecordLink({ entity, id, children }: { entity: Entity; id: string; children?: ReactNode }) {
  const location = useLocation()
  return <Link className="record-link" data-record={id} to={entityPath(entity, id)}
    state={{ from: location.pathname + location.search, record: id }}>
    {children ?? id}
  </Link>
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  const { state } = useLocation()
  const navigate = useNavigate()
  const from = typeof state?.from === 'string' ? state.from : null
  return <Link className="back-link" to={from ?? to} onClick={e => {
    if (!from || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
    e.preventDefault()
    navigate(-1)
  }}><IconArrowLeft size={17} />{from ? 'Back to previous view' : children}</Link>
}

export function PageHeader({ title, label, action, children }: {
  title: string; label?: string; action?: ReactNode; children?: ReactNode
}) {
  return <header className="page-header">
    <div>{children}{label && <div className="page-context">{label}</div>}<h1>{title}</h1></div>
    {action}
  </header>
}

export function Panel({ title, action, children, className = '' }: {
  title: string; action?: ReactNode; children: ReactNode; className?: string
}) {
  return <section className={'panel ' + className}>
    <header className="panel-head"><h2>{title}</h2>{action}</header>{children}
  </section>
}

const tones: Record<string, string> = {
  Critical: 'red', Overdue: 'red', Declined: 'red', High: 'amber', Held: 'amber', 'Due today': 'amber',
  Medium: 'blue', 'In review': 'blue', Authorized: 'blue', 'Needs response': 'amber',
  Resolved: 'green', Settled: 'green', Active: 'green', Accepted: 'green', Reviewed: 'green',
  Escalated: 'purple', 'Challenge submitted': 'purple',
}

export function Badge({ value }: { value: string }) {
  return <span className={'badge ' + (tones[value] ?? 'neutral')}>{value}</span>
}
export function Deadline({ value, open = true, showTime = false }: { value: string; open?: boolean; showTime?: boolean }) {
  const label = deadlineLabel(value, open)
  const urgent = label === 'Overdue' || label === 'Due today'
  return <time dateTime={value} title={timestamp(value)} className={urgent && showTime ? 'cell-stack' : undefined}>
    {urgent ? <><span><Badge value={label} /></span>{showTime && <span>{timestamp(value)}</span>}</> : label}
  </time>
}
export function ActionLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="action-link" to={to}>{children}<IconArrowRight size={15} /></Link>
}
export function Search({ value, change, label, placeholder }: {
  value: string; change: (value: string) => void; label: string; placeholder: string
}) {
  return <div className="search-field"><IconSearch size={17} aria-hidden="true" />
    <input type="search" aria-label={label} value={value} placeholder={placeholder} onChange={e => change(e.target.value)} />
    {value && <button type="button" className="search-clear" aria-label={'Clear ' + label.toLowerCase()}
      onClick={() => change('')}><IconX size={15} /></button>}
  </div>
}

export function Select({ label, value, change, options, showLabel = false }: {
  label: string; value: string; change: (value: string) => void
  options: readonly (string | { label: string; value: string })[]; showLabel?: boolean
}) {
  return <label className={'select-field' + (showLabel ? ' labeled' : '')}>
    <span className={showLabel ? 'field-label' : 'sr-only'}>{label}</span>
    <span className="select-control">
      <select value={value} onChange={e => change(e.target.value)}>
        {options.map(o => typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <IconChevronDown size={15} aria-hidden="true" />
    </span>
  </label>
}
export const all = (label: string) => ({ label, value: '' })

export function State({ title, children, action, error = false }: {
  title: string; children?: ReactNode; action?: ReactNode; error?: boolean
}) {
  return <div className="state">
    {error ? <IconAlertTriangle size={23} /> : <IconInbox size={23} />}
    <h2>{title}</h2>{children && <p>{children}</p>}{action}
  </div>
}

export type Column<T> = { key: string; label: string; render: (row: T) => ReactNode; numeric?: boolean }
export function Table<T extends { id: string }>({ label, rows, columns, selected }: {
  label: string; rows: readonly T[]; columns: Column<T>[]; selected?: string
}) {
  const scroll = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  useEffect(() => {
    const region = scroll.current!
    const observer = new ResizeObserver(() => setOverflow(region.scrollWidth > region.clientWidth))
    observer.observe(region)
    observer.observe(region.querySelector('table')!)
    return () => observer.disconnect()
  }, [])
  return <>
    {overflow && <p className="table-hint"><IconArrowsHorizontal size={16} />Scroll for more columns</p>}
    <div ref={scroll} className="table-scroll" tabIndex={overflow ? 0 : undefined} role="region" aria-label={label}>
    <table aria-label={label}>
      <thead><tr>{columns.map(c => <th key={c.key} scope="col" data-column={c.key} className={c.numeric ? 'numeric' : ''}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} className={selected === row.id ? 'last-selected' : undefined}>
        {columns.map((c, i) => i === 0
          ? <th scope="row" key={c.key} data-column={c.key}>{c.render(row)}</th>
          : <td key={c.key} data-column={c.key} className={c.numeric ? 'numeric' : undefined}>{c.render(row)}</td>)}
      </tr>)}</tbody>
    </table>
    </div>
  </>
}

export function Pages({ page, size, total, change }: {
  page: number; size: number; total: number; change: (n: number) => void
}) {
  const max = Math.max(1, Math.ceil(total / size))
  return <div className="pagination">
    <span aria-live="polite">{total ? (page - 1) * size + 1 : 0}–{Math.min(page * size, total)} of {total}</span>
    <div>
      <button className="icon-button" type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => change(page - 1)}><IconChevronLeft size={17} /></button>
      <span>Page {page} of {max}</span>
      <button className="icon-button" type="button" aria-label="Next page" disabled={page >= max} onClick={() => change(page + 1)}><IconChevronRight size={17} /></button>
    </div>
  </div>
}

export function Feedback({ error, success }: { error?: string; success?: string }) {
  return <>
    {error && <p className="feedback error" role="alert"><IconAlertTriangle size={17} />{error}</p>}
    {success && <p className="feedback success" role="status"><IconCheck size={17} />{success}</p>}
  </>
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const el = ref.current!
    const opener = document.activeElement
    el.showModal()
    return () => {
      if (el.open) el.close()
      queueMicrotask(() => {
        if (document.activeElement !== document.body) return
        if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
        else document.getElementById('main-content')?.focus({ preventScroll: true })
      })
    }
  }, [])
  return <dialog ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); onClose() }}>
    <div className="dialog-body">
      <div className="dialog-head"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><IconX size={19} /></button></div>
      {children}
    </div>
  </dialog>
}

export function useFeedback() {
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({})
  return {
    feedback,
    report: (result: { ok: boolean; message: string }) => setFeedback(result.ok ? { success: result.message } : { error: result.message }),
    clear: () => setFeedback({}),
  }
}

export function FieldList({ entries }: { entries: readonly { label: string; value: ReactNode }[] }) {
  return <dl className="field-list">{entries.map(e => <div key={e.label}><dt>{e.label}</dt><dd>{e.value}</dd></div>)}</dl>
}
