/**
 * Shim configuration. All values come from environment variables — the
 * shim intentionally ships zero secrets (see CLAUDE.md §1, project
 * invariants). The only strictly-required var is BATON_API_URL; the
 * bearer token (BATON_ROOM_ID) is optional so the shim can still call
 * create_room on a fresh install.
 */
export interface ShimConfig {
  readonly apiUrl: string;
  readonly roomId: string | undefined;
  readonly actorId: string | undefined;
  readonly featureId: string | undefined;
}

function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw.trim().length === 0) return undefined;
  return raw.trim();
}

export function loadConfig(): ShimConfig {
  const apiUrlRaw = readEnv("BATON_API_URL");
  if (apiUrlRaw === undefined) {
    throw new Error(
      "BATON_API_URL is required — set it to your Baton backend (e.g. http://localhost:3000)",
    );
  }
  // Accept "http://host/" and store "http://host" so downstream URL
  // building never double-slashes.
  const apiUrl = apiUrlRaw.replace(/\/+$/, "");

  return {
    apiUrl,
    roomId: readEnv("BATON_ROOM_ID"),
    actorId: readEnv("BATON_ACTOR_ID"),
    featureId: readEnv("BATON_FEATURE_ID"),
  };
}
