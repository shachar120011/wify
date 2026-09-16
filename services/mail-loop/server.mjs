import http from "node:http";
import { fileURLToPath } from "node:url";
import {
  REJECTION_TAGS,
  egress,
  enforceRiskStatus,
  findAiTells,
  materialize,
  qaCriticBeforeUser,
  seeds,
} from "./lib.mjs";

export const PORT = Number(process.env.MAIL_LOOP_PORT || 8787);
export const HOST = process.env.MAIL_LOOP_HOST || "127.0.0.1";

function json(res, code, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      return res.end();
    }

    if (url.pathname === "/health") {
      return json(res, 200, { ok: true, rejection_tags_enum: REJECTION_TAGS });
    }

    if (url.pathname === "/local/egress-destinations") {
      return json(res, 200, egress);
    }

    if (url.pathname === "/local/cases") {
      return json(res, 200, Object.keys(seeds));
    }

    if (url.pathname === "/local/approve-card") {
      const key = url.searchParams.get("case") || "pass-to-card";
      const item = materialize(key);
      if (!item) return json(res, 404, { error: "unknown case" });
      const check = enforceRiskStatus(item);
      if (!check.ok) return json(res, check.code, { error: check.err });
      // If Critic rejected — do not expose card as pending to UI.
      // Still return payload so UI can show reject_reason when status=rejected.
      const { log, ...card } = item;
      return json(res, 200, card);
    }

    if (url.pathname === "/local/rejection-log") {
      const key = url.searchParams.get("case");
      if (key) {
        const item = materialize(key);
        if (!item) return json(res, 404, { error: "unknown case" });
        return json(res, 200, { id: item.id, status: item.status, ...item.log });
      }
      return json(
        res,
        200,
        Object.keys(seeds).map((name) => {
          const c = materialize(name);
          return { id: c.id, case: name, status: c.status, ...c.log };
        })
      );
    }

    if (url.pathname === "/local/qa/critic-before-user") {
      return json(res, 200, qaCriticBeforeUser());
    }

    if (url.pathname === "/local/approve" && req.method === "POST") {
      const raw = await readBody(req);
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return json(res, 400, { error: "invalid json" });
      }
      const key = body.case || "pass-to-card";
      const item = materialize(key);
      if (!item) return json(res, 404, { error: "unknown case" });
      if (item.risk !== "reversible") return json(res, 403, { error: "irreversible blocked" });
      if (item.status === "rejected") return json(res, 403, { error: "rejected by critic" });
      if (findAiTells(item.body).length) {
        return json(res, 403, { error: "ai_tell blocked at send", tags: ["ai_tell"] });
      }
      // Mock only — no real SMTP. Egress is allowed in the payload after Approve.
      return json(res, 200, {
        status: "approved",
        risk: "reversible",
        egress: { kind: "smtp", allowed: true, delivered: false, mock: true },
        sent: { to: item.to, subject: item.subject, body: item.body },
      });
    }

    if (url.pathname === "/local/reject" && req.method === "POST") {
      const raw = await readBody(req);
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return json(res, 400, { error: "invalid json" });
      }
      const key = body.case || "pass-to-card";
      const item = materialize(key);
      if (!item) return json(res, 404, { error: "unknown case" });
      return json(res, 200, {
        status: "rejected",
        risk: item.risk,
        sent: false,
        egress: { kind: "smtp", allowed: false, mock: true },
      });
    }

    return json(res, 404, {
      error: "not found",
      routes: [
        "GET /health",
        "GET /local/approve-card?case=pass-to-card|reject-before-ui|bug-bad-order|reject-ai-tell",
        "GET /local/rejection-log",
        "GET /local/qa/critic-before-user",
        "GET /local/egress-destinations",
        "POST /local/approve",
        "POST /local/reject",
      ],
    });
  });
}

export function listen(port = PORT, host = HOST) {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const boundPort = typeof addr === "object" && addr ? addr.port : port;
      console.log(`sprint1 mock on http://${host}:${boundPort} (ai_tell guard on)`);
      resolve(server);
    });
  });
}

const isMain =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  listen().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
