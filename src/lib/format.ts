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
