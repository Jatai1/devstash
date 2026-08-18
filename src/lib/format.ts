const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * Formats an ISO timestamp as "Jan 15". Pinned to UTC so the server and the
 * client always produce the same string.
 */
export function formatShortDate(iso: string): string {
  return SHORT_DATE.format(new Date(iso));
}
