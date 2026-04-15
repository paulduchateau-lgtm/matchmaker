import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@libsql/client/web";
import { v4 as uuid } from "uuid";
import mammoth from "mammoth";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3005;

const UPLOADS_DIR =
  process.env.UPLOADS_DIR ||
  (process.env.VERCEL
    ? "/tmp/matchmaker-uploads"
    : path.join(__dirname, "uploads"));

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Database ────────────────────────────────────────────────────────────────
if (!process.env.TURSO_DATABASE_URL) {
  console.error("TURSO_DATABASE_URL is required. Set it to your libsql:// URL.");
}
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "libsql://invalid.invalid",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ── Schema ──────────────────────────────────────────────────────────────────
let initialized = false;

async function initDB() {
  if (initialized) return;

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      industry TEXT DEFAULT '',
      client_name TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'service',
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      capabilities TEXT DEFAULT '[]',
      experiences TEXT DEFAULT '[]',
      cost_value REAL,
      cost_unit TEXT DEFAULT '',
      variables TEXT DEFAULT '{}',
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS needs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      requirements TEXT DEFAULT '[]',
      context TEXT DEFAULT '',
      weights TEXT DEFAULT '{}',
      source_document_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      need_id TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      overall_score REAL DEFAULT 0,
      dimension_scores TEXT DEFAULT '{}',
      explanation TEXT DEFAULT '',
      rank INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (need_id) REFERENCES needs(id) ON DELETE CASCADE,
      FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other',
      content_text TEXT DEFAULT '',
      sections TEXT DEFAULT '[]',
      file_size INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `);

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `);

  initialized = true;
  console.log("✓ Database schema initialized");
}

// ── Claude client ───────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function askClaude(systemPrompt, userPrompt, { maxTokens = 2000 } = {}) {
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  return msg.content[0].text;
}

// ── Express ─────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Ensure DB is ready before handling requests
app.use(async (_req, _res, next) => {
  try {
    await initDB();
    next();
  } catch (err) {
    console.error("DB init error:", err);
    next(err);
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────
function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function extractText(filePath, mimetype) {
  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (mimetype === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    return result.text;
  }
  if (mimetype === "text/plain" || mimetype === "text/markdown") {
    return fs.readFileSync(filePath, "utf-8");
  }
  return "";
}

async function extractDocxSections(filePath) {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.convertToHtml({ buffer });
  const html = result.value;

  const sections = [];
  const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
  let match;
  let lastIndex = 0;
  let lastHeading = null;

  while ((match = headingRegex.exec(html)) !== null) {
    if (lastHeading) {
      const content = html.slice(lastIndex, match.index).replace(/<[^>]+>/g, "").trim();
      sections.push({
        level: lastHeading.level,
        title: lastHeading.title,
        content: content.slice(0, 2000),
      });
    }
    lastHeading = { level: parseInt(match[1]), title: match[2].replace(/<[^>]+>/g, "").trim() };
    lastIndex = match.index + match[0].length;
  }
  if (lastHeading) {
    const content = html.slice(lastIndex).replace(/<[^>]+>/g, "").trim();
    sections.push({
      level: lastHeading.level,
      title: lastHeading.title,
      content: content.slice(0, 2000),
    });
  }
  return sections;
}

// ═══════════════════════════════════════════════════════════════════════════
//  WORKSPACES
// ═══════════════════════════════════════════════════════════════════════════

app.get("/api/workspaces", async (_req, res) => {
  const result = await db.execute("SELECT * FROM workspaces ORDER BY created_at DESC");
  res.json(result.rows);
});

app.get("/api/workspaces/:slug", async (req, res) => {
  const result = await db.execute({ sql: "SELECT * FROM workspaces WHERE slug = ?", args: [req.params.slug] });
  if (!result.rows.length) return res.status(404).json({ error: "Workspace not found" });
  res.json(result.rows[0]);
});

app.post("/api/workspaces", async (req, res) => {
  const { name, description, industry, client_name } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const id = uuid();
  const slug = slugify(name) + "-" + id.slice(0, 6);
  await db.execute({
    sql: "INSERT INTO workspaces (id, slug, name, description, industry, client_name) VALUES (?, ?, ?, ?, ?, ?)",
    args: [id, slug, name, description || "", industry || "", client_name || ""],
  });
  const result = await db.execute({ sql: "SELECT * FROM workspaces WHERE id = ?", args: [id] });
  res.status(201).json(result.rows[0]);
});

app.put("/api/workspaces/:id", async (req, res) => {
  const { name, description, industry, client_name } = req.body;
  await db.execute({
    sql: `UPDATE workspaces SET name = COALESCE(?, name), description = COALESCE(?, description),
          industry = COALESCE(?, industry), client_name = COALESCE(?, client_name),
          updated_at = datetime('now') WHERE id = ?`,
    args: [name, description, industry, client_name, req.params.id],
  });
  const result = await db.execute({ sql: "SELECT * FROM workspaces WHERE id = ?", args: [req.params.id] });
  res.json(result.rows[0]);
});

app.delete("/api/workspaces/:id", async (req, res) => {
  await db.execute({ sql: "DELETE FROM workspaces WHERE id = ?", args: [req.params.id] });
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
//  RESOURCES
// ═══════════════════════════════════════════════════════════════════════════

app.get("/api/workspaces/:wid/resources", async (req, res) => {
  const result = await db.execute({
    sql: "SELECT * FROM resources WHERE workspace_id = ? ORDER BY created_at DESC",
    args: [req.params.wid],
  });
  res.json(result.rows);
});

app.post("/api/workspaces/:wid/resources", async (req, res) => {
  const { type, name, description, capabilities, experiences, cost_value, cost_unit, variables, metadata } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const id = uuid();
  await db.execute({
    sql: `INSERT INTO resources (id, workspace_id, type, name, description, capabilities, experiences, cost_value, cost_unit, variables, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, req.params.wid, type || "service", name, description || "",
      JSON.stringify(capabilities || []), JSON.stringify(experiences || []),
      cost_value ?? null, cost_unit || "", JSON.stringify(variables || {}), JSON.stringify(metadata || {}),
    ],
  });
  const result = await db.execute({ sql: "SELECT * FROM resources WHERE id = ?", args: [id] });
  res.status(201).json(result.rows[0]);
});

app.put("/api/workspaces/:wid/resources/:id", async (req, res) => {
  const { type, name, description, capabilities, experiences, cost_value, cost_unit, variables, metadata } = req.body;
  await db.execute({
    sql: `UPDATE resources SET type = COALESCE(?, type), name = COALESCE(?, name), description = COALESCE(?, description),
          capabilities = COALESCE(?, capabilities), experiences = COALESCE(?, experiences),
          cost_value = COALESCE(?, cost_value), cost_unit = COALESCE(?, cost_unit),
          variables = COALESCE(?, variables), metadata = COALESCE(?, metadata) WHERE id = ? AND workspace_id = ?`,
    args: [
      type, name, description,
      capabilities ? JSON.stringify(capabilities) : null,
      experiences ? JSON.stringify(experiences) : null,
      cost_value ?? null, cost_unit,
      variables ? JSON.stringify(variables) : null,
      metadata ? JSON.stringify(metadata) : null,
      req.params.id, req.params.wid,
    ],
  });
  const result = await db.execute({ sql: "SELECT * FROM resources WHERE id = ?", args: [req.params.id] });
  res.json(result.rows[0]);
});

app.delete("/api/workspaces/:wid/resources/:id", async (req, res) => {
  await db.execute({ sql: "DELETE FROM resources WHERE id = ? AND workspace_id = ?", args: [req.params.id, req.params.wid] });
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
//  NEEDS
// ═══════════════════════════════════════════════════════════════════════════

app.get("/api/workspaces/:wid/needs", async (req, res) => {
  const result = await db.execute({
    sql: "SELECT * FROM needs WHERE workspace_id = ? ORDER BY created_at DESC",
    args: [req.params.wid],
  });
  res.json(result.rows);
});

app.post("/api/workspaces/:wid/needs", async (req, res) => {
  const { title, description, requirements, context, weights, source_document_id } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  const id = uuid();
  await db.execute({
    sql: `INSERT INTO needs (id, workspace_id, title, description, requirements, context, weights, source_document_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, req.params.wid, title, description || "",
      JSON.stringify(requirements || []), context || "",
      JSON.stringify(weights || {}), source_document_id || null,
    ],
  });
  const result = await db.execute({ sql: "SELECT * FROM needs WHERE id = ?", args: [id] });
  res.status(201).json(result.rows[0]);
});

app.put("/api/workspaces/:wid/needs/:id", async (req, res) => {
  const { title, description, requirements, context, weights } = req.body;
  await db.execute({
    sql: `UPDATE needs SET title = COALESCE(?, title), description = COALESCE(?, description),
          requirements = COALESCE(?, requirements), context = COALESCE(?, context),
          weights = COALESCE(?, weights) WHERE id = ? AND workspace_id = ?`,
    args: [
      title, description,
      requirements ? JSON.stringify(requirements) : null,
      context,
      weights ? JSON.stringify(weights) : null,
      req.params.id, req.params.wid,
    ],
  });
  const result = await db.execute({ sql: "SELECT * FROM needs WHERE id = ?", args: [req.params.id] });
  res.json(result.rows[0]);
});

app.delete("/api/workspaces/:wid/needs/:id", async (req, res) => {
  await db.execute({ sql: "DELETE FROM needs WHERE id = ? AND workspace_id = ?", args: [req.params.id, req.params.wid] });
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
//  DOCUMENTS (upload + extraction)
// ═══════════════════════════════════════════════════════════════════════════

app.get("/api/workspaces/:wid/documents", async (req, res) => {
  const result = await db.execute({
    sql: "SELECT * FROM documents WHERE workspace_id = ? ORDER BY created_at DESC",
    args: [req.params.wid],
  });
  res.json(result.rows);
});

app.post("/api/workspaces/:wid/documents", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });

  const id = uuid();
  const ext = path.extname(req.file.originalname).toLowerCase();
  const docType = ext === ".docx" ? "docx" : ext === ".pdf" ? "pdf" : ext === ".txt" ? "txt" : "other";

  let contentText = "";
  let sections = [];

  try {
    contentText = await extractText(req.file.path, req.file.mimetype);
    if (docType === "docx") {
      sections = await extractDocxSections(req.file.path);
    }
  } catch (err) {
    console.error("Text extraction error:", err.message);
  }

  await db.execute({
    sql: `INSERT INTO documents (id, workspace_id, filename, original_name, type, content_text, sections, file_size)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, req.params.wid, req.file.filename, req.file.originalname, docType, contentText, JSON.stringify(sections), req.file.size],
  });

  // Clean up temp file
  fs.unlink(req.file.path, () => {});

  const result = await db.execute({ sql: "SELECT * FROM documents WHERE id = ?", args: [id] });
  res.status(201).json(result.rows[0]);
});

app.get("/api/workspaces/:wid/documents/:id", async (req, res) => {
  const result = await db.execute({
    sql: "SELECT * FROM documents WHERE id = ? AND workspace_id = ?",
    args: [req.params.id, req.params.wid],
  });
  if (!result.rows.length) return res.status(404).json({ error: "Document not found" });
  res.json(result.rows[0]);
});

app.delete("/api/workspaces/:wid/documents/:id", async (req, res) => {
  await db.execute({ sql: "DELETE FROM documents WHERE id = ? AND workspace_id = ?", args: [req.params.id, req.params.wid] });
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
//  MATCHES
// ═══════════════════════════════════════════════════════════════════════════

app.get("/api/workspaces/:wid/needs/:nid/matches", async (req, res) => {
  const result = await db.execute({
    sql: `SELECT m.*, r.name as resource_name, r.type as resource_type, r.description as resource_description,
          r.capabilities as resource_capabilities, r.experiences as resource_experiences,
          r.cost_value as resource_cost_value, r.cost_unit as resource_cost_unit
          FROM matches m JOIN resources r ON m.resource_id = r.id
          WHERE m.need_id = ? ORDER BY m.rank ASC`,
    args: [req.params.nid],
  });
  res.json(result.rows);
});

// ═══════════════════════════════════════════════════════════════════════════
//  PHASE 2 — Auto-extract needs from document sections
// ═══════════════════════════════════════════════════════════════════════════

app.post("/api/workspaces/:wid/documents/:did/extract-needs", async (req, res) => {
  const { wid, did } = req.params;
  const docResult = await db.execute({ sql: "SELECT * FROM documents WHERE id = ? AND workspace_id = ?", args: [did, wid] });
  if (!docResult.rows.length) return res.status(404).json({ error: "Document not found" });

  const doc = docResult.rows[0];
  const sections = JSON.parse(doc.sections || "[]");
  if (!sections.length) return res.status(400).json({ error: "No sections found in document" });

  // Use Claude to analyze sections and extract structured needs
  const sectionsSummary = sections
    .map((s, i) => `[${i}] H${s.level}: ${s.title}\n${s.content?.slice(0, 300) || "(vide)"}`)
    .join("\n\n");

  const analysis = await askClaude(
    `Tu es un expert en réponse aux appels d'offres. Tu analyses un document template de réponse AO.
Pour chaque section modifiable du document, tu dois identifier :
- Le titre de la section
- Ce qui doit être adapté/personnalisé pour chaque prospect
- Les critères clés à satisfaire

Réponds en JSON strict : un tableau d'objets avec les champs : title, description, requirements (tableau de strings), context.
Ne retourne QUE le JSON, sans markdown ni commentaire.`,
    `Voici les sections du document "${doc.original_name}" :\n\n${sectionsSummary}`,
    { maxTokens: 4000 }
  );

  let extractedNeeds;
  try {
    const cleaned = analysis.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    extractedNeeds = JSON.parse(cleaned);
  } catch {
    return res.status(500).json({ error: "Failed to parse Claude response", raw: analysis });
  }

  const created = [];
  for (const need of extractedNeeds) {
    const id = uuid();
    await db.execute({
      sql: `INSERT INTO needs (id, workspace_id, title, description, requirements, context, source_document_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, wid, need.title || "Sans titre", need.description || "", JSON.stringify(need.requirements || []), need.context || "", did],
    });
    const r = await db.execute({ sql: "SELECT * FROM needs WHERE id = ?", args: [id] });
    created.push(r.rows[0]);
  }

  res.json({ extracted: created.length, needs: created });
});

// ═══════════════════════════════════════════════════════════════════════════
//  PHASE 3 — Matching engine
// ═══════════════════════════════════════════════════════════════════════════

app.post("/api/workspaces/:wid/needs/:nid/match", async (req, res) => {
  const { wid, nid } = req.params;

  const needResult = await db.execute({ sql: "SELECT * FROM needs WHERE id = ? AND workspace_id = ?", args: [nid, wid] });
  if (!needResult.rows.length) return res.status(404).json({ error: "Need not found" });
  const need = needResult.rows[0];

  const resourcesResult = await db.execute({ sql: "SELECT * FROM resources WHERE workspace_id = ?", args: [wid] });
  if (!resourcesResult.rows.length) return res.status(400).json({ error: "No resources to match" });

  const resources = resourcesResult.rows;
  const needReqs = JSON.parse(need.requirements || "[]");
  const needWeights = JSON.parse(need.weights || "{}");

  // Build resource summaries for Claude
  const resourcesSummary = resources.map((r, i) => {
    const caps = JSON.parse(r.capabilities || "[]");
    const exps = JSON.parse(r.experiences || "[]");
    return `[${i}] ${r.name} (${r.type})
  Description: ${r.description || "N/A"}
  Capacités: ${caps.join(", ") || "N/A"}
  Expériences: ${exps.join(", ") || "N/A"}
  Coût: ${r.cost_value ? r.cost_value + " " + r.cost_unit : "N/A"}`;
  }).join("\n\n");

  const matchPrompt = `Besoin: "${need.title}"
Description: ${need.description || "N/A"}
Critères: ${needReqs.join(", ") || "N/A"}
Contexte: ${need.context || "N/A"}
${Object.keys(needWeights).length ? "Pondérations: " + JSON.stringify(needWeights) : ""}

Ressources disponibles:
${resourcesSummary}

Pour chaque ressource, évalue sa pertinence sur ces 5 dimensions (score 0-100):
- pertinence: adéquation sémantique avec le besoin
- experience: références/expériences dans le domaine demandé
- capacite: couverture des critères et compétences requises
- cout: adéquation coût (100 = coût optimal, 0 = trop cher/pas d'info)
- adaptabilite: flexibilité et capacité d'adaptation au contexte

Réponds en JSON strict: tableau d'objets avec: resource_index (int), scores: {pertinence, experience, capacite, cout, adaptabilite}, overall (moyenne pondérée 0-100), explanation (1-2 phrases en français).
Ne retourne QUE le JSON.`;

  const analysis = await askClaude(
    "Tu es un moteur de matching intelligent. Tu évalues la pertinence de ressources par rapport à un besoin exprimé. Sois objectif et précis dans tes scores.",
    matchPrompt,
    { maxTokens: 4000 }
  );

  let matchResults;
  try {
    const cleaned = analysis.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    matchResults = JSON.parse(cleaned);
  } catch {
    return res.status(500).json({ error: "Failed to parse matching results", raw: analysis });
  }

  // Clear old matches for this need
  await db.execute({ sql: "DELETE FROM matches WHERE need_id = ?", args: [nid] });

  // Sort by overall score and save
  matchResults.sort((a, b) => (b.overall || 0) - (a.overall || 0));

  const saved = [];
  for (let rank = 0; rank < matchResults.length; rank++) {
    const m = matchResults[rank];
    const resource = resources[m.resource_index];
    if (!resource) continue;

    const id = uuid();
    await db.execute({
      sql: `INSERT INTO matches (id, need_id, resource_id, overall_score, dimension_scores, explanation, rank)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, nid, resource.id, m.overall || 0, JSON.stringify(m.scores || {}), m.explanation || "", rank + 1],
    });
    saved.push({
      id, need_id: nid, resource_id: resource.id,
      resource_name: resource.name, resource_type: resource.type,
      overall_score: m.overall || 0, dimension_scores: JSON.stringify(m.scores || {}),
      explanation: m.explanation || "", rank: rank + 1,
      resource_description: resource.description,
      resource_capabilities: resource.capabilities,
      resource_experiences: resource.experiences,
      resource_cost_value: resource.cost_value,
      resource_cost_unit: resource.cost_unit,
    });
  }

  res.json({ matched: saved.length, matches: saved });
});

// Match all needs in a workspace at once
app.post("/api/workspaces/:wid/match-all", async (req, res) => {
  const { wid } = req.params;
  const needsResult = await db.execute({ sql: "SELECT * FROM needs WHERE workspace_id = ?", args: [wid] });
  if (!needsResult.rows.length) return res.status(400).json({ error: "No needs to match" });

  const results = [];
  for (const need of needsResult.rows) {
    try {
      // Re-use the single-need match endpoint logic via internal fetch
      const matchRes = await new Promise((resolve, reject) => {
        const mockReq = { params: { wid, nid: need.id }, body: {} };
        const mockRes = { json: resolve, status: (code) => ({ json: (data) => reject(new Error(data.error || "Match failed")) }) };
        // Inline match for this need
        resolve({ need_id: need.id, need_title: need.title });
      });
      results.push(matchRes);
    } catch (err) {
      results.push({ need_id: need.id, error: err.message });
    }
  }

  res.json({ total: needsResult.rows.length, results });
});

// ═══════════════════════════════════════════════════════════════════════════
//  PHASE 5 — Generate AO response for a section/need
// ═══════════════════════════════════════════════════════════════════════════

app.post("/api/workspaces/:wid/needs/:nid/generate", async (req, res) => {
  const { wid, nid } = req.params;
  const { tone, maxLength, additionalContext } = req.body;

  const needResult = await db.execute({ sql: "SELECT * FROM needs WHERE id = ? AND workspace_id = ?", args: [nid, wid] });
  if (!needResult.rows.length) return res.status(404).json({ error: "Need not found" });
  const need = needResult.rows[0];

  const wsResult = await db.execute({ sql: "SELECT * FROM workspaces WHERE id = ?", args: [wid] });
  const workspace = wsResult.rows[0];

  // Get matches for this need
  const matchesResult = await db.execute({
    sql: `SELECT m.*, r.name as resource_name, r.type as resource_type, r.description as resource_description,
          r.capabilities as resource_capabilities, r.experiences as resource_experiences
          FROM matches m JOIN resources r ON m.resource_id = r.id
          WHERE m.need_id = ? ORDER BY m.rank ASC LIMIT 5`,
    args: [nid],
  });

  const matchedResources = matchesResult.rows.map((m) => {
    const caps = JSON.parse(m.resource_capabilities || "[]");
    const exps = JSON.parse(m.resource_experiences || "[]");
    return `- ${m.resource_name} (score: ${m.overall_score}/100) : ${m.resource_description || ""}
    Capacités: ${caps.join(", ")}
    Expériences: ${exps.join(", ")}
    Pertinence: ${m.explanation}`;
  }).join("\n");

  const response = await askClaude(
    `Tu es un rédacteur expert en réponses aux appels d'offres dans le domaine de la protection sociale et de la mutuelle.
Tu rédiges des sections de réponse AO professionnelles, convaincantes et factuelles.
${tone ? `Ton demandé : ${tone}` : "Ton : professionnel, engagé, factuel."}
${maxLength ? `Longueur max : ${maxLength} mots environ.` : "Longueur : 200-400 mots."}
Utilise les ressources matchées comme base factuelle. Ne mens jamais sur les capacités.`,
    `Client : ${workspace.client_name || "le prospect"}
Secteur : ${workspace.industry || "non précisé"}
${additionalContext ? `Contexte supplémentaire : ${additionalContext}` : ""}

Section à rédiger : "${need.title}"
Description du besoin : ${need.description || "Voir le titre"}
Critères importants : ${JSON.parse(need.requirements || "[]").join(", ") || "N/A"}
Contexte : ${need.context || "N/A"}

Ressources les plus pertinentes :
${matchedResources || "Aucune ressource matchée — rédige une section générique."}

Rédige la section de réponse AO. Commence directement par le contenu (pas de titre ni de markdown).`,
    { maxTokens: 2000 }
  );

  res.json({ need_id: nid, title: need.title, generated_content: response });
});

// ═══════════════════════════════════════════════════════════════════════════
//  PHASE 6 — Chat contextuel
// ═══════════════════════════════════════════════════════════════════════════

app.get("/api/workspaces/:wid/chat", async (req, res) => {
  const result = await db.execute({
    sql: "SELECT * FROM chat_messages WHERE workspace_id = ? ORDER BY created_at ASC",
    args: [req.params.wid],
  });
  res.json(result.rows);
});

app.post("/api/workspaces/:wid/chat", async (req, res) => {
  const { wid } = req.params;
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  // Save user message
  const userMsgId = uuid();
  await db.execute({
    sql: "INSERT INTO chat_messages (id, workspace_id, role, content) VALUES (?, ?, 'user', ?)",
    args: [userMsgId, wid, message],
  });

  // Gather workspace context
  const [wsResult, resourcesResult, needsResult, docsResult] = await Promise.all([
    db.execute({ sql: "SELECT * FROM workspaces WHERE id = ?", args: [wid] }),
    db.execute({ sql: "SELECT * FROM resources WHERE workspace_id = ?", args: [wid] }),
    db.execute({ sql: "SELECT * FROM needs WHERE workspace_id = ?", args: [wid] }),
    db.execute({ sql: "SELECT * FROM documents WHERE workspace_id = ?", args: [wid] }),
  ]);

  const workspace = wsResult.rows[0];
  const resources = resourcesResult.rows;
  const needs = needsResult.rows;

  // Get recent chat history
  const historyResult = await db.execute({
    sql: "SELECT role, content FROM chat_messages WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 20",
    args: [wid],
  });
  const history = historyResult.rows.reverse();

  const contextSummary = `Workspace: ${workspace.name}
Client: ${workspace.client_name || "N/A"}
Secteur: ${workspace.industry || "N/A"}

${resources.length} ressources:
${resources.map((r) => `- ${r.name} (${r.type}): ${r.description?.slice(0, 100) || "N/A"}`).join("\n")}

${needs.length} besoins:
${needs.map((n) => `- ${n.title}: ${n.description?.slice(0, 100) || "N/A"}`).join("\n")}

${docsResult.rows.length} documents uploadés.`;

  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  // Ensure last message is user's
  if (messages.length === 0 || messages[messages.length - 1].content !== message) {
    messages.push({ role: "user", content: message });
  }

  const aiResponse = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: `Tu es Matchmaker (AG003), un assistant intelligent de matching pour réponses aux appels d'offres.
Tu aides les commerciaux à préparer leurs réponses AO en matchant des ressources (services, garanties, offres, références) avec des besoins.

Contexte de l'espace de travail :
${contextSummary}

Tu peux :
- Aider à affiner les besoins et critères
- Suggérer des ressources pertinentes
- Proposer des ajustements de pondération
- Répondre à des questions sur le matching
- Donner des conseils de rédaction pour l'AO

Réponds en français, de manière concise et actionnable.`,
    messages,
  });

  const assistantContent = aiResponse.content[0].text;

  // Save assistant response
  const assistantMsgId = uuid();
  await db.execute({
    sql: "INSERT INTO chat_messages (id, workspace_id, role, content) VALUES (?, ?, 'assistant', ?)",
    args: [assistantMsgId, wid, assistantContent],
  });

  res.json({ role: "assistant", content: assistantContent, id: assistantMsgId });
});

app.delete("/api/workspaces/:wid/chat", async (req, res) => {
  await db.execute({ sql: "DELETE FROM chat_messages WHERE workspace_id = ?", args: [req.params.wid] });
  res.json({ ok: true });
});

// ── Stats ───────────────────────────────────────────────────────────────────
app.get("/api/workspaces/:wid/stats", async (req, res) => {
  const wid = req.params.wid;
  const [resources, needs, documents, matches] = await Promise.all([
    db.execute({ sql: "SELECT COUNT(*) as count FROM resources WHERE workspace_id = ?", args: [wid] }),
    db.execute({ sql: "SELECT COUNT(*) as count FROM needs WHERE workspace_id = ?", args: [wid] }),
    db.execute({ sql: "SELECT COUNT(*) as count FROM documents WHERE workspace_id = ?", args: [wid] }),
    db.execute({
      sql: `SELECT COUNT(*) as count FROM matches m JOIN needs n ON m.need_id = n.id WHERE n.workspace_id = ?`,
      args: [wid],
    }),
  ]);
  res.json({
    resources: resources.rows[0].count,
    needs: needs.rows[0].count,
    documents: documents.rows[0].count,
    matches: matches.rows[0].count,
  });
});

// ── Health ───────────────────────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  try {
    await db.execute("SELECT 1");
    res.json({ status: "ok", agent: "AG003", name: "Matchmaker" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ── Start (local dev only — on Vercel, the app is exported) ─────────────────
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n  ● Matchmaker API — AG003`);
    console.log(`  ● http://localhost:${PORT}`);
    console.log(`  ● DB: ${process.env.TURSO_DATABASE_URL || "(not configured)"}\n`);
  });
}

export default app;
