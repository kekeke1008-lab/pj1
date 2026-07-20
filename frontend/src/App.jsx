import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import CompanyDetail from "./pages/CompanyDetail.jsx";
import Settings from "./pages/Settings.jsx";

const navLinkClass = ({ isActive }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
  }`;

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">거래처 재무·뉴스 모니터링</h1>
          <nav className="flex gap-1">
            <NavLink to="/" end className={navLinkClass}>
              대시보드
            </NavLink>
            <NavLink to="/settings" className={navLinkClass}>
              설정
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/company/:corpCode" element={<CompanyDetail />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
