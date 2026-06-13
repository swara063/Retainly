import React from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { AppStateProvider } from './state';
import DashboardPage from './pages/DashboardPage';
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
        <a className="link" href="#upload">Home</a>
        <a className="link" href="#employees">Employees</a>
        <a className="link" href="#hotspots">Hotspots</a>
        <a className="link" href="#action-plan">Action Plan</a>
        <a className="link" href="#analysis">Agents</a>
        <a className="link" href="#report">Report</a>
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
            <Route path="/employees" element={<DashboardPage />} />
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
