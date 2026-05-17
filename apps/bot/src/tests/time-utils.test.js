const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getCalendarDateInTimeZone,
  formatDateTimeInTimeZone,
} = require("../utils/time");

test("getCalendarDateInTimeZone uses Jakarta calendar day (not UTC day)", () => {
  const date = new Date("2026-05-14T18:00:00.000Z"); // 01:00:00 WIB next day
  const day = getCalendarDateInTimeZone(date, "Asia/Jakarta");
  assert.equal(day, "2026-05-15");
});

test("formatDateTimeInTimeZone returns WIB label when requested", () => {
  const date = new Date("2026-05-14T18:00:00.000Z");
  const formatted = formatDateTimeInTimeZone(date, { timeZone: "Asia/Jakarta", label: "WIB" });
  assert.equal(formatted.includes("2026-05-15"), true);
  assert.equal(formatted.endsWith("WIB"), true);
});

test("formatDateTimeInTimeZone fallback avoids ISO UTC format when timezone is invalid", () => {
  const date = new Date("2026-05-14T18:00:00.000Z");
  const formatted = formatDateTimeInTimeZone(date, { timeZone: "Invalid/Zone", label: "WIB" });
  assert.equal(formatted.includes("T"), false);
  assert.equal(formatted.endsWith("WIB"), true);
});
