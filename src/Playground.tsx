import { useEffect, useState } from "react";
import { AiDecisionView } from "./AiDecisionView";
import { playgroundDecide } from "./api";
import type { PlaygroundDecision, PlaygroundInput } from "./types";

const PRESETS: Record<string, PlaygroundInput> = {
  Aisha: {
    event_type: "repayment.succeeded", overdue_amount: 45, amount_paid: 45, days_overdue: 14,
    pm_health: 0.9, fails_7d: 0, recent_success: 0.85, declines_left: 3,
    card_network: "mada", card_token: "apple_pay", card_funding: "debit",
  },
  Omar: {
    event_type: "repayment.succeeded", overdue_amount: 130, amount_paid: 130, days_overdue: 14,
    pm_health: 0.25, fails_7d: 4, recent_success: 0.15, declines_left: 2,
    card_network: "visa", card_token: "plastic", card_funding: "prepaid",
  },
  Reem: {
    event_type: "repayment.succeeded", overdue_amount: 249.75, amount_paid: 249.75, days_overdue: 14,
    pm_health: 0.5, fails_7d: 3, recent_success: 0.4, declines_left: 1,
    card_network: "mada", card_token: "plastic", card_funding: "debit",
  },
  Huda: {
    event_type: "repayment.succeeded", overdue_amount: 249.75, amount_paid: 249.75, days_overdue: 14,
    pm_health: 0.5, fails_7d: 3, recent_success: 0.4, declines_left: 3,
    card_network: "visa", card_token: "plastic", card_funding: "debit",
  },
};

const MAX_DECLINES = { mada: 3, visa: 6, mastercard: 6 } as const;

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
};

function Slider({ label, value, min, max, step, format, onChange }: SliderProps) {
  return (
    <label className="field">
      <span className="field-head">
        <span>{label}</span>
        <strong>{format ? format(value) : value}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

type SegmentProps<T extends string> = {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
};

function Segment<T extends string>({ label, value, options, onChange }: SegmentProps<T>) {
  return (
    <div className="field">
      <span className="field-head">
        <span>{label}</span>
      </span>
      <div className="segment" role="radiogroup" aria-label={label}>
        {options.map(([id, text]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            className={value === id ? "active" : ""}
            onClick={() => onChange(id)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Playground() {
  const [input, setInput] = useState<PlaygroundInput>(PRESETS.Reem);
  const [decision, setDecision] = useState<PlaygroundDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof PlaygroundInput>(key: K, value: PlaygroundInput[K]) =>
    setInput((prev) => {
      const next = { ...prev, [key]: value };
      next.declines_left = Math.min(next.declines_left, MAX_DECLINES[next.card_network]);
      if (next.card_network === "mada") next.card_funding = "debit"; // Mada cards are debit
      next.amount_paid = Math.min(next.amount_paid, next.overdue_amount * 2);
      return next;
    });

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        setDecision(await playgroundDecide(input));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not reach the AI");
      } finally {
        setBusy(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [input]);

  const sar = (v: number) => `SAR ${v.toFixed(0)}`;
  const pctLabel = (v: number) => `${Math.round(v * 100)}%`;
  const repayment = input.event_type === "repayment.succeeded";

  return (
    <section className="panel playground">
      <div className="panel-head">
        <div>
          <h2 className="section-title">Try Smart Autocharge with your own customer</h2>
          <p className="muted">
            Change anything and the live model decides instantly. Nothing is charged or saved.
          </p>
        </div>
        <div className="preset-row">
          <span className="muted">Start from:</span>
          {Object.keys(PRESETS).map((name) => (
            <button key={name} type="button" className="chip" onClick={() => setInput(PRESETS[name])}>
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="playground-grid">
        <div className="playground-form">
          <Segment
            label="Moment"
            value={input.event_type}
            options={[
              ["repayment.succeeded", "Just repaid"],
              ["schedule.due", "Scheduled cron day"],
            ]}
            onChange={(v) => set("event_type", v)}
          />
          <Segment
            label="Card network"
            value={input.card_network}
            options={[
              ["mada", "Mada"],
              ["visa", "Visa"],
              ["mastercard", "Mastercard"],
            ]}
            onChange={(v) => set("card_network", v)}
          />
          <div className="field-pair">
            <Segment
              label="Wallet"
              value={input.card_token}
              options={[
                ["plastic", "Card"],
                ["apple_pay", "Apple Pay"],
              ]}
              onChange={(v) => set("card_token", v)}
            />
            <Segment
              label="Type"
              value={input.card_funding}
              options={
                input.card_network === "mada"
                  ? [["debit", "Debit"]]
                  : [
                      ["debit", "Debit"],
                      ["credit", "Credit"],
                      ["prepaid", "Prepaid"],
                    ]
              }
              onChange={(v) => set("card_funding", v)}
            />
          </div>
          <Slider
            label={`Declines left this month (max ${MAX_DECLINES[input.card_network]})`}
            value={input.declines_left}
            min={0}
            max={MAX_DECLINES[input.card_network]}
            step={1}
            onChange={(v) => set("declines_left", v)}
          />
          <Slider label="Card health" value={input.pm_health} min={0} max={1} step={0.05} format={pctLabel} onChange={(v) => set("pm_health", v)} />
          <Slider label="Recent payment success" value={input.recent_success} min={0} max={1} step={0.05} format={pctLabel} onChange={(v) => set("recent_success", v)} />
          <Slider label="Failed attempts, last 7 days" value={input.fails_7d} min={0} max={6} step={1} onChange={(v) => set("fails_7d", v)} />
          <Slider label="Days overdue" value={input.days_overdue} min={1} max={90} step={1} onChange={(v) => set("days_overdue", v)} />
          <Slider label="Overdue amount" value={input.overdue_amount} min={20} max={3000} step={10} format={sar} onChange={(v) => set("overdue_amount", v)} />
          {repayment ? (
            <Slider label="Amount just repaid" value={input.amount_paid} min={0} max={Math.max(20, input.overdue_amount * 2)} step={5} format={sar} onChange={(v) => set("amount_paid", v)} />
          ) : null}
        </div>

        <div className="playground-result" aria-live="polite">
          <p className="story-kicker">AI decision {busy ? "· thinking…" : ""}</p>
          {error ? <p className="error">{error}</p> : null}
          {decision ? (
            <>
              <p className="playground-verdict">
                {decision.action === "charge"
                  ? `Charge SAR ${decision.amount.toFixed(2)} now`
                  : "Don’t charge now — keep the decline"}
              </p>
              <AiDecisionView
                action={decision.action}
                score={decision.score}
                bar={decision.min_success_prob_applied}
                gate={decision.gate}
                card={decision.card}
                declinesLeft={decision.declines_left}
                drivers={decision.drivers}
                nextAction={decision.next_best_action}
                reason={decision.reason}
              />
            </>
          ) : !error ? (
            <p className="muted">Asking the model…</p>
          ) : null}
          <p className="muted playground-note">
            Logistic regression trained on 20,000 synthetic charge attempts. Rules above the model:
            no declines left → stop; the last decline needs 30% (50% on a cron day).
          </p>
        </div>
      </div>
    </section>
  );
}
