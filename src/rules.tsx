import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { IconFlask, IconLock } from '@tabler/icons-react'
import { risk, type Data, type Rule } from './domain'
import { Missing } from './details'
import { perform, ruleMatches, ruleSummary, thresholdValid } from './store'
import { ActionLink, BackLink, Badge, Dialog, Feedback, FieldList, PageHeader, Panel, RecordLink, State, Table, useFeedback } from './ui'

const metricLabel = (metric: Rule['metric']) => metric === 'score' ? 'Risk score' : 'Attempts / 10 min'
const condition = (rule: Pick<Rule, 'metric' | 'threshold'>) => metricLabel(rule.metric) + ' ≥ ' + rule.threshold

export function Rules({ data }: { data: Data }) {
  return <>
    <PageHeader title="Rules management" />
    <Panel title="Review rules" action={<span className="queue-total">{data.rules.filter(r => r.active).length} active</span>}>
      {data.rules.length ? <Table label="Review rules" rows={data.rules} columns={[
        { key: 'id', label: 'Rule', render: r => <RecordLink entity="Rule" id={r.id} /> },
        { key: 'name', label: 'Name', render: r => <span className="cell-stack"><strong>{r.name}</strong><span>{r.protected ? 'Risk Manager only' : 'Analyst managed'}</span></span> },
        { key: 'condition', label: 'Condition', render: r => condition(r) },
        { key: 'priority', label: 'Priority', render: r => <Badge value={r.priority} /> },
        { key: 'status', label: 'Status', render: r => <Badge value={r.active ? 'Active' : 'Draft'} /> },
      ]} /> : <State title="No rules available" />}
    </Panel>
  </>
}

export function RuleDetail({ data }: { data: Data }) {
  const { id } = useParams()
  const rule = data.rules.find(r => r.id === id)
  if (!rule) return <Missing title="Rule unavailable" back="/rules" />
  return <RuleEditor key={rule.id} rule={rule} data={data} />
}

function RuleEditor({ rule, data }: { rule: Rule; data: Data }) {
  const [input, setInput] = useState(String(rule.threshold))
  const [active, setActive] = useState(rule.active)
  const [test, setTest] = useState<{ threshold: number; active: boolean; revision: string }>()
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const { feedback, report, clear } = useFeedback()
  const threshold = input ? Number(input) : NaN
  const max = rule.metric === 'score' ? 100 : 20
  const matching = test ? ruleMatches({ metric: rule.metric, threshold: test.threshold }, data) : []
  const changed = threshold !== rule.threshold || active !== rule.active
  const ready = test && test.threshold === threshold && test.active === active && test.revision === data.revision
  return <>
    <PageHeader title={rule.name} label={rule.id}><BackLink to="/rules">Back to rules</BackLink></PageHeader>
    <div className="detail-grid">
      <div className="detail-main">
        <Panel title="Test rule" action={<IconFlask size={20} />}>
          <div className="detail-body">
            <form className="form-stack" noValidate onSubmit={e => {
              e.preventDefault()
              clear()
              if (!thresholdValid(rule, threshold)) return report({ ok: false, message: 'Enter a whole number from 1 to ' + max + '.' })
              setTest({ threshold, active, revision: data.revision })
            }}>
              <label><span className="field-label">{metricLabel(rule.metric)} threshold</span>
                <input type="number" min={1} max={max} step={1} value={input} onChange={e => { setInput(e.target.value); clear() }} />
              </label>
              <label className="check"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Activate on publish</label>
              <Feedback {...feedback} />
              <div className="form-actions"><button className="button primary">Run test</button></div>
            </form>
          </div>
        </Panel>
        <Panel title="Test results" action={test && <span className="queue-total">{matching.length} / {data.transactions.length} match</span>}>
          {test ? <>
            <div className="detail-body"><p>{condition({ metric: rule.metric, threshold: test.threshold })}</p>
              {matching.length > 5 && <p className="hint">First 5 matches</p>}
              {!ready && <p className="hint">Inputs or records changed. Run the test again before publishing.</p>}
            </div>
            {matching.length ? <Table label="Rule test matches" rows={matching.slice(0, 5)} columns={[
              { key: 'id', label: 'Transaction', render: t => <RecordLink entity="Transaction" id={t.id} /> },
              { key: 'merchant', label: 'Merchant', render: t => t.merchant },
              { key: 'risk', label: 'Risk level', render: t => <Badge value={risk(t.score)} /> },
              { key: 'value', label: metricLabel(rule.metric), numeric: true, render: t => t[rule.metric] },
            ]} /> : <State title="No matching transactions" />}
          </> : <State title="No test run yet">Run the rule against workspace transactions.</State>}
        </Panel>
      </div>
      <div className="detail-aside">
        <Panel title="Current rule" action={<Badge value={rule.active ? 'Active' : 'Draft'} />}>
          <div className="detail-body"><p>{rule.description}</p><FieldList entries={[
            { label: 'Condition', value: condition(rule) }, { label: 'Priority', value: <Badge value={rule.priority} /> },
          ]} /><ActionLink to={'/audit?object=' + rule.id}>View audit trail</ActionLink></div>
        </Panel>
        <Panel title="Publish changes">
          <div className="detail-body">
            {rule.protected ? <p className="feedback error"><IconLock size={17} />Permission denied. A Risk Manager must publish changes to this rule.</p> :
              <p className="hint" id="publish-hint">{!changed ? 'Edit the threshold or activation status first.' : !ready
                ? 'Run a test with the current settings first.' : 'Review the condition and activation status before publishing.'}</p>}
            <button className="button" disabled={rule.protected || !ready || !changed}
              aria-describedby={rule.protected ? undefined : 'publish-hint'} onClick={() => { setError(''); setConfirm(true) }}>Review changes</button>
          </div>
        </Panel>
      </div>
    </div>
    {confirm && test && <Dialog title="Publish changes" onClose={() => setConfirm(false)}>
      <FieldList entries={[
        { label: 'Rule', value: rule.id }, { label: 'Previous', value: ruleSummary(rule) },
        { label: 'New', value: ruleSummary({ ...rule, threshold: test.threshold, active: test.active }) },
        { label: 'Test matches', value: matching.length + ' of ' + data.transactions.length },
      ]} />
      <p className="hint">Publishing updates rule configuration. Existing alerts retain the rule that triggered them.</p>
      <Feedback error={error} />
      <div className="form-actions"><button className="button" onClick={() => setConfirm(false)}>Cancel</button>
        <button className="button primary" disabled={test.revision !== data.revision} onClick={async () => {
          const result = await perform({ kind: 'rule', id: rule.id, threshold: test.threshold, active: test.active }, test.revision)
          if (!result.ok) return setError(result.message)
          setConfirm(false)
          setTest(undefined)
          report(result)
        }}>Publish changes</button>
      </div>
    </Dialog>}
  </>
}
