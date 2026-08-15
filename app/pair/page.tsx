"use client";

import { useCallback, useEffect, useState } from "react";

type Status = "idle" | "working" | "done" | "failed";

/**
 * Landeseite des QR-Codes. Der Code steht im Fragment (`/pair#<code>`) und
 * nicht in der Query — Browser übertragen Fragmente nie an den Server, der
 * Code taucht also in keinem Access-Log und in keinem Referrer auf.
 */
export default function PairPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const claim = useCallback(async (code: string) => {
    setStatus("working");
    try {
      const res = await fetch("/api/pair/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        machine?: string;
        error?: string;
      };

      if (!res.ok) {
        setStatus("failed");
        setMessage(
          res.status === 429
            ? "Zu viele Versuche. Warte eine Minute."
            : data.error ?? "Koppeln fehlgeschlagen."
        );
        return;
      }

      setStatus("done");
      setMessage(data.machine ?? null);
      // Den Code aus der Adressleiste und der History werfen, bevor es
      // weitergeht. Er ist zwar schon verbraucht, muss aber nicht bleiben.
      window.history.replaceState(null, "", "/pair");
      setTimeout(() => window.location.replace("/control"), 900);
    } catch {
      setStatus("failed");
      setMessage("Server nicht erreichbar.");
    }
  }, []);

  useEffect(() => {
    const code = window.location.hash.replace(/^#/, "").trim();
    if (code) claim(code);
  }, [claim]);

  return (
    <>
      <Styles />
      <main className="sg-shell sg-shell--center">
        <div className="sg-gate">
          <p className="sg-eyebrow">Sleep Guardian</p>

          {status === "working" && (
            <>
              <h1 className="sg-gate-title">Wird gekoppelt …</h1>
              <p className="sg-gate-hint">Einen Moment.</p>
            </>
          )}

          {status === "done" && (
            <>
              <h1 className="sg-gate-title">Gekoppelt</h1>
              <p className="sg-gate-hint">
                {message
                  ? `Dieses Gerät steuert jetzt „${message}“.`
                  : "Dieses Gerät ist jetzt gekoppelt."}
              </p>
            </>
          )}

          {(status === "idle" || status === "failed") && (
            <>
              <h1 className="sg-gate-title">Gerät koppeln</h1>
              <p className="sg-gate-hint">
                Öffne am PC das Tray-Menü und wähle <strong>Handy koppeln</strong>.
                Scanne den QR-Code — oder tippe den Code darunter hier ein.
              </p>
              <input
                className="sg-input"
                value={manual}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && manual.trim() && claim(manual.trim())
                }
                placeholder="Code eingeben"
              />
              <button
                className="sg-btn sg-btn--primary"
                disabled={!manual.trim()}
                onClick={() => claim(manual.trim())}
              >
                Koppeln
              </button>
              {status === "failed" && message && (
                <p className="sg-error">{message}</p>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

function Styles() {
  return (
    <style>{`
      .sg-shell {
        --bg: #131A22;
        --surface: #1B2530;
        --surface-2: #223040;
        --line: #2E3D4E;
        --text: #E8EDF2;
        --muted: #8496A8;
        --danger: #F0787A;

        min-height: 100dvh;
        margin: 0 auto;
        padding: 28px 18px calc(28px + env(safe-area-inset-bottom));
        max-width: 560px;
        background: var(--bg);
        color: var(--text);
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        box-sizing: border-box;
      }
      .sg-shell--center { display: flex; align-items: center; justify-content: center; }
      .sg-shell *, .sg-shell *::before, .sg-shell *::after { box-sizing: border-box; }

      .sg-eyebrow {
        margin: 0 0 6px; font-size: 11px; letter-spacing: .16em;
        text-transform: uppercase; color: var(--muted); font-weight: 600;
      }
      .sg-gate { width: 100%; max-width: 340px; }
      .sg-gate-title { margin: 0 0 8px; font-size: 22px; font-weight: 650; }
      .sg-gate-hint { margin: 0 0 18px; font-size: 13px; color: var(--muted); line-height: 1.55; }
      .sg-gate-hint strong { color: var(--text); font-weight: 600; }

      .sg-input {
        width: 100%; min-height: 48px; padding: 12px 14px;
        border-radius: 10px; border: 1px solid var(--line);
        background: var(--surface); color: var(--text);
        font-size: 16px; font-family: ui-monospace, Menlo, monospace;
      }
      .sg-input:focus-visible { outline: 2px solid #3D7FD6; outline-offset: 2px; }

      .sg-btn {
        appearance: none; width: 100%; min-height: 46px;
        padding: 12px 14px; border-radius: 10px;
        border: 1px solid var(--line); background: var(--surface-2);
        color: var(--text); font-size: 14px; font-weight: 550;
        font-family: inherit; cursor: pointer;
      }
      .sg-btn:disabled { opacity: .38; cursor: not-allowed; }
      .sg-btn--primary { background: #3D7FD6; border-color: #3D7FD6; margin-top: 12px; }

      .sg-error { margin: 14px 0 0; font-size: 13px; color: var(--danger); }
    `}</style>
  );
}
