import { useState, useEffect } from "react";
import { Plus, Trash2, Target, Zap, FileText, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { listNeeds, createNeed, deleteNeed, runMatch, listMatches, generateResponse } from "../lib/api";
import { RadarChart } from "./RadarChart";

export function NeedsTab({ workspaceId, onUpdate }) {
  const [needs, setNeeds] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", requirements: "", context: "" });
  const [expandedNeed, setExpandedNeed] = useState(null);
  const [matches, setMatches] = useState({});
  const [matching, setMatching] = useState(null);
  const [generating, setGenerating] = useState(null);
  const [generated, setGenerated] = useState({});

  useEffect(() => {
    listNeeds(workspaceId).then(setNeeds).catch(console.error);
  }, [workspaceId]);

  async function handleCreate(e) {
    e.preventDefault();
    const data = {
      ...form,
      requirements: form.requirements ? form.requirements.split(",").map((s) => s.trim()) : [],
    };
    const need = await createNeed(workspaceId, data);
    setNeeds((prev) => [need, ...prev]);
    setShowCreate(false);
    setForm({ title: "", description: "", requirements: "", context: "" });
    onUpdate?.();
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer ce besoin ?")) return;
    await deleteNeed(workspaceId, id);
    setNeeds((prev) => prev.filter((n) => n.id !== id));
    onUpdate?.();
  }

  async function handleMatch(needId) {
    setMatching(needId);
    try {
      const result = await runMatch(workspaceId, needId);
      setMatches((prev) => ({ ...prev, [needId]: result.matches }));
      setExpandedNeed(needId);
      onUpdate?.();
    } catch (err) {
      alert("Erreur de matching : " + err.message);
    } finally {
      setMatching(null);
    }
  }

  async function handleExpand(needId) {
    if (expandedNeed === needId) {
      setExpandedNeed(null);
      return;
    }
    setExpandedNeed(needId);
    if (!matches[needId]) {
      try {
        const result = await listMatches(workspaceId, needId);
        setMatches((prev) => ({ ...prev, [needId]: result }));
      } catch {}
    }
  }

  async function handleGenerate(needId) {
    setGenerating(needId);
    try {
      const result = await generateResponse(workspaceId, needId);
      setGenerated((prev) => ({ ...prev, [needId]: result.generated_content }));
    } catch (err) {
      alert("Erreur de génération : " + err.message);
    } finally {
      setGenerating(null);
    }
  }

  function parseJSON(str) {
    try { return JSON.parse(str); } catch { return []; }
  }
  function parseObj(str) {
    try { return JSON.parse(str); } catch { return {}; }
  }

  return (
    <>
      <div className="section-header">
        <h2 className="section-title">Besoins</h2>
        <button className="btn btn--primary btn--sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {needs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon"><Target size={40} /></div>
          <div className="empty-state__title">Aucun besoin</div>
          <p>Décrivez un besoin ou importez un document pour extraire automatiquement les besoins.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {needs.map((n) => {
            const reqs = typeof n.requirements === "string" ? parseJSON(n.requirements) : n.requirements || [];
            const isExpanded = expandedNeed === n.id;
            const needMatches = matches[n.id] || [];

            return (
              <div key={n.id}>
                <div className="card" style={{ cursor: "pointer" }} onClick={() => handleExpand(n.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flex: 1 }}>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "var(--text-body-lg)", fontWeight: "var(--weight-medium)" }}>{n.title}</div>
                        {n.description && <p style={{ color: "var(--color-sage)", fontSize: "var(--text-body-sm)", marginTop: 2 }}>{n.description.slice(0, 120)}</p>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                      {needMatches.length > 0 && (
                        <span className="tag tag--green">{needMatches.length} match{needMatches.length > 1 ? "es" : ""}</span>
                      )}
                      <button className="btn btn--primary btn--sm" onClick={() => handleMatch(n.id)} disabled={matching === n.id}>
                        {matching === n.id ? <Loader2 size={14} className="spin" /> : <Zap size={14} />}
                        Match
                      </button>
                      <button className="btn btn--secondary btn--sm" onClick={() => handleGenerate(n.id)} disabled={generating === n.id}>
                        {generating === n.id ? <Loader2 size={14} className="spin" /> : <FileText size={14} />}
                        Rédiger
                      </button>
                      <button className="btn btn--danger btn--sm" onClick={() => handleDelete(n.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {reqs.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "var(--sp-2)" }}>
                      {reqs.map((r, i) => <span key={i} className="tag tag--green">{r}</span>)}
                    </div>
                  )}
                </div>

                {/* Expanded: matches + radar + generated content */}
                {isExpanded && (
                  <div style={{ marginTop: "var(--sp-2)", marginLeft: "var(--sp-4)", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
                    {/* Match results */}
                    {needMatches.length > 0 && (
                      <div>
                        <span className="ds-label" style={{ color: "var(--color-sage)", marginBottom: "var(--sp-3)", display: "block" }}>
                          Résultats du matching
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
                          {needMatches.map((m) => {
                            const dimScores = parseObj(m.dimension_scores);
                            return (
                              <div key={m.id || m.resource_id} className="card" style={{ display: "flex", gap: "var(--sp-4)", alignItems: "center" }}>
                                <RadarChart scores={dimScores} size={160} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-2)" }}>
                                    <span style={{ fontSize: "var(--text-headline)", fontWeight: "var(--weight-medium)", color: "var(--color-green)" }}>
                                      {Math.round(m.overall_score)}
                                    </span>
                                    <span style={{ color: "var(--color-sage)", fontSize: "var(--text-caption)" }}>/100</span>
                                    <span className="tag" style={{ marginLeft: "var(--sp-2)" }}>#{m.rank}</span>
                                  </div>
                                  <div style={{ fontSize: "var(--text-body-lg)", fontWeight: "var(--weight-medium)", marginBottom: "var(--sp-1)" }}>
                                    {m.resource_name}
                                  </div>
                                  <span className={`tag ${m.resource_type === "service" ? "tag--green" : m.resource_type === "guarantee" ? "tag--amber" : "tag--copper"}`}>
                                    {m.resource_type}
                                  </span>
                                  {m.explanation && (
                                    <p style={{ color: "var(--color-chrome)", fontSize: "var(--text-body-sm)", marginTop: "var(--sp-2)" }}>
                                      {m.explanation}
                                    </p>
                                  )}
                                  <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-2)", flexWrap: "wrap" }}>
                                    {Object.entries(dimScores).map(([k, v]) => (
                                      <span key={k} style={{ fontSize: "var(--text-caption)", color: v >= 70 ? "var(--color-green)" : v >= 40 ? "var(--color-amber)" : "var(--color-alert)" }}>
                                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase" }}>{k}</span>{" "}
                                        {v}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Generated content */}
                    {generated[n.id] && (
                      <div>
                        <span className="ds-label" style={{ color: "var(--color-sage)", marginBottom: "var(--sp-2)", display: "block" }}>
                          Réponse AO générée
                        </span>
                        <div className="card" style={{ background: "#222120", borderColor: "var(--color-green)", borderWidth: "1px" }}>
                          <div style={{ whiteSpace: "pre-wrap", color: "var(--color-paper)", fontSize: "var(--text-body)", lineHeight: "var(--leading-relaxed)" }}>
                            {generated[n.id]}
                          </div>
                          <div style={{ marginTop: "var(--sp-3)", display: "flex", gap: "var(--sp-2)" }}>
                            <button className="btn btn--secondary btn--sm" onClick={() => navigator.clipboard.writeText(generated[n.id])}>
                              Copier
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
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
            <h2 className="modal__title">Nouveau besoin</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Titre</label>
                <input className="form-input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Section Préambule - AO Santé" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Décrivez le besoin en détail..." />
              </div>
              <div className="form-group">
                <label className="form-label">Critères (séparés par des virgules)</label>
                <input className="form-input" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} placeholder="Ex: expérience assurance, coût < 800/j, QVT" />
              </div>
              <div className="form-group">
                <label className="form-label">Contexte</label>
                <textarea className="form-textarea" value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} placeholder="Ex: Pour cet AO, mettre en avant les services optionnels orientés fonctionnaires..." />
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
