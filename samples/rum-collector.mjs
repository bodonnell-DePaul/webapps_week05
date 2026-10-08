// Loopback-only, bounded pilot collector. No cloud account or OTel backend required.
// node rum-collector.mjs --port 8790 --output ./rum-pilot.json
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const port = Number(option("--port", "8790"));
const output = option("--output", null);
const measurements = new Map();
const metrics = ["LCP", "INP", "CLS", "FCP", "TTFB"];
createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const json = (status, value) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(value));
  };
  if (req.method === "GET" && req.url === "/results") {
    const rows = [...measurements.values()];
    const summary = Object.fromEntries(metrics.map((name) => {
      const values = rows.filter((row) => row.name === name).map((row) => row.value).sort((a, b) => a - b);
      return [name, { n: values.length, p75: values.length ? values[Math.ceil(values.length * .75) - 1] : null }];
    }));
    return json(200, { label: "Small convenience pilot; not CrUX or representative field data", rows, summary });
  }
  if (req.method !== "POST" || req.url !== "/api/vitals") return json(404, { error: "Not found" });
  if (req.headers["content-type"]?.split(";")[0] !== "application/json") return json(415, { error: "Expected JSON" });
  let body = "";
  try {
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > 16_384) return json(413, { error: "Too large" });
    }
    const row = JSON.parse(body);
    if (!metrics.includes(row.name) || typeof row.value !== "number" || !Number.isFinite(row.value) ||
      row.value < 0 || typeof row.pageViewId !== "string" || row.pageViewId.length > 100 ||
      typeof row.id !== "string" || row.id.length > 100) return json(400, { error: "Invalid metric" });
    const key = `${row.pageViewId}:${row.id}`;
    if (!measurements.has(key) && measurements.size >= 1000) return json(429, { error: "Pilot capacity reached" });
    // Deliberately omit URL/query, user agent, selectors and hardware fingerprint fields.
    measurements.set(key, { pageViewId: row.pageViewId, id: row.id, name: row.name,
      value: row.value, navigationType: String(row.navigationType ?? "unknown").slice(0, 50) });
    if (output) writeFileSync(resolve(output), JSON.stringify([...measurements.values()], null, 2));
    return json(202, { accepted: true });
  } catch { return json(400, { error: "Invalid JSON or unwritable output path" }); }
}).listen(port, "127.0.0.1", () => console.log(`RUM collector: http://127.0.0.1:${port}/results`));
