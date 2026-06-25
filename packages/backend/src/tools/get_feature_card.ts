import type { z } from "zod";
import { getFeatureCardInput, type FeatureCard } from "@baton/shared";
import { k } from "../redis/keys.js";
import { notFound, type ToolHandler } from "./types.js";

type Input = z.infer<typeof getFeatureCardInput>;
type Output = FeatureCard;

/**
 * Return the feature card for (room_id, feature_id). Throws 404 if no
 * card exists — callers must fire an action.branch event first to
 * initialize the card.
 */
export const getFeatureCard: ToolHandler<Input, Output> = async (
  { room_id, feature_id },
  { redis },
) => {
  const raw = await redis.json.get(k.feature(room_id, feature_id));
  if (raw === null) throw notFound(`feature ${feature_id}`);
  return raw as unknown as FeatureCard;
};
