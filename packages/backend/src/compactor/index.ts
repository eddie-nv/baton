import type { Event, FeatureCard } from "@baton/shared";
import { handlers } from "./handlers.js";

/**
 * Dispatch an event against the current feature card and return the
 * patched card. If the event is a no-op for the card (e.g. session.pause,
 * or a duplicate hypothesis), returns the same reference — callers can
 * use `out === card` to detect no-op and skip the JSON.SET.
 *
 * Throws if the event type is unknown or the payload fails validation.
 */
export function dispatch(event: Event, card: FeatureCard): FeatureCard {
  const handler = handlers[event.type];
  if (handler === undefined) {
    throw new Error(`compactor: unknown event type ${String(event.type)}`);
  }
  return handler(event, card);
}

export { handlers } from "./handlers.js";
export * from "./rules.js";
