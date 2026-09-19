import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createServer } from "./server.mjs";

async function withServer(fn) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "wify-wa-http-"));
  process.env.WHATSAPP_MOCK = "1";
  process.env.WHATSAPP_DATA_DIR = dataDir;
  const server = createServer({ mock: true, dataDir });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const addr = server.address();
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    return await fn(base, dataDir);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await rm(dataDir, { recursive: true, force: true });
  }
}

test("CORS allowlists the Vite UI origin and does not reflect others", async () => {
  await withServer(async (base) => {
    const allowed = await fetch(`${base}/health`, {
      headers: { Origin: "http://127.0.0.1:5173" },
    });
    assert.equal(allowed.headers.get("access-control-allow-origin"), "http://127.0.0.1:5173");

    const other = await fetch(`${base}/health`, {
      headers: { Origin: "https://evil.example" },
    });
    assert.equal(other.headers.get("access-control-allow-origin"), "http://127.0.0.1:5173");
    assert.notEqual(other.headers.get("access-control-allow-origin"), "https://evil.example");
  });
});

test("GET /health reports mock whatsapp loop on loopback", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.kind, "whatsapp-loop");
    assert.equal(body.mock, true);
    assert.equal(body.send, false);
  });
});

test("GET /local/whatsapp/status is connected in mock with no QR", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/local/whatsapp/status`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.state, "connected");
    assert.equal(body.qr, null);
    assert.equal(body.me?.name, "wify-mock");
  });
});

test("GET /local/whatsapp/chats lists mock conversations", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/local/whatsapp/chats`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.chats.length >= 2);
    assert.equal(body.chats[0].jid.includes("@"), true);
  });
});

test("GET /local/whatsapp/messages returns rows for a chat", async () => {
  await withServer(async (base) => {
    const chats = await (await fetch(`${base}/local/whatsapp/chats`)).json();
    const jid = chats.chats[0].jid;
    const res = await fetch(`${base}/local/whatsapp/messages?jid=${encodeURIComponent(jid)}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.jid, jid);
    assert.ok(body.messages.length >= 1);
    assert.equal(typeof body.messages[0].text, "string");
  });
});

test("POST /local/whatsapp/export writes local files and does not send", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/local/whatsapp/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "both" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.sent, false);
    assert.equal(body.egress, false);
    assert.ok(body.dir);
    assert.ok(body.chats >= 2);
    assert.ok(body.messages >= 1);
  });
});

test("GET /local/egress-destinations is empty - ingest only", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/local/egress-destinations`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, []);
  });
});

test("POST export without a live connection is 409", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "wify-wa-live-"));
  const server = createServer({ mock: false, dataDir });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const addr = server.address();
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    const res = await fetch(`${base}/local/whatsapp/export`, { method: "POST" });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error, "not connected");
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("POST /local/whatsapp/send is 403", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/local/whatsapp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jid: "x", text: "hi" }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /send blocked/i);
  });
});
