import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  chatDisplayName,
  extractMessageBody,
  MOCK_CHATS,
  asArray,
  canReuseWhatsappSession,
  MOCK_MESSAGES,
  normalizeMessage,
  renderChatMarkdown,
  sanitizeFileStem,
  writeExport,
} from "./lib.mjs";

test("extractMessageBody reads conversation and captioned media", () => {
  assert.deepEqual(extractMessageBody({ conversation: "שלום" }), {
    type: "text",
    text: "שלום",
  });
  assert.deepEqual(
    extractMessageBody({ extendedTextMessage: { text: "קישור https://wify.local" } }),
    { type: "text", text: "קישור https://wify.local" },
  );
  assert.deepEqual(extractMessageBody({ imageMessage: { caption: "הצעה" } }), {
    type: "image",
    text: "הצעה",
  });
  assert.deepEqual(extractMessageBody({ audioMessage: { ptt: true } }), {
    type: "audio",
    text: "",
  });
  assert.deepEqual(
    extractMessageBody({
      ephemeralMessage: { message: { conversation: "חד-פעמי" } },
    }),
    { type: "text", text: "חד-פעמי" },
  );
});

test("normalizeMessage maps baileys-shaped payloads to export rows", () => {
  const row = normalizeMessage({
    key: {
      remoteJid: "972501111111@s.whatsapp.net",
      fromMe: false,
      id: "ABCD",
    },
    messageTimestamp: 1_779_200_000,
    pushName: "דני",
    message: { conversation: "היי" },
  });
  assert.equal(row.id, "ABCD");
  assert.equal(row.chatJid, "972501111111@s.whatsapp.net");
  assert.equal(row.fromMe, false);
  assert.equal(row.sender, "972501111111@s.whatsapp.net");
  assert.equal(row.text, "היי");
  assert.equal(row.type, "text");
  assert.equal(row.timestamp, "2026-05-19T14:13:20.000Z");
});

test("chatDisplayName prefers contact name then notify then jid", () => {
  assert.equal(
    chatDisplayName(
      { id: "972501111111@s.whatsapp.net", name: "דני כהן" },
      {},
    ),
    "דני כהן",
  );
  assert.equal(
    chatDisplayName(
      { id: "972501111111@s.whatsapp.net", notify: "Danny" },
      { "972501111111@s.whatsapp.net": { name: "דני" } },
    ),
    "דני",
  );
  assert.equal(chatDisplayName({ id: "status@broadcast" }, {}), "status@broadcast");
});

test("sanitizeFileStem keeps hebrew and strips path chars", () => {
  assert.equal(sanitizeFileStem("דני / כהן"), "דני _ כהן");
  assert.equal(sanitizeFileStem("..\\secret"), "secret");
  assert.equal(sanitizeFileStem(""), "chat");
});

test("renderChatMarkdown groups by day and labels me vs peer", () => {
  const md = renderChatMarkdown(
    { jid: "972501111111@s.whatsapp.net", name: "דני", isGroup: false },
    [
      {
        id: "1",
        fromMe: false,
        sender: "972501111111@s.whatsapp.net",
        timestamp: "2026-09-18T09:01:00.000Z",
        type: "text",
        text: "היי",
      },
      {
        id: "2",
        fromMe: true,
        sender: "me",
        timestamp: "2026-09-18T09:02:00.000Z",
        type: "image",
        text: "צילום מסך",
      },
    ],
  );
  assert.match(md, /^# דני/m);
  assert.match(md, /jid: 972501111111@s.whatsapp.net/);
  assert.match(md, /## 2026-09-18/);
  assert.match(md, /\*\*09:01\*\* דני: היי/);
  assert.match(md, /\*\*09:02\*\* אני: \[תמונה\] צילום מסך/);
});

test("asArray wraps objects and ignores null", () => {
  assert.deepEqual(asArray(null), []);
  assert.deepEqual(asArray([{ id: 1 }]), [{ id: 1 }]);
  assert.deepEqual(asArray({ id: 1 }), [{ id: 1 }]);
});

test("canReuseWhatsappSession keeps an in-flight QR socket", () => {
  assert.equal(canReuseWhatsappSession("qr", true), true);
  assert.equal(canReuseWhatsappSession("connected", true), true);
  assert.equal(canReuseWhatsappSession("disconnected", true), false);
  assert.equal(canReuseWhatsappSession("qr", false), false);
});

test("writeExport writes manifest json and per-chat markdown without sending", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "wify-wa-"));
  try {
    const result = await writeExport({
      outDir: dir,
      chats: MOCK_CHATS,
      messagesByChat: MOCK_MESSAGES,
      exportedAt: "2026-09-18T21:00:00.000Z",
      mock: true,
    });
    assert.equal(result.chats, MOCK_CHATS.length);
    assert.ok(result.messages > 0);
    assert.equal(result.egress, false);
    const manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
    assert.equal(manifest.kind, "whatsapp-export");
    assert.equal(manifest.mock, true);
    assert.equal(manifest.sent, false);
    const first = MOCK_CHATS[0];
    const jsonPath = path.join(dir, "chats", `${sanitizeFileStem(first.name)}.json`);
    const mdPath = path.join(dir, "chats", `${sanitizeFileStem(first.name)}.md`);
    const json = JSON.parse(await readFile(jsonPath, "utf8"));
    assert.equal(json.jid, first.jid);
    assert.ok(Array.isArray(json.messages));
    const md = await readFile(mdPath, "utf8");
    assert.match(md, new RegExp(`# ${first.name}`));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
