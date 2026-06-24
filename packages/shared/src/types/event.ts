export type EventType =
  | "action.branch"
  | "action.edit"
  | "action.commit"
  | "error.test"
  | "hypothesis.raised"
  | "decision.made"
  | "session.pause"
  | "feature.merged";

export interface Event {
  /** evt_<nanoid> */
  event_id: string;
  room_id: string;
  feature_id: string;
  actor_id: string;
  type: EventType;
  payload: Record<string, unknown>;
  /** unix ms */
  ts: number;
}
