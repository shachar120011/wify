import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chatDisplayName, normalizeMessage } from "./lib.mjs";

function tsToIso(value) {
  const n = Number(value || 0);
  if (!n) return null;
  const ms = n > 1e12 ? n : n * 1000;
  return new Date(ms).toISOString();
}

function fromBaileysChat(chat, contacts) {
  const jid = chat.id || chat.jid;
  return {
    jid,
    name: chatDisplayName({ ...chat, id: jid, jid }, contacts),
    isGroup: String(jid).endsWith("@g.us"),
    lastTimestamp: tsToIso(chat.conversationTimestamp),
  };
}

export function createLiveSession({ dataDir, store, onChange }) {
  const authDir = path.join(dataDir, "auth");
  const storeDir = path.join(dataDir, "store");
  let sock = null;
  let starting = null;
  const snapshot = {
    state: "disconnected",
    qr: null,
    pairingCode: null,
    me: null,
    error: null,
    lastDisconnect: null,
  };

  function emit() {
    onChange?.(getStatus());
  }

  function getStatus() {
    return {
      state: snapshot.state,
      qr: snapshot.qr,
      pairingCode: snapshot.pairingCode,
      me: snapshot.me,
      error: snapshot.error,
      lastDisconnect: snapshot.lastDisconnect,
      mock: false,
      send: false,
    };
  }

  async function persist() {
    try {
      await store.save(storeDir);
    } catch {
      // store persist is best-effort; export still works from memory
    }
  }

  function ingestHistory({ chats = [], contacts = [], messages = [] }) {
    for (const contact of contacts) store.upsertContact(contact);
    const contactMap = store.contactsObject();
    for (const chat of chats) store.upsertChat(fromBaileysChat(chat, contactMap));
    for (const msg of messages) {
      const row = normalizeMessage(msg);
      if (row.pushName && row.sender) {
        store.upsertContact({ id: row.sender, notify: row.pushName, name: row.pushName });
      }
      store.upsertMessage(row);
    }
    void persist();
    emit();
  }

  async function start() {
    if (starting) return starting;
    starting = connect().finally(() => {
      starting = null;
    });
    return starting;
  }

  async function connect() {
    await mkdir(authDir, { recursive: true });
    await store.load(storeDir);
    const baileys = await import("@whiskeysockets/baileys");
    const makeWASocket =
      baileys.default?.default || baileys.default || baileys.makeWASocket;
    const { useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } =
      baileys;
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    let version;
    try {
      const latest = await fetchLatestBaileysVersion();
      version = latest.version;
    } catch {
      version = undefined;
    }
    snapshot.state = "connecting";
    snapshot.error = null;
    emit();

    let logger;
    try {
      const pino = (await import("pino")).default;
      logger = pino({ level: "silent" });
    } catch {
      logger = undefined;
    }

    sock = makeWASocket({
      version,
      auth: state,
      browser: Browsers.macOS("Desktop"),
      syncFullHistory: true,
      logger,
    });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("messaging-history.set", (payload) => ingestHistory(payload || {}));
    sock.ev.on("chats.upsert", (chats) => ingestHistory({ chats }));
    sock.ev.on("chats.update", (chats) => ingestHistory({ chats }));
    sock.ev.on("contacts.upsert", (contacts) => ingestHistory({ contacts }));
    sock.ev.on("contacts.update", (contacts) => ingestHistory({ contacts }));
    sock.ev.on("messages.upsert", ({ messages }) => ingestHistory({ messages }));

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        try {
          const qrcode = (await import("qrcode")).default;
          snapshot.qr = await qrcode.toDataURL(qr, { width: 280, margin: 1 });
        } catch {
          snapshot.qr = qr;
        }
        snapshot.state = "qr";
        snapshot.pairingCode = null;
        emit();
      }
      if (connection === "connecting") {
        snapshot.state = snapshot.qr ? "qr" : "connecting";
        emit();
      }
      if (connection === "open") {
        snapshot.state = "connected";
        snapshot.qr = null;
        snapshot.pairingCode = null;
        snapshot.error = null;
        const me = sock.user || {};
        snapshot.me = { id: me.id, name: me.name || me.verifiedName || "me" };
        emit();
        void persist();
      }
      if (connection === "close") {
        const err = lastDisconnect?.error;
        const statusCode = err?.output?.statusCode;
        snapshot.lastDisconnect = statusCode || err?.message || "closed";
        snapshot.qr = null;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        if (loggedOut) {
          snapshot.state = "logged_out";
          snapshot.me = null;
          emit();
          return;
        }
        snapshot.state = "connecting";
        snapshot.error = String(err?.message || "reconnect");
        emit();
        setTimeout(() => {
          void connect().catch((reconnectErr) => {
            snapshot.state = "error";
            snapshot.error = String(reconnectErr?.message || reconnectErr);
            emit();
          });
        }, 2000);
      }
    });

    return getStatus();
  }

  async function requestPairingCode(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) throw new Error("phone required");
    if (!sock) await start();
    if (!sock?.requestPairingCode) throw new Error("pairing unavailable");
    const code = await sock.requestPairingCode(digits);
    snapshot.pairingCode = code;
    snapshot.state = snapshot.state === "connected" ? "connected" : "qr";
    emit();
    return code;
  }

  async function logout() {
    try {
      if (sock?.logout) await sock.logout();
    } catch {
      // ignore
    }
    sock = null;
    snapshot.state = "logged_out";
    snapshot.qr = null;
    snapshot.pairingCode = null;
    snapshot.me = null;
    emit();
  }

  return {
    start,
    logout,
    requestPairingCode,
    getStatus,
  };
}
