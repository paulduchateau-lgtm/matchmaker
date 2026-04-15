import { useState, useEffect } from "react";
import { useParams, Routes, Route, NavLink } from "react-router-dom";
import { Package, FileText, Target, ArrowLeft, MessageSquare } from "lucide-react";
import { getWorkspace, getStats } from "../lib/api";
import { ResourcesTab } from "../components/ResourcesTab";
import { NeedsTab } from "../components/NeedsTab";
import { DocumentsTab } from "../components/DocumentsTab";
import { ChatTab } from "../components/ChatTab";
import { Link } from "react-router-dom";

export function WorkspaceDetail() {
  const { slug } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [stats, setStats] = useState({ resources: 0, needs: 0, documents: 0, matches: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const ws = await getWorkspace(slug);
        setWorkspace(ws);
        const s = await getStats(ws.id);
        setStats(s);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  function refreshStats() {
    if (workspace) getStats(workspace.id).then(setStats);
  }

  if (loading) return <div className="empty-state"><p>Chargement...</p></div>;
  if (!workspace) return <div className="empty-state"><p>Espace de travail introuvable.</p></div>;

  return (
    <>
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)", color: "var(--color-sage)", fontSize: "var(--text-body-sm)" }}>
          <ArrowLeft size={14} /> Espaces de travail
        </Link>
      </div>

      <div style={{ marginBottom: "var(--sp-5)" }}>
        <h1 style={{ fontSize: "var(--text-headline)", fontWeight: "var(--weight-medium)" }}>{workspace.name}</h1>
        <div style={{ display: "flex", gap: "var(--sp-2)", marginTop: "var(--sp-2)" }}>
          {workspace.client_name && <span className="tag tag--green">{workspace.client_name}</span>}
          {workspace.industry && <span className="tag">{workspace.industry}</span>}
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card__value">{stats.resources}</div>
          <div className="stat-card__label">Ressources</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{stats.needs}</div>
          <div className="stat-card__label">Besoins</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{stats.documents}</div>
          <div className="stat-card__label">Documents</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{stats.matches}</div>
          <div className="stat-card__label">Matches</div>
        </div>
      </div>

      <nav style={{ display: "flex", gap: "var(--sp-1)", marginBottom: "var(--sp-5)", borderBottom: "1px solid #363530", paddingBottom: "var(--sp-3)" }}>
        <TabLink to={`/w/${slug}`} end><Package size={14} /> Ressources</TabLink>
        <TabLink to={`/w/${slug}/needs`}><Target size={14} /> Besoins</TabLink>
        <TabLink to={`/w/${slug}/documents`}><FileText size={14} /> Documents</TabLink>
        <TabLink to={`/w/${slug}/chat`}><MessageSquare size={14} /> Chat</TabLink>
      </nav>

      <Routes>
        <Route path="/" element={<ResourcesTab workspaceId={workspace.id} onUpdate={refreshStats} />} />
        <Route path="/needs" element={<NeedsTab workspaceId={workspace.id} onUpdate={refreshStats} />} />
        <Route path="/documents" element={<DocumentsTab workspaceId={workspace.id} onUpdate={refreshStats} />} />
        <Route path="/chat" element={<ChatTab workspaceId={workspace.id} />} />
      </Routes>
    </>
  );
}

function TabLink({ to, end, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--sp-2)",
        padding: "var(--sp-2) var(--sp-3)",
        borderRadius: "var(--radius-t2)",
        fontSize: "var(--text-body-sm)",
        fontWeight: "var(--weight-medium)",
        color: isActive ? "var(--color-green)" : "var(--color-sage)",
        background: isActive ? "rgba(165, 217, 0, 0.08)" : "transparent",
        textDecoration: "none",
        transition: "all 0.15s",
      })}
    >
      {children}
    </NavLink>
  );
}
