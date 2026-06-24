import { SchemaFieldTypes } from "redis";
import type { BatonRedis } from "./client.js";

export const FEATURES_INDEX_NAME = "idx:features";
const FEATURES_PREFIX = "feature:";

/**
 * Create the RediSearch index over feature cards. Idempotent — swallows
 * "Index already exists" so repeated server boots (and test reruns)
 * never crash.
 *
 * v1 indexes only text + tag fields. v2 bonus will add a vector field
 * (see §8 of CLAUDE.md) for semantic feature lookup.
 */
export async function ensureFeaturesIndex(client: BatonRedis): Promise<void> {
  try {
    await client.ft.create(
      FEATURES_INDEX_NAME,
      {
        "$.purpose": {
          type: SchemaFieldTypes.TEXT,
          AS: "purpose",
        },
        "$.state": {
          type: SchemaFieldTypes.TAG,
          AS: "state",
        },
        "$.feature_id": {
          type: SchemaFieldTypes.TAG,
          AS: "feature_id",
        },
        "$.room_id": {
          type: SchemaFieldTypes.TAG,
          AS: "room_id",
        },
        "$.git.branch": {
          type: SchemaFieldTypes.TAG,
          AS: "branch",
        },
      },
      {
        ON: "JSON",
        PREFIX: FEATURES_PREFIX,
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Index already exists")) return;
    throw err;
  }
}
