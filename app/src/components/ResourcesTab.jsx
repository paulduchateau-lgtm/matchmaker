import { useState, useEffect } from "react";
import { Plus, Trash2, Package } from "lucide-react";
import { listResources, createResource, deleteResource } from "../lib/api";

const RESOURCE_TYPES = [
  { value: "service", label: "Service" },
  { value: "guarantee", label: "Garantie" },
  { value: "reference", label: "Référence" },
  { value: "offer", label: "Offre" },
  { value: "person", label: "Personne" },
];

const TYPE_COLORS = {
  service: "tag--green",
  guarantee: "tag--amber",
  reference: "tag--copper",
  offer: "tag--green",
  person: "tag--amber",
};

export function ResourcesTab({ workspaceId, onUpdate }) {
  const [resources, setResources] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    type: "service", name: "", description: "",
    capabilities: "", experiences: "",
    cost_value: "", cost_unit: "EUR/jour",
  });

  useEffect(() => {
    listResources(workspaceId).then(setResources).catch(console.error);
  }, [workspaceId]);

  async function handleCreate(e) {
    e.preventDefault();
    const data = {
      ...form,
      capabilities: form.capabilities ? form.capabilities.split(",").map((s) => s.trim()) : [],
      experiences: form.experiences ? form.experiences.split(",").map((s) => s.trim()) : [],
      cost_value: form.cost_value ? parseFloat(form.cost_value) : null,
    };
    const res = await createResource(workspaceId, data);
    setResources((prev) => [res, ...prev]);
    setShowCreate(false);
    setForm({ type: "service", name: "", description: "", capabilities: "", experiences: "", cost_value: "", cost_unit: "EUR/jour" });
    onUpdate?.();
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cette ressource ?")) return;
    await deleteResource(workspaceId, id);
    setResources((prev) => prev.filter((r) => r.id !== id));
    onUpdate?.();
  }

  function parseJSON(str) {
    try { return JSON.parse(str); } catch { return []; }
  }

  return (
    <>
      <div className="section-header">
        <h2 className="section-title">Ressources</h2>
        <button className="btn btn--primary btn--sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {resources.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon"><Package size={40} /></div>
          <div className="empty-state__title">Aucune ressource</div>
          <p>Ajoutez des services, garanties, offres ou références à matcher avec les besoins.</p>
        </div>
      ) : (
        <div className="grid-2">
          {resources.map((r) => {
            const caps = typeof r.capabilities === "string" ? parseJSON(r.capabilities) : r.capabilities || [];
            const exps = typeof r.experiences === "string" ? parseJSON(r.experiences) : r.experiences || [];
            return (
              <div key={r.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--sp-2)" }}>
                  <div>
                    <span className={`tag ${TYPE_COLORS[r.type] || ""}`} style={{ marginBottom: "var(--sp-2)", display: "inline-block" }}>
                      {RESOURCE_TYPES.find((t) => t.value === r.type)?.label || r.type}
                    </span>
                    <div style={{ fontSize: "var(--text-body-lg)", fontWeight: "var(--weight-medium)" }}>{r.name}</div>
                  </div>
                  <button className="btn btn--danger btn--sm" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></button>
                </div>
                {r.description && <p style={{ color: "var(--color-sage)", fontSize: "var(--text-body-sm)", marginBottom: "var(--sp-2)" }}>{r.description}</p>}
                {caps.length > 0 && (
                  <div style={{ marginBottom: "var(--sp-2)" }}>
                    <span className="ds-label" style={{ color: "var(--color-sage)", marginBottom: "4px", display: "block" }}>Capacités</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {caps.map((c, i) => <span key={i} className="tag">{c}</span>)}
                    </div>
                  </div>
                )}
                {exps.length > 0 && (
                  <div style={{ marginBottom: "var(--sp-2)" }}>
                    <span className="ds-label" style={{ color: "var(--color-sage)", marginBottom: "4px", display: "block" }}>Expériences</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {exps.map((x, i) => <span key={i} className="tag">{x}</span>)}
                    </div>
                  </div>
                )}
                {r.cost_value && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-green)" }}>
                    {r.cost_value} {r.cost_unit}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal__title">Nouvelle ressource</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {RESOURCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nom</label>
                <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Téléconsultation médicale 24/7" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description détaillée de la ressource..." />
              </div>
              <div className="form-group">
                <label className="form-label">Capacités (séparées par des virgules)</label>
                <input className="form-input" value={form.capabilities} onChange={(e) => setForm({ ...form, capabilities: e.target.value })} placeholder="Ex: santé, prévoyance, QVT, téléconsultation" />
              </div>
              <div className="form-group">
                <label className="form-label">Expériences / Références (séparées par des virgules)</label>
                <input className="form-input" value={form.experiences} onChange={(e) => setForm({ ...form, experiences: e.target.value })} placeholder="Ex: BNP Paribas, SNCF, secteur bancaire" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
                <div className="form-group">
                  <label className="form-label">Coût</label>
                  <input className="form-input" type="number" step="0.01" value={form.cost_value} onChange={(e) => setForm({ ...form, cost_value: e.target.value })} placeholder="Ex: 800" />
                </div>
                <div className="form-group">
                  <label className="form-label">Unité</label>
                  <input className="form-input" value={form.cost_unit} onChange={(e) => setForm({ ...form, cost_unit: e.target.value })} placeholder="EUR/jour" />
                </div>
              </div>
              <div className="modal__actions">
                <button type="button" className="btn btn--secondary" onClick={() => setShowCreate(false)}>Annuler</button>
                <button type="submit" className="btn btn--primary">Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
