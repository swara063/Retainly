import React from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { AppStateProvider } from './state';
import DashboardPage from './pages/DashboardPage';
import RunPage from './pages/RunPage';
import OverviewPage from './pages/OverviewPage';
import DataPage from './pages/DataPage';
import AgentsPage from './pages/AgentsPage';
import ModelPage from './pages/ModelPage';
import FairnessPage from './pages/FairnessPage';
import ChatPage from './pages/ChatPage';
import EmployeesPage from './pages/EmployeesPage';

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const active = location.pathname === to || (to === '/' && location.pathname === '');
  return <Link className={`link ${active ? 'active' : ''}`} to={to}>{children}</Link>;
}

function TopBar() {
  return (
    <header className="topbar">
      <Link className="brand brandLink" to="/">
        <div className="logo"><Sparkles size={18} /></div>
        <div>
          <div className="brandName">Retainly</div>
          <div className="brandTag">Retention Command Center for HR Teams</div>
        </div>
      </Link>
      <nav className="topActions" aria-label="Retainly navigation">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/employees">Employees</NavLink>
        <NavLink to="/overview">Insights</NavLink>
        <NavLink to="/data">Data Story</NavLink>
        <NavLink to="/models">Explainability</NavLink>
        <NavLink to="/fairness">Fairness</NavLink>
        <NavLink to="/agents">Agents</NavLink>
        <NavLink to="/help">Chatbot</NavLink>
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <main>
        <TopBar />
        <div className="content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/run" element={<RunPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/data" element={<DataPage />} />
            <Route path="/models" element={<ModelPage />} />
            <Route path="/fairness" element={<FairnessPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/help" element={<ChatPage />} />
          </Routes>
          <footer className="footer">
            <div className="muted">Retainly is a decision-support tool for retention planning. Use results for supportive HR action, not as the sole basis for employment decisions.</div>
          </footer>
        </div>
      </main>
    </AppStateProvider>
  );
}
