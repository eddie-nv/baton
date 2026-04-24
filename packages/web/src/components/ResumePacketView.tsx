import { useEffect, useState } from "react";
import { PACKET_BUDGET, type ResumePacket } from "@baton/shared";
import { ApiError, getResumePacket } from "../lib/api.js";
import { approximateTokens, formatDate } from "../lib/format.js";

interface ResumePacketViewProps {
  roomId: string;
  featureId: string;
}

type Status =
  | { kind: "loading" }
  | { kind: "ok"; packet: ResumePacket }
  | { kind: "error"; message: string };

export function ResumePacketView({
  roomId,
  featureId,
}: ResumePacketViewProps): JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setStatus({ kind: "loading" });
    getResumePacket(roomId, featureId)
      .then(({ packet }) => {
        if (cancelled) return;
        setStatus({ kind: "ok", packet });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? `${err.code}: ${err.message}`
            : err instanceof Error
              ? err.message
              : "unknown";
        setStatus({ kind: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, featureId]);

  return (
    <section className="card">
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">Resume packet</h3>
        {status.kind === "ok" ? (
          <Tokens packet={status.packet} />
        ) : null}
      </header>

      {status.kind === "loading" ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : status.kind === "error" ? (
        <p className="text-sm text-rose-700">Failed: {status.message}</p>
      ) : (
        <PacketBody packet={status.packet} />
      )}
    </section>
  );
}

function Tokens({ packet }: { packet: ResumePacket }): JSX.Element {
  const tokens = approximateTokens(packet);
  const over = tokens > PACKET_BUDGET;
  return (
    <span
      className={`pill ${
        over
          ? "bg-rose-50 text-rose-900 border border-rose-200"
          : "bg-ink-100 text-ink-700 border border-ink-200"
      }`}
      title={`approximate token count ${tokens} of ${PACKET_BUDGET} budget (server enforces exactly)`}
    >
      ~{tokens} / {PACKET_BUDGET} tok
    </span>
  );
}

function PacketBody({ packet }: { packet: ResumePacket }): JSX.Element {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs uppercase tracking-wide text-ink-500 mb-1">
          next action
        </p>
        <p className="text-ink-900">
          {packet.next_action || (
            <span className="text-ink-500">(none)</span>
          )}
        </p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink-500 mb-1">
          last decisions ({packet.last_decisions.length}/3)
        </p>
        {packet.last_decisions.length === 0 ? (
          <p className="text-ink-500 text-sm">(none)</p>
        ) : (
          <ul className="space-y-2">
            {packet.last_decisions.map((d) => (
              <li key={d.event_id} className="border-l-2 border-ink-200 pl-3">
                <p className="text-ink-900">{d.text}</p>
                <p className="font-mono text-[11px] text-ink-500">
                  {d.event_id} · {formatDate(d.ts)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {packet.open_blockers.length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-500 mb-1">
            open blockers
          </p>
          <ul className="list-disc pl-5 text-ink-700 space-y-1">
            {packet.open_blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
