import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IconAlertTriangle, IconFileCheck, IconShieldCheck } from '@tabler/icons-react'
import {
  alertFor, caseFor, demoClock, disputeForCase, evidenceCount, evidenceReady, money, openCase, owners, pendingDispute, risk,
  timestamp, transactionFor, type Case, type Data, type Entity, type Evidence, type Transaction,
} from './domain'
import { disputeDecisions, perform, txDecisions } from './store'
import { ActionLink, BackLink, Badge, Deadline, Dialog, Feedback, FieldList, PageHeader, Panel, RecordLink, Select, State, Table, useFeedback } from './ui'

export function Missing({ title, back }: { title: string; back: string }) {
  return <div className="panel"><State title={title} error action={<BackLink to={back}>Back to list</BackLink>}>
    This record could not be found.
  </State></div>
}

function Summary({ transaction: t, status, context, deadline }: {
  transaction: Transaction; status: string; context: string; deadline?: string
}) {
  return <section className="panel summary-band" aria-label={context}>
    <div><span>Amount</span><strong className="primary-value">{money(t)}</strong></div>
    <div><span>Merchant</span><strong>{t.merchant}</strong></div>
    <div><span>{context}</span><strong><Badge value={status} /></strong></div>
    {deadline
      ? <div><span>Response deadline</span><strong>{timestamp(deadline)}</strong></div>
      : <div><span>Origin</span><strong>{t.city}</strong></div>}
  </section>
}

function EvidencePanel({ items, entity, id, revision, disabled }: {
  items: Evidence[]; entity: 'Case' | 'Dispute'; id: string; revision: string; disabled: boolean
}) {
  const { feedback, report } = useFeedback()
  const [pending, setPending] = useState(false)
  return <Panel title="Evidence" action={<span className="queue-total">{evidenceCount(items)} / {items.length} reviewed</span>}>
    {items.length ? <div className="detail-body">
      <ul className="evidence-list">{items.map(item => <li key={item.id}>
        <details>
          <summary><strong>{item.title}</strong><Badge value={item.reviewed ? 'Reviewed' : item.required ? 'Required' : 'Optional'} /></summary>
          <p><strong>{item.source}</strong></p><p>{item.detail}</p>
          <label className="check"><input type="checkbox" checked={item.reviewed} disabled={disabled || pending} onChange={async e => {
            setPending(true)
            report(await perform({ kind: 'evidence', entity, id, item: item.id, reviewed: e.target.checked }, revision))
            setPending(false)
          }} />
            Mark {item.title.toLowerCase()} reviewed
          </label>
        </details>
      </li>)}</ul>
      {pending ? <p className="hint" role="status">Saving evidence…</p> : <Feedback {...feedback} />}
    </div> : <State title="No evidence attached">Escalated cases can be reviewed by the Risk Manager.</State>}
  </Panel>
}

function Timeline({ data, records, title }: {
  data: Data; records: { entity: Entity; id: string }[]; title: string
}) {
  const events = data.audit.filter(e => records.some(r => e.entity === r.entity && e.objectId === r.id))
    .sort((a, b) => b.time.localeCompare(a.time))
  return <Panel title={title} action={<ActionLink to={'/audit?object=' + records[0].id}>Open audit</ActionLink>}>
    {events.length ? <div className="detail-body"><ol className="activity">
      {events.slice(0, 6).map(e => <li key={e.id}>
        <time dateTime={e.time}>{timestamp(e.time)}</time>
        <h3>{e.action}</h3><p>{e.actor}<br />{e.reason}</p>
      </li>)}
    </ol></div> : <State title="No activity recorded">Changes to this record will appear here.</State>}
  </Panel>
}

function Assignment({ record, data, blocked, linkCase }: { record: Case; data: Data; blocked?: boolean; linkCase?: boolean }) {
  const [owner, setOwner] = useState(record.owner)
  const { feedback, report, clear } = useFeedback()
  const disabled = blocked || !openCase(record) || record.status === 'Escalated'
  return <Panel title="Case assignment">
    <div className="detail-body">
      <FieldList entries={[
        ...(linkCase ? [{ label: 'Case', value: <RecordLink entity="Case" id={record.id} /> }] : []),
        { label: 'Owner', value: record.owner || 'Unassigned' }, { label: 'Status', value: <Badge value={record.status} /> },
      ]} />
      {disabled ? <p className="hint">{record.status === 'Escalated' ? 'Assignment is managed by the Risk Manager.' : 'Assignment is closed.'}</p>
        : <form className="form-stack" noValidate onSubmit={async e => {
          e.preventDefault()
          report(await perform({ kind: 'assign', id: record.id, owner }, data.revision))
        }}>
          <Select label="Assign case owner" showLabel value={owner} options={[{ label: 'Select an owner', value: '' }, ...owners]} change={v => { setOwner(v); clear() }} />
          <button className="button" type="submit">Save assignment</button>
        </form>}
      <Feedback {...feedback} />
    </div>
  </Panel>
}

function Notes({ data, record }: { data: Data; record: Case }) {
  const [note, setNote] = useState('')
  const { feedback, report } = useFeedback()
  return <Panel title="Investigator notes" action={<span className="queue-total">{record.notes.length}</span>}>
    <div className="detail-body">
      {record.notes.length ? <ul className="note-list">{record.notes.map(n => <li key={n.id}>
        <h3>{n.author}</h3><time dateTime={n.time}>{timestamp(n.time)}</time><p>{n.text}</p>
      </li>)}</ul> : <p className="hint">No investigator notes.</p>}
      {openCase(record) && record.status !== 'Escalated' && <form className="form-stack" onSubmit={async e => {
        e.preventDefault()
        const result = await perform({ kind: 'note', id: record.id, text: note }, data.revision)
        report(result)
        if (result.ok) setNote('')
      }}>
        <label><span className="field-label">Investigator note</span><textarea value={note} maxLength={500} onChange={e => setNote(e.target.value)} /></label>
        <div className="form-actions"><button className="button" disabled={note.trim().length < 3} aria-describedby="note-min">Save note</button></div>
        <p className="hint" id="note-min">Enter 3–500 characters.</p>
      </form>}
      <Feedback {...feedback} />
    </div>
  </Panel>
}

type TxDecision = typeof txDecisions[number]
type DisputeDecision = typeof disputeDecisions[number]
type Decision = TxDecision | DisputeDecision

function DecisionForm<T extends Decision>({
  id, caseId, data, amount, options, title, impact, validate, submit,
}: {
  id: string; caseId?: string; data: Data; amount: string; options: readonly T[]; title: string
  impact: (decision: T) => string; validate: (decision: T) => string | undefined
  submit: (decision: T, reason: string, revision: string) => ReturnType<typeof perform>
}) {
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [review, setReview] = useState<{ decision: T; reason: string; revision: string }>()
  const [dialogError, setDialogError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const selected = options.find(option => option === value)
  const blocked = !selected ? 'Select a decision.' : reason.trim().length < 12
    ? 'Enter a decision reason of at least 12 characters.' : validate(selected)
  function prepare(e: FormEvent) {
    e.preventDefault()
    if (!selected || blocked) return
    setReview({ decision: selected, reason: reason.trim(), revision: data.revision })
    setDialogError('')
  }
  return <Panel title={title} className="decision-panel">
    <div className="detail-body">
      <form className="form-stack" noValidate onSubmit={prepare}>
        <Select label="Decision" showLabel value={value} options={[{ value: '', label: 'Select a decision' }, ...options]} change={setValue} />
        <label><span className="field-label">Decision reason</span><textarea maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <p className="hint" id="decision-readiness" aria-live="polite">{blocked ?? 'Ready to review.'}</p>
        <button className="button primary" type="submit" disabled={!!blocked} aria-describedby="decision-readiness">Review decision</button>
      </form>
    </div>
    {review && <Dialog title={review.decision} onClose={() => { if (!submitting) setReview(undefined) }}>
      <FieldList entries={[
        { label: 'Record', value: id }, { label: 'Case', value: caseId ?? 'New case' },
        { label: 'Amount', value: amount }, { label: 'Outcome', value: impact(review.decision) },
      ]} />
      <div><h3>Decision reason</h3><p className="reason-preview">{review.reason}</p></div>
      <Feedback error={dialogError} />
      <div className="form-actions">
        <button className="button" disabled={submitting} onClick={() => setReview(undefined)}>Cancel</button>
        <button className={'button ' + (review.decision === 'Block payment' ? 'danger' : 'primary')} disabled={submitting || (!!dialogError && review.revision !== data.revision)} onClick={async () => {
          setSubmitting(true)
          const result = await submit(review.decision, review.reason, review.revision)
          setSubmitting(false)
          if (result.ok) {
            setReview(undefined)
            setReason('')
            setValue('')
          } else setDialogError(result.message)
        }}>{submitting ? 'Saving decision…' : review.decision}</button>
      </div>
    </Dialog>}
  </Panel>
}

function RecordedDecision({ data, entity, id, status, closed }: {
  data: Data; entity: Entity; id: string; status: string; closed?: boolean
}) {
  const event = data.audit.filter(e => e.entity === entity && e.objectId === id &&
    (e.action === 'Dispute decision' || e.action === 'Case resolved' || e.action === 'Case escalated'))
    .sort((a, b) => b.time.localeCompare(a.time))[0]
  return <Panel title={closed ? 'Decision recorded' : 'Escalated for review'} className="decision-panel">
    <div className="detail-body">
      <p className="feedback success" role="status"><IconShieldCheck size={18} />{status}</p>
      {event && <FieldList entries={[{ label: 'Decision by', value: event.actor }, { label: 'Reason', value: event.reason }]} />}
      <ActionLink to={'/audit?object=' + id}>View audit trail</ActionLink>
    </div>
  </Panel>
}

export function Investigation({ data }: { data: Data }) {
  const { id } = useParams()
  const { feedback, report } = useFeedback()
  const t = transactionFor(data, id ?? '')
  if (!t) return <Missing title="Transaction unavailable" back="/transactions" />
  const row = caseFor(data, t.id)
  const alert = alertFor(data, t.id)
  const activeDispute = data.disputes.find(d => d.transaction === t.id && pendingDispute(d))
  const related = data.transactions.filter(r => r.account === t.account && r.id !== t.id).slice(0, 4)
  const canBlock = t.status === 'Held' || t.status === 'Authorized'
  const options: TxDecision[] = row ? txDecisions.filter(option => option !== 'Block payment' || canBlock) : ['Escalate case']
  return <>
    <PageHeader title={t.id} label="Risk investigation"><BackLink to="/transactions">Back to transactions</BackLink></PageHeader>
    <Summary transaction={t} context="Payment status" status={t.status} />
    <div className="detail-grid">
      <div className="detail-main">
        <Panel title="Risk signals" action={<span className="risk-cell"><Badge value={risk(t.score)} /><strong>{t.score} / 100</strong></span>}>
          {alert ? <div className="detail-body">
            <FieldList entries={[{ label: 'Alert', value: alert.id }, { label: 'Triggered rule', value: <RecordLink entity="Rule" id={alert.rule} /> }]} />
            <ul className="signal-list">{alert.signals.map(signal => <li key={signal.name}>
              <div className="signal-head"><h3>{signal.name}</h3><span className="badge neutral">{signal.confidence} confidence</span></div>
              <p>{signal.observation}</p>
            </li>)}</ul>
          </div> : <State title="No alert raised">This transaction did not enter the alert queue.</State>}
        </Panel>
        {row && <EvidencePanel items={row.evidence} id={row.id} entity="Case" revision={data.revision} disabled={!openCase(row) || row.status === 'Escalated'} />}
      </div>
      <div className="detail-aside">
        <Panel title="Investigation status"><div className="detail-body">
          <FieldList entries={[
            { label: 'Case', value: row ? <RecordLink entity="Case" id={row.id} /> : 'No linked case' },
            { label: 'Owner', value: row?.owner || 'Unassigned' },
            { label: 'Status', value: <Badge value={row?.status ?? 'No case'} /> },
            { label: 'Received', value: timestamp(t.time) },
            { label: 'Account', value: t.account },
          ]} />
          {!row && <button className="button" onClick={async () => report(await perform({ kind: 'open', id: t.id }, data.revision))}>Open case</button>}
          <Feedback {...feedback} />
        </div></Panel>
        {row && (!openCase(row) || row.status === 'Escalated')
          ? <RecordedDecision data={data} entity="Case" id={row.id} status={row.status} closed={!openCase(row)} />
          : activeDispute
            ? <Panel title="Decision pending"><div className="detail-body">
              <p className="feedback error"><IconAlertTriangle size={17} />Complete the linked dispute review before closing this case.</p>
              <RecordLink entity="Dispute" id={activeDispute.id} />
            </div></Panel>
            : <DecisionForm id={t.id} caseId={row?.id} data={data} amount={money(t)} title="Investigation decision" options={options}
              validate={decision => decision !== 'Escalate case' && (!row || !evidenceReady(row.evidence)) ? 'Review all required evidence or escalate the case.' : undefined}
              impact={decision => decision === 'Escalate case' ? 'Send this case to the Risk Manager.' : decision === 'Block payment'
                ? 'Decline the payment and resolve the case.' : t.status === 'Held' ? 'Release the hold and resolve the case.' : 'Clear the alert and resolve the case.'}
              submit={(decision, reason, revision) => perform({ kind: 'transaction', id: t.id, decision, reason }, revision)} />}
      </div>
    </div>
    <div className="detail-grid section-gap">
      <div className="detail-main">
        <Panel title="Related transactions">
          {related.length ? <Table label="Related transactions" rows={related} columns={[
            { key: 'id', label: 'Transaction', render: r => <RecordLink entity="Transaction" id={r.id} /> },
            { key: 'merchant', label: 'Merchant', render: r => r.merchant },
            { key: 'amount', label: 'Amount', numeric: true, render: r => money(r) },
          ]} /> : <State title="No related transactions" />}
        </Panel>
        {row && <Notes data={data} record={row} />}
      </div>
      <div className="detail-aside">
        <Timeline data={data} title="Activity timeline" records={[
          { entity: 'Transaction', id: t.id }, ...(row ? [{ entity: 'Case' as const, id: row.id }] : []),
        ]} />
      </div>
    </div>
  </>
}

export function CaseDetail({ data }: { data: Data }) {
  const { id } = useParams()
  const row = data.cases.find(c => c.id === id)
  if (!row) return <Missing title="Case unavailable" back="/cases" />
  const dispute = disputeForCase(data, row.id)
  const evidence = dispute?.evidence ?? row.evidence
  return <>
    <PageHeader title={row.id} label="Case file"><BackLink to="/cases">Back to cases</BackLink></PageHeader>
    <div className="detail-grid">
      <div className="detail-main">
        <Panel title={row.title} action={<Badge value={row.priority} />}><div className="detail-body">
          <FieldList entries={[
            { label: 'Transaction', value: <RecordLink entity="Transaction" id={row.transaction} /> },
            { label: 'Opened', value: timestamp(row.opened) },
            { label: 'Deadline', value: <><Deadline value={row.deadline} open={openCase(row)} /> <span className="hint">{timestamp(row.deadline)}</span></> },
            { label: 'Progress', value: evidenceCount(evidence) + ' of ' + evidence.length + ' evidence items reviewed' },
            ...(dispute ? [{ label: 'Dispute', value: <RecordLink entity="Dispute" id={dispute.id} /> }] : []),
          ]} />
        </div></Panel>
        <EvidencePanel items={evidence} entity={dispute ? 'Dispute' : 'Case'} id={dispute?.id ?? row.id}
          revision={data.revision} disabled={!openCase(row) || row.status === 'Escalated'} />
        <Notes data={data} record={row} />
      </div>
      <div className="detail-aside">
        <Assignment record={row} data={data} />
        <Timeline data={data} title="Case history" records={[{ entity: 'Case', id: row.id }]} />
      </div>
    </div>
  </>
}

export function DisputeDetail({ data }: { data: Data }) {
  const { id } = useParams()
  const dispute = data.disputes.find(d => d.id === id)
  if (!dispute) return <Missing title="Dispute unavailable" back="/disputes" />
  const t = transactionFor(data, dispute.transaction)
  const row = data.cases.find(c => c.id === dispute.caseId)
  if (!t || !row) return <Missing title="Linked records unavailable" back="/disputes" />
  const pending = pendingDispute(dispute)
  return <>
    <PageHeader title={dispute.id} label="Dispute file"><BackLink to="/disputes">Back to disputes</BackLink></PageHeader>
    <Summary transaction={t} status={dispute.status} context="Dispute status" deadline={dispute.deadline} />
    <div className="detail-grid">
      <div className="detail-main">
        <Panel title={dispute.reason} action={<Deadline value={dispute.deadline} open={pending} />}>
          <div className="detail-body"><FieldList entries={[
            { label: 'Transaction', value: <RecordLink entity="Transaction" id={t.id} /> },
            { label: 'Payment status', value: <Badge value={t.status} /> },
          ]} /></div>
        </Panel>
        <EvidencePanel items={dispute.evidence} entity="Dispute" id={dispute.id} revision={data.revision} disabled={!pending} />
        <Timeline data={data} title="Decision history" records={[{ entity: 'Dispute', id: dispute.id }]} />
      </div>
      <div className="detail-aside">
        <Assignment record={row} data={data} blocked={!pending} linkCase />
        {pending
          ? <DecisionForm id={dispute.id} caseId={row.id} data={data} amount={money(t)} title="Dispute decision" options={disputeDecisions}
            validate={decision => {
              if (!row.owner) return 'Assign the linked case before submitting a decision.'
              if (decision === 'Challenge dispute' && !evidenceReady(dispute.evidence)) return 'Review all required evidence before challenging this dispute.'
              if (decision === 'Challenge dispute' && dispute.deadline < demoClock) return 'The response deadline has passed. You can still record an acceptance.'
            }}
            impact={decision => 'Set the dispute to ' + (decision === 'Challenge dispute' ? 'Challenge submitted' : 'Accepted')
              + ' and resolve ' + row.id + '.'}
            submit={(decision, reason, revision) => perform({ kind: 'dispute', id: dispute.id, decision, reason }, revision)} />
          : <RecordedDecision data={data} entity="Dispute" id={dispute.id} status={dispute.status} closed />}
        {!pending && <div className="panel outcome"><IconFileCheck size={19} /><Link to={'/cases?q=' + row.id}>Review case outcome</Link></div>}
      </div>
    </div>
  </>
}
