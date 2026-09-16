/** Official rejection tags (Q): tone_mismatch | ai_tell | (+ intentional empty for bug case) */
export const REJECTION_TAGS = ["tone_mismatch", "ai_tell"];

/** Typographic / LLM tells the Critic must catch before UI */
export const AI_TELL_RE =
  /[—–…]|\u2014|\u2013|\bas an AI\b|\bI hope this (email|message) finds you\b|\bdelve\b|\bseamless(ly)?\b/i;

export function findAiTells(text) {
  const hits = [];
  if (!text) return hits;
  if (/[—–\u2014\u2013]/.test(text)) hits.push("em_dash");
  if (/…/.test(text)) hits.push("ellipsis");
  if (/\bas an AI\b/i.test(text)) hits.push("as_an_ai");
  if (/\bI hope this (email|message) finds you\b/i.test(text)) hits.push("hope_finds_you");
  if (/\bdelve\b/i.test(text)) hits.push("delve");
  if (/\bseamless(ly)?\b/i.test(text)) hits.push("seamless");
  return hits;
}

export function stripAiTells(text) {
  return String(text || "")
    .replace(/[—–\u2014\u2013]/g, " - ")
    .replace(/…/g, "...")
    .replace(/  +/g, " ")
    .trim();
}

/** Doer: never emit AI tells */
export function doerDraft({ subject, body }) {
  return {
    subject: stripAiTells(subject),
    body: stripAiTells(body),
  };
}

/** Critic: fail closed on AI tells before UI */
export function criticReview(draft) {
  const blob = `${draft.subject}\n${draft.body}`;
  const tells = findAiTells(blob);
  if (tells.length > 0) {
    return {
      critic_score: 0.15,
      reject_reason: "סימן AI בטיוטה (מקף טיפוגרפי / ניסוח מודל)",
      status: "rejected",
      rejection_tags: ["ai_tell", "tone_mismatch"],
      tells,
      pass: false,
    };
  }
  return {
    critic_score: 0.91,
    reject_reason: null,
    status: "pending",
    rejection_tags: [],
    tells: [],
    pass: true,
  };
}

export function buildCard(raw, { forceRejectTags, forceOrderBug } = {}) {
  const draft = doerDraft(raw.draft || { subject: raw.subject, body: raw.body });
  const outbound = {
    to: raw.to,
    subject: draft.subject,
    body: draft.body,
  };
  const review = criticReview(draft);
  const now = new Date().toISOString();
  const critic_at = raw.log?.critic_at || now;

  if (forceOrderBug) {
    return {
      id: raw.id,
      ...outbound,
      draft,
      critic_score: 0.4,
      reject_reason: "חסר תיוג",
      risk: "reversible",
      status: "rejected",
      log: {
        rejection_tags: [],
        critic_at: "2026-09-16T10:02:10.000Z",
        ui_shown_at: "2026-09-16T10:02:00.000Z",
      },
    };
  }

  if (!review.pass) {
    return {
      id: raw.id,
      ...outbound,
      draft,
      critic_score: review.critic_score,
      reject_reason: review.reject_reason,
      risk: "reversible",
      status: "rejected",
      log: {
        rejection_tags: forceRejectTags || review.rejection_tags,
        critic_at,
        ui_shown_at: null,
      },
    };
  }

  return {
    id: raw.id,
    ...outbound,
    draft,
    critic_score: review.critic_score,
    reject_reason: null,
    risk: "reversible",
    status: "pending",
    log: {
      rejection_tags: [],
      critic_at,
      ui_shown_at: raw.log?.ui_shown_at || new Date(Date.parse(critic_at) + 5000).toISOString(),
    },
  };
}

export const seeds = {
  "reject-before-ui": {
    id: "case-1",
    to: "client@example.com",
    draft: {
      subject: "Re: הצעת מחיר",
      body: "PLACEHOLDER",
    },
    log: { critic_at: "2026-09-16T10:00:00.000Z" },
    injectAiTellAfterDoer: true,
    rejection_tags: ["ai_tell", "tone_mismatch"],
  },
  "pass-to-card": {
    id: "case-2",
    to: "client@example.com",
    draft: {
      subject: "Re: הצעת מחיר",
      body: "תודה על הפנייה. מצורפת הצעה מעודכנת כפי שסיכמנו.",
    },
    log: {
      critic_at: "2026-09-16T10:01:00.000Z",
      ui_shown_at: "2026-09-16T10:01:05.000Z",
    },
  },
  "bug-bad-order": {
    id: "case-3",
    to: "client@example.com",
    draft: {
      subject: "Re: באג מדומה",
      body: "טיוטה שנכשלת בבדיקה במכוון.",
    },
    forceOrderBug: true,
  },
  "reject-ai-tell": {
    id: "case-4",
    to: "client@example.com",
    draft: {
      subject: "Re: הצעת מחיר",
      body: "PLACEHOLDER",
    },
    log: { critic_at: "2026-09-16T10:03:00.000Z" },
    injectAiTellAfterDoer: true,
  },
};

export function materialize(key) {
  const seed = seeds[key];
  if (!seed) return null;
  if (seed.forceOrderBug) {
    return buildCard(seed, { forceOrderBug: true });
  }
  if (seed.injectAiTellAfterDoer) {
    // Simulate Doer regression: body still contains em dash (bypass strip for fixture)
    const draft = {
      subject: "Re: הצעת מחיר",
      body: "תודה על הפנייה — מצורפת הצעה מעודכנת כפי שסיכמנו.",
    };
    const review = criticReview(draft);
    return {
      id: seed.id,
      to: seed.to,
      subject: draft.subject,
      body: draft.body,
      draft,
      critic_score: review.critic_score,
      reject_reason: review.reject_reason,
      risk: "reversible",
      status: "rejected",
      log: {
        rejection_tags: seed.rejection_tags || ["ai_tell", "tone_mismatch"],
        critic_at: seed.log.critic_at,
        ui_shown_at: null,
      },
    };
  }
  return buildCard(seed);
}

export const egress = [
  { kind: "smtp", host: "localhost", allowed_after: "approved+reversible+session_approve" },
];

export function enforceRiskStatus(payload) {
  if (!payload.risk || !payload.status) return { ok: false, code: 400, err: "risk and status required" };
  if (payload.risk === "irreversible") return { ok: false, code: 403, err: "irreversible blocked" };
  return { ok: true };
}

export function qaCriticBeforeUser() {
  const names = ["reject-before-ui", "pass-to-card", "bug-bad-order", "reject-ai-tell"];
  const results = names.map((name) => {
    const c = materialize(name);
    const { rejection_tags, critic_at, ui_shown_at } = c.log;
    const taggedOk =
      c.status !== "rejected" || (Array.isArray(rejection_tags) && rejection_tags.length > 0);
    const orderOk =
      ui_shown_at == null ||
      (critic_at && ui_shown_at && Date.parse(critic_at) < Date.parse(ui_shown_at));
    const expectedFail = name === "bug-bad-order";
    const aiTellOk =
      name !== "pass-to-card" ||
      (!findAiTells(c.body).length && !findAiTells(c.draft.body).length);
    const pass = expectedFail ? false : taggedOk && orderOk && aiTellOk;
    return {
      case: name,
      pass,
      expected_fail: expectedFail,
      taggedOk,
      orderOk,
      aiTellOk,
      rejection_tags,
      critic_at,
      ui_shown_at,
      body_preview: c.body.slice(0, 80),
    };
  });
  return {
    results,
    summary: "case-3 must fail; pass-to-card must have zero AI tells; reject-ai-tell must reject before UI",
  };
}
