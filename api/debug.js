export default async function handler(req, res) {
  try {
    const tests = [];

    // Test actual DB connection with https:// transport
    try {
      const { createClient } = await import("@libsql/client");
      let url = process.env.TURSO_DATABASE_URL;
      if (url?.startsWith("libsql://")) {
        url = url.replace("libsql://", "https://");
      }
      tests.push("db url used: " + url?.slice(0, 40) + "...");
      const db = createClient({
        url,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
      const result = await db.execute("SELECT 1 as test");
      tests.push("db connection: ok, result=" + JSON.stringify(result.rows[0]));
    } catch(e) {
      tests.push("db connection: " + e.message.slice(0, 400));
    }

    // Test the Express app health route directly
    try {
      const serverModule = await import("../server/index.js");
      tests.push("server/index import: ok (type=" + typeof serverModule.default + ")");
    } catch(e) {
      tests.push("server/index import: " + e.message.slice(0, 300));
    }

    // Env vars
    tests.push("TURSO_DATABASE_URL: " + (process.env.TURSO_DATABASE_URL ? "set (" + process.env.TURSO_DATABASE_URL.slice(0, 30) + "...)" : "NOT SET"));
    tests.push("TURSO_AUTH_TOKEN: " + (process.env.TURSO_AUTH_TOKEN ? "set (len=" + process.env.TURSO_AUTH_TOKEN.length + ")" : "NOT SET"));
    tests.push("VERCEL: " + (process.env.VERCEL || "NOT SET"));

    res.json({ node: process.version, tests });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack?.split("\n").slice(0, 5) });
  }
}
