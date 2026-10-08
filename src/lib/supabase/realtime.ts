/**
 * A unique realtime channel name for each subscription.
 *
 * Supabase reuses a channel when the same name is asked for again. If a screen
 * is left and opened again quickly (the old channel is still closing), adding
 * listeners to that reused, already-subscribed channel throws and the screen
 * crashes. A per-mount suffix avoids that; the topic name itself is only a label.
 */
export function rtChannelName(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${base}#${suffix}`;
}
