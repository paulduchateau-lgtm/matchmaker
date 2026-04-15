export default async function handler(req, res) {
  try {
    const tests = [];

    // Test 1: @libsql/client with https
    try {
      const { createClient } = await import("@libsql/client");
      let url = process.env.TURSO_DATABASE_URL?.replace("libsql://", "https://");
      tests.push("test1 url: " + url?.slice(0, 50));
      const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
      const r = await db.execute("SELECT 1 as v");
      tests.push("test1 (@libsql/client + https): ok " + JSON.stringify(r.rows[0]));
    } catch(e) {
      tests.push("test1 (@libsql/client + https): " + e.message.slice(0, 300));
    }

    // Test 2: @libsql/client/web
    try {
      const { createClient } = await import("@libsql/client/web");
      let url = process.env.TURSO_DATABASE_URL?.replace("libsql://", "https://");
      const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
      const r = await db.execute("SELECT 1 as v");
      tests.push("test2 (@libsql/client/web + https): ok " + JSON.stringify(r.rows[0]));
    } catch(e) {
      tests.push("test2 (@libsql/client/web + https): " + e.message.slice(0, 300));
    }

    // Test 3: @libsql/client with original libsql:// url
    try {
      const { createClient } = await import("@libsql/client");
      const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
      const r = await db.execute("SELECT 1 as v");
      tests.push("test3 (@libsql/client + libsql://): ok " + JSON.stringify(r.rows[0]));
    } catch(e) {
      tests.push("test3 (@libsql/client + libsql://): " + e.message.slice(0, 300));
    }

    tests.push("VERCEL: " + process.env.VERCEL);

    res.json({ node: process.version, tests });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack?.split("\n").slice(0, 5) });
  }
}
