import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { WorkspaceList } from "./pages/WorkspaceList";
import { WorkspaceDetail } from "./pages/WorkspaceDetail";

function Header() {
  return (
    <header className="app-header">
      <Link to="/" style={{ textDecoration: "none" }}>
        <div className="app-header__brand">
          <span className="app-header__agent-dot" />
          <span className="app-header__name">Matchmaker</span>
          <span className="app-header__code">AG003</span>
        </div>
      </Link>
    </header>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<WorkspaceList />} />
          <Route path="/w/:slug/*" element={<WorkspaceDetail />} />
        </Routes>
      </main>
    </div>
  );
}
