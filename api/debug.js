export default function handler(req, res) {
  try {
    // Test basic imports one by one
    const tests = [];

    try { require("express"); tests.push("express: ok"); } catch(e) { tests.push("express: " + e.message); }
    try { require("@libsql/client"); tests.push("libsql: ok"); } catch(e) { tests.push("libsql: " + e.message); }
    try { require("@anthropic-ai/sdk"); tests.push("anthropic: ok"); } catch(e) { tests.push("anthropic: " + e.message); }
    try { require("mammoth"); tests.push("mammoth: ok"); } catch(e) { tests.push("mammoth: " + e.message); }
    try { require("uuid"); tests.push("uuid: ok"); } catch(e) { tests.push("uuid: " + e.message); }

    res.json({
      node: process.version,
      env_keys: Object.keys(process.env).filter(k => k.startsWith("TURSO") || k.startsWith("ANTHROPIC") || k === "VERCEL"),
      tests,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack?.split("\n").slice(0, 5) });
  }
}
