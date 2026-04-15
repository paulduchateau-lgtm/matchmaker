export default async function handler(req, res) {
  try {
    const tests = [];

    try { await import("express"); tests.push("express: ok"); } catch(e) { tests.push("express: " + e.message.slice(0, 200)); }
    try { await import("@libsql/client"); tests.push("libsql: ok"); } catch(e) { tests.push("libsql: " + e.message.slice(0, 200)); }
    try { await import("@anthropic-ai/sdk"); tests.push("anthropic: ok"); } catch(e) { tests.push("anthropic: " + e.message.slice(0, 200)); }

    // Test actual DB connection
    try {
      const { createClient } = await import("@libsql/client");
      const db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
      await db.execute("SELECT 1");
      tests.push("db connection: ok");
    } catch(e) {
      tests.push("db connection: " + e.message.slice(0, 300));
    }

    // Test initDB via the server module
    try {
      const serverModule = await import("../server/index.js");
      tests.push("server/index import: ok");
    } catch(e) {
      tests.push("server/index import: " + e.message.slice(0, 300));
    }

    // Test env vars (redacted)
    tests.push("TURSO_DATABASE_URL: " + (process.env.TURSO_DATABASE_URL ? "set (" + process.env.TURSO_DATABASE_URL.slice(0, 30) + "...)" : "NOT SET"));
    tests.push("TURSO_AUTH_TOKEN: " + (process.env.TURSO_AUTH_TOKEN ? "set (length=" + process.env.TURSO_AUTH_TOKEN.length + ")" : "NOT SET"));
    tests.push("ANTHROPIC_API_KEY: " + (process.env.ANTHROPIC_API_KEY ? "set" : "NOT SET"));

    res.json({ node: process.version, tests });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack?.split("\n").slice(0, 5) });
  }
}
