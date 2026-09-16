import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "./server.mjs";

async function withServer(fn) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const addr = server.address();
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    return await fn(base);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
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

test("GET /health is ok", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.deepEqual(body.rejection_tags_enum, ["tone_mismatch", "ai_tell"]);
  });
});

test("GET approve-card pass-to-card is pending and has no em dash", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/local/approve-card?case=pass-to-card`);
    assert.equal(res.status, 200);
    const card = await res.json();
    assert.equal(card.status, "pending");
    assert.doesNotMatch(card.body, /[—\u2014]/);
    assert.equal(card.risk, "reversible");
    assert.equal(card.log, undefined);
  });
});

test("GET approve-card reject-ai-tell is rejected with Hebrew reason", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/local/approve-card?case=reject-ai-tell`);
    const card = await res.json();
    assert.equal(res.status, 200);
    assert.equal(card.status, "rejected");
    assert.match(card.reject_reason, /סימן AI בטיוטה/);
  });
});

test("POST approve on pass-to-card returns mock SMTP only", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/local/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case: "pass-to-card" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "approved");
    assert.equal(body.egress.kind, "smtp");
    assert.equal(body.egress.mock, true);
    assert.equal(body.egress.delivered, false);
  });
});

test("POST approve on critic-rejected card is blocked", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/local/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case: "reject-ai-tell" }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, "rejected by critic");
  });
});

test("GET egress-destinations is SMTP after Approve only", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/local/egress-destinations`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.length, 1);
    assert.equal(body[0].kind, "smtp");
    assert.equal(body[0].allowed_after, "approved+reversible+session_approve");
  });
});

test("GET qa/critic-before-user documents case-3 as the expected fail", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/local/qa/critic-before-user`);
    const body = await res.json();
    const bug = body.results.find((r) => r.case === "bug-bad-order");
    const pass = body.results.find((r) => r.case === "pass-to-card");
    assert.equal(bug.pass, false);
    assert.equal(bug.expected_fail, true);
    assert.equal(pass.pass, true);
  });
});

test("POST reject does not send mail", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/local/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case: "pass-to-card" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "rejected");
    assert.equal(body.sent, false);
    assert.equal(body.egress.allowed, false);
  });
});
