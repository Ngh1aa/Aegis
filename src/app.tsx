import { useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import {
  IconActivity, IconArrowsExchange, IconBriefcase, IconChartBar, IconHistory,
  IconLayoutDashboard, IconMenu2, IconScale, IconSettings2, IconShieldCheck,
} from '@tabler/icons-react'
import { analyst } from './domain'
import { Analytics, Overview } from './overview'
import { AuditTrail, Cases, Disputes, Transactions } from './queues'
import { CaseDetail, DisputeDetail, Investigation } from './details'
import { RuleDetail, Rules } from './rules'
import { loadWorkspace, resetWorkspace, useWorkspace } from './store'
import { Dialog, Feedback, State } from './ui'

const groups = [
  { label: 'Operations', items: [
    { to: '/', label: 'Overview', icon: IconLayoutDashboard },
    { to: '/transactions', label: 'Transactions', icon: IconArrowsExchange },
    { to: '/cases', label: 'Cases', icon: IconBriefcase },
    { to: '/disputes', label: 'Disputes', icon: IconScale },
  ] },
  { label: 'Oversight', items: [
    { to: '/analytics', label: 'Analytics', icon: IconChartBar },
    { to: '/rules', label: 'Rules', icon: IconSettings2 },
    { to: '/audit', label: 'Audit trail', icon: IconHistory },
  ] },
]

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return <Link to="/" className="brand" onClick={onNavigate}>
    <img src={import.meta.env.BASE_URL + 'aegis.svg'} alt="" width="32" height="32" /> Aegis
  </Link>
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return <nav className="nav-groups" aria-label="Workspace">
    {groups.map(g => <div className="nav-group" key={g.label}>
      <p className="nav-caption">{g.label}</p>
      {g.items.map(({ to, label, icon: Icon }) =>
        <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate} className="nav-item">
          <Icon size={19} stroke={1.7} />{label}
        </NavLink>)}
    </div>)}
  </nav>
}

function Recovery({ message }: { message: string }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  return <div className="panel"><State title="Workspace unavailable" error action={<div className="form-actions">
    <button className="button" onClick={() => setConfirming(true)}>Restore records</button>
    <button className="button primary" onClick={loadWorkspace}>Retry</button>
  </div>}>{message}</State>
    {confirming && <Dialog title="Restore records" onClose={() => setConfirming(false)}>
      <p>This replaces the workspace in this browser with its starting records.</p>
      <Feedback error={error} />
      <div className="form-actions"><button className="button" onClick={() => setConfirming(false)}>Cancel</button>
        <button className="button danger" onClick={async () => {
          const result = await resetWorkspace()
          if (!result.ok) setError(result.message)
        }}>Restore records</button></div>
    </Dialog>}
  </div>
}

export function App() {
  const snapshot = useWorkspace()
  const [menu, setMenu] = useState(false)
  const main = useRef<HTMLElement>(null)
  const location = useLocation()
  const navigation = useNavigationType()
  const previous = useRef(location)
  useLayoutEffect(() => {
    const prev = previous.current
    previous.current = location
    if (prev.pathname === location.pathname) return
    const restore = navigation === 'POP' && prev.state?.from === location.pathname + location.search
    const id = restore && typeof prev.state?.record === 'string' ? prev.state.record : null
    const selected = id ? main.current?.querySelector<HTMLElement>('[data-record="' + CSS.escape(id) + '"]') : null
    if (selected) {
      selected.closest('tr')?.classList.add('last-selected')
      selected.focus()
    } else {
      window.scrollTo(0, 0)
      main.current?.focus({ preventScroll: true })
    }
  }, [location, navigation])

  return <div className="shell">
    <a className="skip" href="#main-content" onClick={e => { e.preventDefault(); main.current?.focus() }}>Skip to content</a>
    <aside className="sidebar"><Brand /><Navigation />
      <div className="sidebar-foot"><div className="tenant"><IconShieldCheck size={18} /> Risk workspace</div></div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <span className="workspace-label"><IconActivity size={17} /> Risk operations</span>
        <div className="mobile-brand"><button className="icon-button" aria-label="Open navigation" onClick={() => setMenu(true)}><IconMenu2 size={19} /></button><Brand /></div>
        <div className="profile"><span className="avatar" aria-hidden="true">MC</span><span><strong>{analyst}</strong><small>Fraud Analyst</small></span></div>
      </header>
      {menu && <Dialog title="Workspace navigation" onClose={() => setMenu(false)}><Navigation onNavigate={() => setMenu(false)} /></Dialog>}
      <main id="main-content" tabIndex={-1} ref={main} aria-busy={snapshot.phase === 'loading'}>
        {snapshot.phase === 'loading' && <div className="panel loading" role="status">
          <strong>Loading workspace</strong><div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
        </div>}
        {snapshot.phase === 'error' && <Recovery message={snapshot.message} />}
        {snapshot.phase === 'ready' && <Routes>
          <Route index element={<Overview data={snapshot.data} />} />
          <Route path="analytics" element={<Analytics data={snapshot.data} />} />
          <Route path="transactions" element={<Transactions data={snapshot.data} />} />
          <Route path="transactions/:id" element={<Investigation key={location.pathname} data={snapshot.data} />} />
          <Route path="cases" element={<Cases data={snapshot.data} />} />
          <Route path="cases/:id" element={<CaseDetail key={location.pathname} data={snapshot.data} />} />
          <Route path="disputes" element={<Disputes data={snapshot.data} />} />
          <Route path="disputes/:id" element={<DisputeDetail key={location.pathname} data={snapshot.data} />} />
          <Route path="rules" element={<Rules data={snapshot.data} />} />
          <Route path="rules/:id" element={<RuleDetail data={snapshot.data} />} />
          <Route path="audit" element={<AuditTrail data={snapshot.data} />} />
          <Route path="*" element={<State title="Page unavailable" error action={<Link className="button" to="/">Go to overview</Link>}>Check the address or use workspace navigation.</State>} />
        </Routes>}
      </main>
    </div>
  </div>
}
