export default async function handler(req, res) {
  try {
    const tests = [];

    try { await import("express"); tests.push("express: ok"); } catch(e) { tests.push("express: " + e.message.slice(0, 200)); }
    try { await import("@libsql/client"); tests.push("libsql: ok"); } catch(e) { tests.push("libsql: " + e.message.slice(0, 200)); }
    try { await import("@anthropic-ai/sdk"); tests.push("anthropic: ok"); } catch(e) { tests.push("anthropic: " + e.message.slice(0, 200)); }
    try { await import("mammoth"); tests.push("mammoth: ok"); } catch(e) { tests.push("mammoth: " + e.message.slice(0, 200)); }
    try { await import("../server/index.js"); tests.push("server/index: ok"); } catch(e) { tests.push("server/index: " + e.message.slice(0, 300)); }

    res.json({ node: process.version, tests });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack?.split("\n").slice(0, 5) });
  }
}
