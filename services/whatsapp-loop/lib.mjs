import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const MOCK_ME = { id: "972500000000@s.whatsapp.net", name: "wify-mock" };

export const MOCK_CHATS = [
  {
    jid: "972501111111@s.whatsapp.net",
    name: "דני",
    isGroup: false,
    lastTimestamp: "2026-09-18T09:02:00.000Z",
  },
  {
    jid: "1203630-group@g.us",
    name: "צוות wify",
    isGroup: true,
    lastTimestamp: "2026-09-17T18:00:00.000Z",
  },
];

export const MOCK_MESSAGES = {
  "972501111111@s.whatsapp.net": [
    {
      id: "m1",
      chatJid: "972501111111@s.whatsapp.net",
      fromMe: false,
      sender: "972501111111@s.whatsapp.net",
      timestamp: "2026-09-18T09:01:00.000Z",
      type: "text",
      text: "היי, יש עדכון?",
    },
    {
      id: "m2",
      chatJid: "972501111111@s.whatsapp.net",
      fromMe: true,
      sender: "me",
      timestamp: "2026-09-18T09:02:00.000Z",
      type: "text",
      text: "כן. נדבר אחרי הצהריים.",
    },
  ],
  "1203630-group@g.us": [
    {
      id: "g1",
      chatJid: "1203630-group@g.us",
      fromMe: false,
      sender: "972502222222@s.whatsapp.net",
      timestamp: "2026-09-17T17:59:00.000Z",
      type: "text",
      text: "מי סוגר את הספרינט?",
    },
    {
      id: "g2",
      chatJid: "1203630-group@g.us",
      fromMe: true,
      sender: "me",
      timestamp: "2026-09-17T18:00:00.000Z",
      type: "text",
      text: "אני מייצא את הוואטסאפ קודם.",
    },
  ],
};

const MEDIA_LABEL = {
  image: "תמונה",
  video: "וידאו",
  audio: "אודיו",
  sticker: "סטיקר",
  document: "קובץ",
  contact: "איש קשר",
  location: "מיקום",
};

export function extractMessageBody(message) {
  if (!message) return { type: "empty", text: "" };
  const m = message.message || message;
  if (typeof m === "string") return { type: "text", text: m };
  if (m.conversation) return { type: "text", text: m.conversation };
  if (m.extendedTextMessage?.text) {
    return { type: "text", text: m.extendedTextMessage.text };
  }
  if (m.imageMessage) {
    return { type: "image", text: m.imageMessage.caption || "" };
  }
  if (m.videoMessage) {
    return { type: "video", text: m.videoMessage.caption || "" };
  }
  if (m.audioMessage) return { type: "audio", text: "" };
  if (m.documentMessage) {
    return {
      type: "document",
      text: m.documentMessage.fileName || m.documentMessage.caption || "",
    };
  }
  if (m.stickerMessage) return { type: "sticker", text: "" };
  if (m.contactMessage) {
    return { type: "contact", text: m.contactMessage.displayName || "" };
  }
  if (m.locationMessage) {
    return { type: "location", text: m.locationMessage.name || "" };
  }
  if (m.buttonsMessage?.contentText) {
    return { type: "buttons", text: m.buttonsMessage.contentText };
  }
  if (m.templateButtonReplyMessage?.selectedDisplayText) {
    return {
      type: "button_reply",
      text: m.templateButtonReplyMessage.selectedDisplayText,
    };
  }
  if (m.reactionMessage) {
    return { type: "reaction", text: m.reactionMessage.text || "" };
  }
  if (m.protocolMessage) return { type: "protocol", text: "" };
  if (m.ephemeralMessage?.message) {
    return extractMessageBody({ message: m.ephemeralMessage.message });
  }
  if (m.viewOnceMessage?.message) {
    return extractMessageBody({ message: m.viewOnceMessage.message });
  }
  if (m.viewOnceMessageV2?.message) {
    return extractMessageBody({ message: m.viewOnceMessageV2.message });
  }
  if (m.editedMessage?.message) {
    return extractMessageBody({ message: m.editedMessage.message });
  }
  return { type: "other", text: "" };
}

export function normalizeMessage(raw) {
  const key = raw?.key || {};
  const jid = key.remoteJid || raw.chatJid || "";
  const ts = Number(raw.messageTimestamp || 0);
  const body = extractMessageBody(raw.message ? raw : { message: raw.message });
  const nested = raw.message ? extractMessageBody(raw.message) : extractMessageBody(raw);
  const used = raw.message ? nested : body;
  return {
    id: key.id || raw.id || "",
    chatJid: jid,
    fromMe: Boolean(key.fromMe ?? raw.fromMe),
    sender: key.participant || (key.fromMe ? "me" : jid),
    timestamp: ts ? new Date(ts * 1000).toISOString() : raw.timestamp || null,
    type: used.type,
    text: used.text,
    pushName: raw.pushName || null,
  };
}

export function chatDisplayName(chat, contacts = {}) {
  const id = chat.id || chat.jid || "";
  const contact = contacts[id] || {};
  return chat.name || contact.name || chat.notify || contact.notify || id || "chat";
}

export function sanitizeFileStem(name) {
  const parts = String(name || "")
    .split(/[\\/]+/)
    .filter((part) => part && part !== "." && part !== "..");
  const cleaned = parts
    .join(" _ ")
    .replace(/[<>:"|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "chat";
}

export function isExportableJid(jid) {
  if (!jid) return false;
  if (jid === "status@broadcast") return false;
  if (jid.endsWith("@newsletter")) return false;
  return true;
}

export function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function canReuseWhatsappSession(state, hasSock) {
  return Boolean(hasSock) && ["qr", "connecting", "connected"].includes(state);
}

function mediaPrefix(type) {
  const label = MEDIA_LABEL[type];
  return label ? `[${label}]` : "";
}

function hhmmUtc(iso) {
  if (!iso) return "--:--";
  return new Date(iso).toISOString().slice(11, 16);
}

function dayUtc(iso) {
  if (!iso) return "unknown";
  return new Date(iso).toISOString().slice(0, 10);
}

function speakerName(row, chat) {
  if (row.fromMe) return "אני";
  if (!chat.isGroup) return chat.name || "שיחה";
  return row.pushName || row.sender || "משתתף";
}

function lineText(row) {
  const prefix = mediaPrefix(row.type);
  const text = (row.text || "").trim();
  if (prefix && text) return `${prefix} ${text}`;
  if (prefix) return prefix;
  return text;
}

export function renderChatMarkdown(chat, messages) {
  const lines = [
    `# ${chat.name || chat.jid}`,
    `jid: ${chat.jid}`,
    `messages: ${messages.length}`,
    "",
  ];
  let currentDay = null;
  for (const row of messages) {
    const day = dayUtc(row.timestamp);
    if (day !== currentDay) {
      currentDay = day;
      lines.push(`## ${day}`);
    }
    lines.push(`**${hhmmUtc(row.timestamp)}** ${speakerName(row, chat)}: ${lineText(row)}`);
  }
  return `${lines.join("\n")}\n`;
}

export function exportStamp(exportedAt) {
  return String(exportedAt || new Date().toISOString()).replace(/[:.]/g, "-");
}

export async function writeExport({
  outDir,
  chats,
  messagesByChat,
  exportedAt,
  mock = false,
}) {
  const at = exportedAt || new Date().toISOString();
  const exportable = chats.filter((c) => isExportableJid(c.jid));
  await mkdir(path.join(outDir, "chats"), { recursive: true });
  const files = ["manifest.json"];
  let messageCount = 0;
  const usedStems = new Map();

  for (const chat of exportable) {
    const rows = messagesByChat[chat.jid] || [];
    messageCount += rows.length;
    let stem = sanitizeFileStem(chat.name || chat.jid);
    const seen = usedStems.get(stem) || 0;
    usedStems.set(stem, seen + 1);
    if (seen > 0) stem = `${stem}-${seen + 1}`;
    const jsonName = `${stem}.json`;
    const mdName = `${stem}.md`;
    const payload = {
      jid: chat.jid,
      name: chat.name,
      isGroup: Boolean(chat.isGroup),
      exportedAt: at,
      messages: rows,
    };
    await writeFile(
      path.join(outDir, "chats", jsonName),
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      path.join(outDir, "chats", mdName),
      renderChatMarkdown(chat, rows),
      "utf8",
    );
    files.push(`chats/${jsonName}`, `chats/${mdName}`);
  }

  const manifest = {
    kind: "whatsapp-export",
    exportedAt: at,
    chats: exportable.length,
    messages: messageCount,
    mock: Boolean(mock),
    sent: false,
    egress: false,
    files,
  };
  await writeFile(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return {
    ok: true,
    dir: outDir,
    chats: exportable.length,
    messages: messageCount,
    files,
    sent: false,
    egress: false,
    mock: Boolean(mock),
    exportedAt: at,
  };
}
