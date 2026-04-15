import { useState, useEffect, useRef } from "react";
import { Upload, FileText, Trash2, ChevronDown, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { listDocuments, uploadDocument, getDocument, deleteDocument, extractNeeds } from "../lib/api";

export function DocumentsTab({ workspaceId, onUpdate }) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [docDetail, setDocDetail] = useState(null);
  const [extracting, setExtracting] = useState(null);
  const [extractResult, setExtractResult] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    listDocuments(workspaceId).then(setDocuments).catch(console.error);
  }, [workspaceId]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const doc = await uploadDocument(workspaceId, file);
      setDocuments((prev) => [doc, ...prev]);
      onUpdate?.();
    } catch (err) {
      alert("Erreur lors de l'upload : " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function toggleExpand(doc) {
    if (expandedDoc === doc.id) {
      setExpandedDoc(null);
      setDocDetail(null);
      return;
    }
    setExpandedDoc(doc.id);
    const detail = await getDocument(workspaceId, doc.id);
    setDocDetail(detail);
  }

  async function handleExtractNeeds(docId) {
    setExtracting(docId);
    setExtractResult(null);
    try {
      const result = await extractNeeds(workspaceId, docId);
      setExtractResult(result);
      onUpdate?.();
    } catch (err) {
      alert("Erreur d'extraction : " + err.message);
    } finally {
      setExtracting(null);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer ce document ?")) return;
    await deleteDocument(workspaceId, id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (expandedDoc === id) { setExpandedDoc(null); setDocDetail(null); }
    onUpdate?.();
  }

  function parseJSON(str) {
    try { return JSON.parse(str); } catch { return []; }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " o";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
    return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
  }

  return (
    <>
      <div className="section-header">
        <h2 className="section-title">Documents</h2>
        <label className={`btn btn--primary btn--sm ${uploading ? "btn--disabled" : ""}`} style={{ cursor: uploading ? "wait" : "pointer" }}>
          <Upload size={14} /> {uploading ? "Upload..." : "Importer"}
          <input ref={fileRef} type="file" accept=".docx,.pdf,.txt,.md" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon"><FileText size={40} /></div>
          <div className="empty-state__title">Aucun document</div>
          <p>Importez un template d'AO, un cahier des charges ou tout document de référence (DOCX, PDF, TXT).</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          {documents.map((doc) => (
            <div key={doc.id}>
              <div className="card card--clickable" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flex: 1, cursor: "pointer" }} onClick={() => toggleExpand(doc)}>
                  {expandedDoc === doc.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <FileText size={16} style={{ color: "var(--color-green)" }} />
                  <div>
                    <div style={{ fontWeight: "var(--weight-medium)" }}>{doc.original_name}</div>
                    <div style={{ fontSize: "var(--text-caption)", color: "var(--color-sage)" }}>
                      <span className="tag" style={{ marginRight: "var(--sp-2)" }}>{doc.type.toUpperCase()}</span>
                      {formatSize(doc.file_size)}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => handleExtractNeeds(doc.id)}
                    disabled={extracting === doc.id}
                  >
                    {extracting === doc.id ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                    Extraire besoins
                  </button>
                  <button className="btn btn--danger btn--sm" onClick={() => handleDelete(doc.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {expandedDoc === doc.id && docDetail && (
                <div style={{ marginTop: "var(--sp-2)", marginLeft: "var(--sp-6)" }}>
                  {extractResult && expandedDoc === doc.id && (
                    <div className="card" style={{ marginBottom: "var(--sp-3)", borderColor: "var(--color-green)" }}>
                      <span className="ds-label" style={{ color: "var(--color-green)", marginBottom: "var(--sp-2)", display: "block" }}>
                        {extractResult.extracted} besoins extraits
                      </span>
                      <p style={{ color: "var(--color-chrome)", fontSize: "var(--text-body-sm)" }}>
                        Les besoins ont été ajoutés à l'onglet "Besoins". Vous pouvez maintenant les matcher avec vos ressources.
                      </p>
                    </div>
                  )}
                  {(() => {
                    const sections = parseJSON(docDetail.sections);
                    if (sections.length > 0) {
                      return (
                        <div>
                          <span className="ds-label" style={{ color: "var(--color-sage)", marginBottom: "var(--sp-3)", display: "block" }}>
                            {sections.length} sections extraites
                          </span>
                          {sections.map((sec, i) => (
                            <div key={i} className={`doc-section doc-section--h${sec.level}`}>
                              <div className="doc-section__title">{sec.title}</div>
                              {sec.content && <div className="doc-section__preview">{sec.content}</div>}
                            </div>
                          ))}
                        </div>
                      );
                    }
                    if (docDetail.content_text) {
                      return (
                        <div className="card" style={{ maxHeight: 300, overflow: "auto" }}>
                          <pre style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-code)", color: "var(--color-chrome)", whiteSpace: "pre-wrap" }}>
                            {docDetail.content_text.slice(0, 3000)}
                            {docDetail.content_text.length > 3000 ? "\n\n[...]" : ""}
                          </pre>
                        </div>
                      );
                    }
                    return <p style={{ color: "var(--color-sage)" }}>Aucun contenu extrait.</p>;
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
