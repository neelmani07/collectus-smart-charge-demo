import type { OrchestrationResult } from "./types";

function money(currency: string, amount: number) {
  return `${currency} ${amount.toFixed(2)}`;
}

function actionClass(action: string) {
  return `tag tag-${action}`;
}

type Props = {
  result: OrchestrationResult;
  visibleSteps: number;
  onClose: () => void;
};

export function PaymentStory({ result, visibleSteps, onClose }: Props) {
  const aiAction = result.decision.action;
  const autopayStatus = result.autopay?.status ?? "skipped";
  const settled = result.autopay?.installments_settled?.length ?? 0;

  const steps = [
    {
      title: "1 · You paid an installment",
      body: (
        <>
          Your voluntary payment of <strong>{money(result.currency, result.amount_paid)}</strong> succeeded.
          This is a normal customer repayment (RPM).
        </>
      ),
      meta: result.order_snapshot
        ? `${result.order_snapshot.product_name} · ${result.order_snapshot.merchant}`
        : null,
    },
    {
      title: "2 · Repayment event fired",
      body: (
        <>
          Backend published <code>repayment.succeeded</code>. Collections listened — this is the
          moment Smart Autocharge wakes up (instead of waiting for a nightly cron).
        </>
      ),
      meta: `event: ${result.event_id.slice(0, 18)}…`,
    },
    {
      title: "3 · AI decided what to do next",
      body: (
        <>
          AI looked at <strong>other overdue</strong> still left after your payment (
          {money(result.currency, result.overdue_before)}), plus payment-method health and recent
          fails. It chose{" "}
          <span className={actionClass(aiAction)}>{aiAction}</span>
          {aiAction === "skip"
            ? " — do not autocharge more now."
            : aiAction === "partial"
              ? " — recover only part of the overdue."
              : " — autocharge the overdue now."}
        </>
      ),
      meta: `Score ${result.decision.score.toFixed(2)} · ${result.decision.reason}`,
      highlight: true,
    },
    {
      title: "4 · Autopay executed the decision",
      body: (
        <>
          {autopayStatus === "success" ? (
            <>
              Autopay charged <strong>{money(result.currency, result.decision.amount)}</strong> on
              your saved payment method and settled {settled} overdue installment
              {settled === 1 ? "" : "s"}. Overdue went{" "}
              <strong>
                {result.overdue_before.toFixed(2)} → {result.overdue_after.toFixed(2)}
              </strong>
              .
            </>
          ) : autopayStatus === "failed" ? (
            <>Autopay tried but the issuer declined. No extra installments were settled.</>
          ) : result.overdue_before <= 0 ? (
            <>No other overdue remained, so Autopay had nothing extra to charge.</>
          ) : (
            <>
              Autopay <strong>did not charge</strong> more — AI said skip. Remaining overdue stays{" "}
              {money(result.currency, result.overdue_after)}.
            </>
          )}
        </>
      ),
      meta: result.autopay?.message ?? null,
    },
  ];

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal story-modal" role="dialog" aria-modal="true">
        <p className="story-kicker">What just happened</p>
        <h3>Payment → AI → Autopay</h3>
        <p className="muted story-lede">
          Your payment is separate from Smart Autocharge. Paying triggers the AI, which may then
          ask Autopay to collect other overdue — or wisely skip.
        </p>

        <div className="story-compare">
          <div className="mini-card">
            <span className="mini-label">Blind baseline</span>
            <strong>Always autocharge</strong>
            <p>Would charge all {money(result.currency, result.overdue_before)} overdue every time.</p>
          </div>
          <div className="mini-card smart">
            <span className="mini-label">Our AI</span>
            <strong className={actionClass(aiAction)}>{aiAction}</strong>
            <p>{result.decision.reason}</p>
          </div>
        </div>

        <ol className="story-steps">
          {steps.map((step, index) => {
            const active = index < visibleSteps;
            return (
              <li
                key={step.title}
                className={`story-step ${active ? "visible" : ""} ${step.highlight ? "ai" : ""}`}
              >
                <div className="story-rail" aria-hidden />
                <div className="story-copy">
                  <h4>{step.title}</h4>
                  <p>{step.body}</p>
                  {step.meta ? <p className="muted meta">{step.meta}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="modal-actions">
          <button type="button" className="primary" onClick={onClose}>
            Got it — view my payments
          </button>
        </div>
      </div>
    </div>
  );
}
