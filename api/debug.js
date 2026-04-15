export default async function handler(req, res) {
  try {
    const tests = [];
    const rawUrl = process.env.TURSO_DATABASE_URL;
    const rawToken = process.env.TURSO_AUTH_TOKEN;

    tests.push("raw url length: " + rawUrl?.length);
    tests.push("raw url: [" + rawUrl + "]");
    tests.push("raw url charCodes (first 20): " + [...(rawUrl || "")].slice(0, 20).map(c => c.charCodeAt(0)).join(","));
    tests.push("raw token length: " + rawToken?.length);

    // Test with hardcoded URL to isolate the issue
    try {
      const { createClient } = await import("@libsql/client");
      const db = createClient({
        url: "libsql://matchmaker-paulduchateau.aws-eu-west-1.turso.io",
        authToken: rawToken,
      });
      const r = await db.execute("SELECT 1 as v");
      tests.push("hardcoded libsql:// test: ok " + JSON.stringify(r.rows[0]));
    } catch(e) {
      tests.push("hardcoded libsql:// test: " + e.message.slice(0, 300));
    }

    // Test with hardcoded https URL
    try {
      const { createClient } = await import("@libsql/client");
      const db = createClient({
        url: "https://matchmaker-paulduchateau.aws-eu-west-1.turso.io",
        authToken: rawToken,
      });
      const r = await db.execute("SELECT 1 as v");
      tests.push("hardcoded https:// test: ok " + JSON.stringify(r.rows[0]));
    } catch(e) {
      tests.push("hardcoded https:// test: " + e.message.slice(0, 300));
    }

    res.json({ node: process.version, tests });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack?.split("\n").slice(0, 5) });
  }
}
