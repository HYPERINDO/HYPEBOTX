function getDateTimeParts(dateInput = new Date(), timeZone = process.env.APP_TIMEZONE || "Asia/Jakarta") {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type, fallback = "") => parts.find((part) => part.type === type)?.value || fallback;

  return {
    year: get("year", "1970"),
    month: get("month", "01"),
    day: get("day", "01"),
    hour: get("hour", "00"),
    minute: get("minute", "00"),
    second: get("second", "00"),
  };
}

function isValidDate(date) {
  return date instanceof Date && Number.isFinite(date.getTime());
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatFallbackDateTime(dateInput = new Date(), { label = null } = {}) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (!isValidDate(date)) return "-";
  const base = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
  return label ? `${base} ${label}` : base;
}

function getCalendarDateInTimeZone(dateInput = new Date(), timeZone = process.env.APP_TIMEZONE || "Asia/Jakarta") {
  try {
    const { year, month, day } = getDateTimeParts(dateInput, timeZone);
    return `${year}-${month}-${day}`;
  } catch {
    const fallback = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (!isValidDate(fallback)) return "1970-01-01";
    return `${fallback.getFullYear()}-${pad2(fallback.getMonth() + 1)}-${pad2(fallback.getDate())}`;
  }
}

function formatDateTimeInTimeZone(
  dateInput = new Date(),
  {
    timeZone = process.env.APP_TIMEZONE || "Asia/Jakarta",
    label = timeZone === "Asia/Jakarta" ? "WIB" : null,
  } = {},
) {
  try {
    const { year, month, day, hour, minute, second } = getDateTimeParts(dateInput, timeZone);
    const base = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    return label ? `${base} ${label}` : base;
  } catch {
    return formatFallbackDateTime(dateInput, { label });
  }
}

module.exports = {
  getCalendarDateInTimeZone,
  formatDateTimeInTimeZone,
};
