import assert from "node:assert/strict";
import { test } from "node:test";
import {
  criticReview,
  doerDraft,
  enforceApproveIntent,
  findAiTells,
  materialize,
  qaCriticBeforeUser,
  stripAiTells,
} from "./lib.mjs";

test("doerDraft strips typographic em dashes before emit", () => {
  const draft = doerDraft({
    subject: "Re: hello",
    body: "Thanks — see the attached quote.",
  });
  assert.equal(findAiTells(draft.body).includes("em_dash"), false);
  assert.match(draft.body, / - /);
  assert.doesNotMatch(draft.body, /[—\u2014]/);
});

test("stripAiTells replaces ellipsis and em dash", () => {
  const out = stripAiTells("Hello—world…");
  assert.equal(out, "Hello - world...");
});

test("criticReview rejects em dash as ai_tell before UI", () => {
  const review = criticReview({
    subject: "Re: הצעת מחיר",
    body: "תודה על הפנייה — מצורפת הצעה.",
  });
  assert.equal(review.pass, false);
  assert.equal(review.status, "rejected");
  assert.deepEqual(review.rejection_tags, ["ai_tell", "tone_mismatch"]);
  assert.ok(review.tells.includes("em_dash"));
  assert.ok(review.reject_reason.includes("AI"));
});

test("criticReview rejects model phrasing (as an AI)", () => {
  const review = criticReview({
    subject: "Hello",
    body: "As an AI I cannot send this.",
  });
  assert.equal(review.pass, false);
  assert.ok(review.rejection_tags.includes("ai_tell"));
  assert.ok(review.tells.includes("as_an_ai"));
});

test("criticReview passes a clean Hebrew draft", () => {
  const review = criticReview({
    subject: "Re: הצעת מחיר",
    body: "תודה על הפנייה. מצורפת הצעה מעודכנת כפי שסיכמנו.",
  });
  assert.equal(review.pass, true);
  assert.equal(review.status, "pending");
  assert.equal(review.reject_reason, null);
  assert.deepEqual(review.rejection_tags, []);
});

test("pass-to-card is pending with zero AI tells", () => {
  const card = materialize("pass-to-card");
  assert.equal(card.status, "pending");
  assert.equal(card.risk, "reversible");
  assert.equal(findAiTells(card.body).length, 0);
  assert.equal(findAiTells(card.draft.body).length, 0);
  assert.ok(Date.parse(card.log.critic_at) < Date.parse(card.log.ui_shown_at));
});

test("reject-ai-tell is rejected before UI (ui_shown_at null)", () => {
  const card = materialize("reject-ai-tell");
  assert.equal(card.status, "rejected");
  assert.ok(card.log.rejection_tags.includes("ai_tell"));
  assert.equal(card.log.ui_shown_at, null);
  assert.ok(findAiTells(card.body).includes("em_dash"));
});

test("reject-before-ui never reaches the user", () => {
  const card = materialize("reject-before-ui");
  assert.equal(card.status, "rejected");
  assert.equal(card.log.ui_shown_at, null);
  assert.ok(card.log.rejection_tags.includes("tone_mismatch"));
});

test("qa critic-before-user: case-3 fails, others pass", () => {
  const qa = qaCriticBeforeUser();
  const byName = Object.fromEntries(qa.results.map((r) => [r.case, r]));
  assert.equal(byName["bug-bad-order"].pass, false);
  assert.equal(byName["bug-bad-order"].expected_fail, true);
  assert.equal(byName["pass-to-card"].pass, true);
  assert.equal(byName["reject-before-ui"].pass, true);
  assert.equal(byName["reject-ai-tell"].pass, true);
});

test("enforceApproveIntent requires risk and status on the request body", () => {
  assert.equal(enforceApproveIntent({}).code, 400);
  assert.equal(enforceApproveIntent({ case: "pass-to-card" }).err, "risk and status required");
});

test("enforceApproveIntent blocks irreversible even if status is approved", () => {
  const r = enforceApproveIntent({
    risk: "irreversible",
    status: "approved",
    case: "pass-to-card",
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, 403);
  assert.equal(r.err, "irreversible blocked");
});

test("enforceApproveIntent blocks status other than approved", () => {
  const r = enforceApproveIntent({
    risk: "reversible",
    status: "rejected",
    case: "pass-to-card",
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, 403);
});

test("enforceApproveIntent allows reversible+approved", () => {
  const r = enforceApproveIntent({
    risk: "reversible",
    status: "approved",
    case: "pass-to-card",
  });
  assert.equal(r.ok, true);
});
