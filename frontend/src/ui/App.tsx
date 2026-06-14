import React from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { AppStateProvider } from './state';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import OverviewPage from './pages/OverviewPage';
import DataPage from './pages/DataPage';
import AgentsPage from './pages/AgentsPage';
import ChatPage from './pages/ChatPage';
import RunPage from './pages/RunPage';

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
        <Link className="link" to="/">Home</Link>
        <Link className="link" to="/employees">Employees</Link>
        <Link className="link" to="/hotspots">Hotspots</Link>
        <Link className="link" to="/action-plan">Action Plan</Link>
        <Link className="link" to="/agents">Agents</Link>
        <Link className="link" to="/report">Report</Link>
        <Link className="link" to="/help">Chatbot</Link>
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
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/hotspots" element={<OverviewPage />} />
            <Route path="/action-plan" element={<DataPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/help" element={<ChatPage />} />
            <Route path="/report" element={<RunPage />} />
          </Routes>
          <footer className="footer">
            <div className="muted">Retainly is a decision-support tool for retention planning. Use results for supportive HR action, not as the sole basis for employment decisions.</div>
          </footer>
        </div>
      </main>
    </AppStateProvider>
  );
}
