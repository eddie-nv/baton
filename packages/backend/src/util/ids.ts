import { nanoid } from "nanoid";

/**
 * Prefixed ID generators. Prefixes are the CLAUDE.md standard
 * (room_, feat_, evt_, ck_, sess_, proj_) so every ID in the system
 * self-identifies its kind.
 */
const SIZE = 12;

export const ids = {
  room: (): string => `room_${nanoid(SIZE)}`,
  project: (): string => `proj_${nanoid(SIZE)}`,
  event: (): string => `evt_${nanoid(SIZE)}`,
  checkpoint: (): string => `ck_${nanoid(SIZE)}`,
  session: (): string => `sess_${nanoid(SIZE)}`,
} as const;
