import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Plus, Trash2 } from "lucide-react";
import { listWorkspaces, createWorkspace, deleteWorkspace } from "../lib/api";

export function WorkspaceList() {
  const [workspaces, setWorkspaces] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", industry: "", client_name: "" });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    listWorkspaces()
      .then(setWorkspaces)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const ws = await createWorkspace(form);
    setWorkspaces((prev) => [ws, ...prev]);
    setShowCreate(false);
    setForm({ name: "", description: "", industry: "", client_name: "" });
    navigate(`/w/${ws.slug}`);
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm("Supprimer cet espace de travail ?")) return;
    await deleteWorkspace(id);
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
  }

  if (loading) return <div className="empty-state"><p>Chargement...</p></div>;

  return (
    <>
      <div className="section-header">
        <h1 className="section-title">Espaces de travail</h1>
        <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Nouveau
        </button>
      </div>

      {workspaces.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon"><Briefcase size={48} /></div>
          <div className="empty-state__title">Aucun espace de travail</div>
          <p>Créez un espace pour commencer à matcher des ressources avec des besoins.</p>
        </div>
      ) : (
        <div className="grid-2">
          {workspaces.map((ws) => (
            <div key={ws.id} className="card card--clickable" onClick={() => navigate(`/w/${ws.slug}`)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: "var(--text-title)", fontWeight: "var(--weight-medium)", marginBottom: "var(--sp-1)" }}>
                    {ws.name}
                  </div>
                  {ws.client_name && <span className="tag tag--green">{ws.client_name}</span>}
                  {ws.industry && <span className="tag" style={{ marginLeft: "var(--sp-1)" }}>{ws.industry}</span>}
                </div>
                <button className="btn btn--danger btn--sm" onClick={(e) => handleDelete(e, ws.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
              {ws.description && (
                <p style={{ color: "var(--color-sage)", marginTop: "var(--sp-2)", fontSize: "var(--text-body-sm)" }}>
                  {ws.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal__title">Nouvel espace de travail</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Nom</label>
                <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: AO Santé BNP 2026" />
              </div>
              <div className="form-group">
                <label className="form-label">Client</label>
                <input className="form-input" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="Ex: BNP Paribas" />
              </div>
              <div className="form-group">
                <label className="form-label">Secteur</label>
                <input className="form-input" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="Ex: Banque, Assurance, Industrie..." />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Contexte de l'AO ou du besoin..." />
              </div>
              <div className="modal__actions">
                <button type="button" className="btn btn--secondary" onClick={() => setShowCreate(false)}>Annuler</button>
                <button type="submit" className="btn btn--primary">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
