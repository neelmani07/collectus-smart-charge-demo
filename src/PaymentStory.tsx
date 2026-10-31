import type { PaymentDetail, PaymentHistoryItem, PaymentType } from "./types";

function money(currency: string, amount: number) {
  return `${currency} ${amount.toFixed(2)}`;
}

function typeLabel(type: PaymentType) {
  if (type === "manual_repayment") return "Manual repayment";
  if (type === "normal_autocharge") return "Normal autocharge";
  return "Smart autocharge";
}

function typeClass(type: PaymentType) {
  return `tag tag-type-${type}`;
}

type Props = {
  detail: PaymentDetail;
  visibleSteps: number;
  onClose: () => void;
};

export function PaymentStory({ detail, visibleSteps, onClose }: Props) {
  const orchestration = detail.orchestration;
  const byType = (type: PaymentType) =>
    detail.history.find((h) => h.payment_type === type) as PaymentHistoryItem | undefined;

  const manual = byType("manual_repayment");
  const normal = byType("normal_autocharge");
  const smart = byType("smart_autocharge");
  const currency = manual?.currency ?? smart?.currency ?? "SAR";

  const steps = [
    {
      title: "1 · Manual repayment",
      body: manual ? (
        <>
          Customer paid <strong>{money(currency, manual.amount)}</strong> for their own installment
          {manual.product_name ? ` · ${manual.product_name}` : ""}. This is a normal repayment — no
          AI involved yet.
        </>
      ) : (
        <>No manual repayment on this event.</>
      ),
      meta: manual ? `Status: ${manual.status}` : null,
    },
    {
      title: "2 · Repayment event",
      body: (
        <>
          System published <code>repayment.succeeded</code>. That activity signal is what wakes
          collection logic — instead of waiting for a blind cron job.
        </>
      ),
      meta: `event: ${detail.event_id.slice(0, 18)}…`,
    },
    {
      title: "3 · Normal autocharge (baseline)",
      body: normal ? (
        <>
          Without AI, cron-style autocharge would try to collect{" "}
          <strong>{money(currency, normal.amount)}</strong> of remaining overdue automatically —
          every time, no judgment.
        </>
      ) : (
        <>No baseline recorded.</>
      ),
      meta: normal
        ? `${typeLabel("normal_autocharge")} · ${normal.status.replaceAll("_", " ")}`
        : null,
    },
    {
      title: "4 · Smart autocharge (AI + Autopay)",
      body: smart ? (
        <>
          AI reviewed remaining overdue and chose{" "}
          <strong>{String(smart.details.ai_action ?? "—")}</strong>
          {smart.details.ai_reason ? <> — {String(smart.details.ai_reason)}</> : null}.{" "}
          {smart.status === "succeeded" ? (
            <>
              Autopay then charged <strong>{money(currency, smart.amount)}</strong>.
            </>
          ) : smart.status === "skipped_by_ai" ? (
            <>Autopay did <strong>not</strong> charge extra — AI skipped.</>
          ) : smart.status === "nothing_due" ? (
            <>Nothing else was overdue, so Autopay had no extra work.</>
          ) : (
            <>Autopay status: {smart.status.replaceAll("_", " ")}.</>
          )}
        </>
      ) : (
        <>No smart autocharge row.</>
      ),
      meta: smart
        ? `Score ${Number(smart.details.ai_score ?? orchestration?.decision.score ?? 0).toFixed(2)} · ${smart.status}`
        : null,
      highlight: true,
    },
  ];

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal story-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="story-kicker">Payment details</p>
        <h3>How this payment was processed</h3>
        <p className="muted story-lede">
          Customer only paid their installment. Behind the scenes we also record what{" "}
          <em>normal</em> autocharge would do vs what <em>smart</em> autocharge did.
        </p>

        <div className="story-compare">
          <div className="mini-card">
            <span className="mini-label">Normal autocharge</span>
            <strong className={typeClass("normal_autocharge")}>Cron-style</strong>
            <p>
              {normal
                ? `Would charge ${money(currency, normal.amount)} overdue`
                : "—"}
            </p>
          </div>
          <div className="mini-card smart">
            <span className="mini-label">Smart autocharge</span>
            <strong className={typeClass("smart_autocharge")}>
              {String(smart?.details.ai_action ?? smart?.status ?? "—")}
            </strong>
            <p>{String(smart?.details.ai_reason ?? "AI decision + Autopay")}</p>
          </div>
        </div>

        <div className="type-legend">
          {detail.history.map((item) => (
            <div key={item.history_id} className="legend-row">
              <span className={typeClass(item.payment_type)}>{typeLabel(item.payment_type)}</span>
              <span>{money(item.currency, item.amount)}</span>
              <span className="muted">{item.status.replaceAll("_", " ")}</span>
            </div>
          ))}
        </div>

        <ol className="story-steps">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className={`story-step ${index < visibleSteps ? "visible" : ""} ${step.highlight ? "ai" : ""}`}
            >
              <div className="story-rail" aria-hidden />
              <div className="story-copy">
                <h4>{step.title}</h4>
                <p>{step.body}</p>
                {step.meta ? <p className="muted meta">{step.meta}</p> : null}
              </div>
            </li>
          ))}
        </ol>

        <div className="modal-actions">
          <button type="button" className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
