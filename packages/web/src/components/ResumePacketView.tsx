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
      <header className="flex items-center justify-between mb-4 pb-3 border-b border-edge">
        <div>
          <p className="font-mono text-2xs uppercase tracking-widest text-signal">
            resume_packet
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            what the next agent reads at session-start
          </p>
        </div>
        {status.kind === "ok" ? <Tokens packet={status.packet} /> : null}
      </header>

      {status.kind === "loading" ? (
        <p className="font-mono text-2xs uppercase tracking-widest text-ink-500">
          loading…
        </p>
      ) : status.kind === "error" ? (
        <p className="font-mono text-xs text-evt-error">
          ↳ failed: {status.message}
        </p>
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
      className={`pill border ${
        over
          ? "border-evt-error/40 bg-evt-error/10 text-evt-error"
          : "border-edge text-ink-300"
      }`}
      title={`approximate token count ${tokens} of ${PACKET_BUDGET} budget (server enforces exactly)`}
    >
      ~{tokens} / {PACKET_BUDGET} tok
    </span>
  );
}

function PacketBody({ packet }: { packet: ResumePacket }): JSX.Element {
  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-2xs uppercase tracking-widest text-signal mb-1.5">
          next action
        </p>
        <p className="text-sm text-ink-50">
          {packet.next_action || (
            <span className="text-ink-500 italic">none</span>
          )}
        </p>
      </div>

      <div>
        <p className="font-mono text-2xs uppercase tracking-widest text-signal mb-1.5">
          last decisions ({packet.last_decisions.length}/3)
        </p>
        {packet.last_decisions.length === 0 ? (
          <p className="text-sm text-ink-500 italic">none</p>
        ) : (
          <ul className="space-y-2.5">
            {packet.last_decisions.map((d) => (
              <li
                key={d.event_id}
                className="border-l-2 border-evt-decision/60 pl-3"
              >
                <p className="text-sm text-ink-50">{d.text}</p>
                <p className="mt-0.5 font-mono text-2xs uppercase tracking-widest text-ink-500">
                  {d.event_id} · {formatDate(d.ts)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {packet.open_blockers.length > 0 ? (
        <div>
          <p className="font-mono text-2xs uppercase tracking-widest text-signal mb-1.5">
            open blockers
          </p>
          <ul className="space-y-1 text-sm text-ink-100">
            {packet.open_blockers.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-evt-error font-mono select-none">●</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
