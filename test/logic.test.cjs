const test = require("node:test");
const assert = require("node:assert/strict");
const logic = require("../logic.js");

test("creates, updates, and deletes records immutably", () => {
  const fields = [{ name: "label", label: "Label", type: "text", required: true }];
  const original = [];
  const created = logic.createRecord(original, { label: "  sample  " }, "record-1", fields);
  assert.equal(created[0].label, "sample");
  assert.deepEqual(original, []);
  const updated = logic.updateRecord(created, "record-1", { done: true });
  assert.equal(updated[0].done, true);
  assert.deepEqual(logic.deleteRecord(updated, "record-1"), []);
});

test("validates required fields and non-negative numeric fields", () => {
  assert.throws(() => logic.createRecord([], { label: "" }, "1", [{ name: "label", label: "Name", required: true }]), /required/);
  assert.throws(() => logic.createRecord([], { count: "-2" }, "1", [{ name: "count", label: "Count", type: "number", required: true }]), /non-negative/);
});

test("reports overdue, due-today, and upcoming dates", () => {
  const now = new Date(2026, 0, 10, 12);
  assert.equal(logic.dueStatus("2026-01-09", now).tone, "danger");
  assert.equal(logic.dueStatus("2026-01-10", now).label, "Due today");
  assert.equal(logic.dueStatus("2026-01-14", now).tone, "warning");
});

test("calculates a representative discount estimate", () => {
  const result = logic.calculate("discount", {"originalPrice": "100", "discountPercent": "10", "couponAmount": "5", "taxPercent": "5"});
  assert.ok(Array.isArray(result) && result.length > 0);
});
