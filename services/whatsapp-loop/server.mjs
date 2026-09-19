import http from "node:http";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MOCK_ME, writeExport } from "./lib.mjs";
import { createStore } from "./store.mjs";
import { createLiveSession } from "./session.mjs";

export const PORT = Number(process.env.WHATSAPP_LOOP_PORT || 8789);
/** Local ingest only. */
export const HOST = "127.0.0.1";

const UI_ORIGINS = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);
const MAX_BODY_BYTES = 1_000_000;

function corsHeaders(req) {
  const origin = req.headers.origin;
  const allow = typeof origin === "string" && UI_ORIGINS.has(origin) ? origin : "http://127.0.0.1:5173";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error("body too large"));
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function parseJson(raw) {
  if (!raw) return {};
  return JSON.parse(raw);
}

function dataDirFromEnv() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return process.env.WHATSAPP_DATA_DIR || path.join(here, "..", "..", "data", "whatsapp");
}

function isMock() {
  return process.env.WHATSAPP_MOCK === "1";
}

export function createServer(opts = {}) {
  const mock = opts.mock ?? isMock();
  const dataDir = opts.dataDir ?? dataDirFromEnv();
  const store = createStore({ mock });
  const live = mock
    ? null
    : createLiveSession({
        dataDir,
        store,
        onChange: () => {},
      });
  let lastExport = null;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    const cors = corsHeaders(req);

    const json = (code, data) => {
      const body = JSON.stringify(data, null, 2);
      res.writeHead(code, {
        "Content-Type": "application/json; charset=utf-8",
        ...cors,
      });
      res.end(body);
    };

    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }

    if (url.pathname === "/health") {
      return json(200, {
        ok: true,
        kind: "whatsapp-loop",
        mock,
        send: false,
      });
    }

    if (url.pathname === "/local/egress-destinations") {
      return json(200, []);
    }

    if (url.pathname === "/local/whatsapp/status") {
      if (mock) {
        return json(200, {
          state: "connected",
          qr: null,
          pairingCode: null,
          me: MOCK_ME,
          error: null,
          mock: true,
          send: false,
          ...store.stats(),
        });
      }
      return json(200, { ...live.getStatus(), ...store.stats() });
    }

    if (url.pathname === "/local/whatsapp/chats") {
      return json(200, { chats: store.listChats(), mock });
    }

    if (url.pathname === "/local/whatsapp/messages") {
      const jid = url.searchParams.get("jid");
      if (!jid) return json(400, { error: "jid required" });
      return json(200, { jid, messages: store.listMessages(jid), mock });
    }

    if (url.pathname === "/local/whatsapp/connect" && req.method === "POST") {
      if (mock) {
        return json(200, { ok: true, mock: true, state: "connected" });
      }
      try {
        const status = await live.start();
        return json(200, { ok: true, ...status });
      } catch (err) {
        return json(500, { error: String(err?.message || err) });
      }
    }

    if (url.pathname === "/local/whatsapp/pairing-code" && req.method === "POST") {
      if (mock) return json(400, { error: "mock has no pairing" });
      let body = {};
      try {
        body = parseJson(await readBody(req));
      } catch {
        return json(400, { error: "invalid json" });
      }
      try {
        const code = await live.requestPairingCode(body.phone);
        return json(200, { ok: true, pairingCode: code });
      } catch (err) {
        return json(400, { error: String(err?.message || err) });
      }
    }

    if (url.pathname === "/local/whatsapp/logout" && req.method === "POST") {
      if (mock) return json(200, { ok: true, mock: true, state: "connected" });
      await live.logout();
      return json(200, { ok: true, ...live.getStatus() });
    }

    if (url.pathname === "/local/whatsapp/export" && req.method === "POST") {
      if (!mock) {
        const st = live.getStatus();
        if (st.state !== "connected") {
          return json(409, { error: "not connected", state: st.state });
        }
        if (store.stats().chats === 0) {
          await live.waitForSync(20_000);
        }
        if (store.stats().chats === 0) {
          return json(409, {
            error: "no chats synced yet",
            state: st.state,
            hint: "wait for WhatsApp history, then export again",
          });
        }
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const outDir = path.join(dataDir, "export", stamp);
      await mkdir(outDir, { recursive: true });
      const result = await writeExport({
        outDir,
        chats: store.listChats(),
        messagesByChat: store.messagesByChat(),
        exportedAt: new Date().toISOString(),
        mock,
      });
      lastExport = result;
      return json(200, result);
    }

    if (url.pathname === "/local/whatsapp/export/latest") {
      if (!lastExport) return json(404, { error: "no export yet" });
      return json(200, lastExport);
    }

    if (url.pathname === "/local/whatsapp/send" && req.method === "POST") {
      return json(403, { error: "send blocked" });
    }

    return json(404, {
      error: "not found",
      routes: [
        "GET /health",
        "GET /local/whatsapp/status",
        "GET /local/whatsapp/chats",
        "GET /local/whatsapp/messages?jid=",
        "POST /local/whatsapp/connect",
        "POST /local/whatsapp/pairing-code",
        "POST /local/whatsapp/logout",
        "POST /local/whatsapp/export",
        "GET /local/egress-destinations",
      ],
    });
  });

  server.wifyStart = () => (live ? live.start() : Promise.resolve({ mock: true, state: "connected" }));
  return server;
}

export function listen(port = PORT, host = HOST) {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const boundPort = typeof addr === "object" && addr ? addr.port : port;
      const mock = isMock();
      console.log(
        `whatsapp-loop on http://${host}:${boundPort} (${mock ? "mock" : "live"}, send blocked)`,
      );
      if (!mock) {
        server.wifyStart().catch((err) => {
          console.error("whatsapp connect failed", err);
        });
      }
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
