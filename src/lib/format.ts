const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * Formats a date as "Jan 15". Pinned to UTC so the server and the client always
 * produce the same string.
 */
export function formatShortDate(date: Date | string): string {
  return SHORT_DATE.format(typeof date === "string" ? new Date(date) : date);
}

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Formats a date as "January 15, 2026".
 *
 * Carries the year, unlike `formatShortDate`: that one labels recently touched
 * items where the year is obvious, while this is for dates that can be any age,
 * such as when an account was created. Pinned to UTC for the same reason.
 */
export function formatLongDate(date: Date | string): string {
  return LONG_DATE.format(typeof date === "string" ? new Date(date) : date);
}
