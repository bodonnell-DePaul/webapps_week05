// Stands in for PostgreSQL. Every query is deliberately slow and counted, so the effect
// of the cache is visible as "queries avoided", not just as a faster number.

const services = ["printing", "wifi", "shuttle"];
const pause = (ms) => new Promise((done) => setTimeout(done, ms));

export function createDb({ latencyMs = 300 } = {}) {
  let queries = 0;
  let nextId = 2;
  const incidents = [
    { id: "1", title: "Synthetic printing delay", service: "printing", status: "investigating" },
  ];
  return {
    get queries() {
      return queries;
    },
    async status() {
      queries += 1;
      await pause(latencyMs);
      return {
        services: services.map((id) => ({
          id,
          state: incidents.some((i) => i.service === id && i.status !== "resolved")
            ? "degraded" : "operational",
        })),
      };
    },
    async openIncidents() {
      queries += 1;
      await pause(latencyMs);
      return incidents.filter((i) => i.status !== "resolved");
    },
    async createIncident({ title, service }) {
      queries += 1;
      await pause(latencyMs);
      const incident = { id: String(nextId++), title, service, status: "investigating" };
      incidents.push(incident);
      return incident;
    },
  };
}
