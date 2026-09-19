import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { MOCK_CHATS, MOCK_MESSAGES, isExportableJid } from "./lib.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createStore({ mock = false } = {}) {
  const chats = new Map();
  const contacts = new Map();
  const messages = new Map();

  function seedMock() {
    for (const chat of MOCK_CHATS) chats.set(chat.jid, clone(chat));
    for (const [jid, rows] of Object.entries(MOCK_MESSAGES)) {
      messages.set(jid, clone(rows));
    }
  }

  if (mock) seedMock();

  function upsertChat(chat) {
    if (!chat?.jid) return;
    const prev = chats.get(chat.jid) || {};
    chats.set(chat.jid, { ...prev, ...chat });
  }

  function upsertContact(contact) {
    const id = contact?.id || contact?.jid;
    if (!id) return;
    const prev = contacts.get(id) || {};
    contacts.set(id, { ...prev, ...contact, id });
  }

  function upsertMessage(row) {
    if (!row?.chatJid) return;
    const list = messages.get(row.chatJid) || [];
    const idx = list.findIndex((item) => item.id && item.id === row.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...row };
    else list.push(row);
    list.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    messages.set(row.chatJid, list);
    const chat = chats.get(row.chatJid) || { jid: row.chatJid };
    const last = list[list.length - 1];
    upsertChat({
      ...chat,
      jid: row.chatJid,
      lastTimestamp: last?.timestamp || chat.lastTimestamp || null,
    });
  }

  return {
    upsertChat,
    upsertContact,
    upsertMessage,
    contact(id) {
      return contacts.get(id) || null;
    },
    contactsObject() {
      return Object.fromEntries(contacts);
    },
    listChats() {
      return [...chats.values()]
        .filter((c) => isExportableJid(c.jid))
        .sort((a, b) => String(b.lastTimestamp || "").localeCompare(String(a.lastTimestamp || "")));
    },
    listMessages(jid) {
      return [...(messages.get(jid) || [])];
    },
    messagesByChat() {
      const out = {};
      for (const [jid, rows] of messages) out[jid] = [...rows];
      return out;
    },
    stats() {
      let count = 0;
      for (const rows of messages.values()) count += rows.length;
      return { chats: this.listChats().length, messages: count };
    },
    async save(dir) {
      if (!dir) return;
      await mkdir(dir, { recursive: true });
      const payload = {
        chats: [...chats.values()],
        contacts: [...contacts.values()],
        messages: Object.fromEntries(messages),
      };
      await writeFile(path.join(dir, "store.json"), `${JSON.stringify(payload)}\n`, "utf8");
    },
    async load(dir) {
      if (!dir) return false;
      try {
        const raw = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8"));
        chats.clear();
        contacts.clear();
        messages.clear();
        for (const chat of raw.chats || []) upsertChat(chat);
        for (const contact of raw.contacts || []) upsertContact(contact);
        for (const [jid, rows] of Object.entries(raw.messages || {})) {
          messages.set(jid, rows);
        }
        return true;
      } catch {
        return false;
      }
    },
  };
}
