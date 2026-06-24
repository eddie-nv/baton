import { truncateCard, type FeatureCard } from "@baton/shared";
import type { RedisJSON } from "@redis/json/dist/commands";
import type { BatonRedis } from "../redis/client.js";
import { k } from "../redis/keys.js";

/**
 * Sole write boundary for feature cards. Truncates to the 500-token cap
 * (throws if the card's fixed fields alone exceed budget — see shared's
 * truncateCard) and then JSON.SETs the result.
 *
 * All card mutations in the backend MUST go through this function.
 * There is no other path to Redis for feature docs. Enforcement here is
 * what makes the 500-token invariant architectural rather than aspirational.
 */
export async function setFeatureCardSafely(
  redis: BatonRedis,
  card: FeatureCard,
): Promise<FeatureCard> {
  const safe = truncateCard(card);
  await redis.json.set(
    k.feature(safe.room_id, safe.feature_id),
    "$",
    safe as unknown as RedisJSON,
  );
  return safe;
}
