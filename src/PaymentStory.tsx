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
  const manual = detail.history.find((h) => h.payment_type === "manual_repayment") as
    | PaymentHistoryItem
    | undefined;
  const smart = detail.history.find((h) => h.payment_type === "smart_autocharge") as
    | PaymentHistoryItem
    | undefined;
  const normal = detail.history.find((h) => h.payment_type === "normal_autocharge") as
    | PaymentHistoryItem
    | undefined;

  const currency =
    manual?.currency ?? smart?.currency ?? normal?.currency ?? "SAR";

  const kind = smart ? "smart" : normal ? "normal" : "manual";

  const steps =
    kind === "smart"
      ? [
          {
            title: "1 · Repayment event",
            body: (
              <>
                A customer repayment published <code>repayment.succeeded</code>. That event wakes
                Smart Autocharge — not the daily cron.
              </>
            ),
            meta: smart?.details?.parent_repay_event_id
              ? `linked repay: ${String(smart.details.parent_repay_event_id).slice(0, 18)}…`
              : `event: ${detail.event_id.slice(0, 18)}…`,
          },
          {
            title: "2 · AI decision",
            body: (
              <>
                AI reviewed <strong>overdue only</strong> (never upcoming) and chose{" "}
                <strong>{String(smart?.details.ai_action ?? "—")}</strong>
                {smart?.details.ai_reason ? <> — {String(smart.details.ai_reason)}</> : null}.
              </>
            ),
            meta: `Score ${Number(smart?.details.ai_score ?? 0).toFixed(2)}`,
            highlight: true,
          },
          {
            title: "3 · Autopay",
            body:
              smart?.status === "succeeded" ? (
                <>
                  Autopay collected <strong>{money(currency, smart.amount)}</strong> from overdue
                  installments. Overdue {Number(smart.details.overdue_before ?? 0).toFixed(2)} →{" "}
                  {Number(smart.details.overdue_after ?? 0).toFixed(2)}.
                </>
              ) : (
                <>Autopay did not charge ({String(smart?.status ?? "").replaceAll("_", " ")}).</>
              ),
            meta: String(smart?.details.autopay_message ?? ""),
          },
        ]
      : kind === "normal"
        ? [
            {
              title: "1 · Scheduled cron",
              body: (
                <>
                  Daily collections cron ran at{" "}
                  <strong>{String(normal?.details.scheduled_for ?? "09:00")}</strong>. This is{" "}
                  <em>normal</em> autocharge — schedule-based, no AI.
                </>
              ),
              meta: `event: ${detail.event_id.slice(0, 18)}…`,
            },
            {
              title: "2 · Overdue only",
              body: (
                <>
                  System targeted <strong>overdue</strong> installments only — upcoming payments are
                  never autocharged.
                </>
              ),
              meta: `Overdue before: ${money(currency, Number(normal?.details.overdue_before ?? normal?.amount ?? 0))}`,
            },
            {
              title: "3 · Autopay",
              body:
                normal?.status === "succeeded" ? (
                  <>
                    Autopay charged <strong>{money(currency, normal.amount)}</strong> with no AI
                    gate.
                  </>
                ) : (
                  <>Autopay failed or skipped ({String(normal?.status).replaceAll("_", " ")}).</>
                ),
              meta: String(normal?.details.autopay_message ?? normal?.status ?? ""),
            },
          ]
        : [
            {
              title: "1 · Manual repayment",
              body: manual ? (
                <>
                  You paid <strong>{money(currency, manual.amount)}</strong>
                  {manual.product_name ? ` for ${manual.product_name}` : ""}.
                </>
              ) : (
                <>Manual repayment recorded.</>
              ),
              meta: manual ? `Status: ${manual.status}` : null,
            },
            {
              title: "2 · What happens next",
              body: (
                <>
                  If you still have <strong>overdue</strong> installments, Smart Autocharge may run
                  from this repayment event (AI + Autopay). Upcoming installments are never
                  autocharged. Normal autocharge only runs on the daily cron.
                </>
              ),
              meta: `event: ${detail.event_id.slice(0, 18)}…`,
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
        <h3>
          {kind === "smart"
            ? "Smart autocharge (event + AI)"
            : kind === "normal"
              ? "Normal autocharge (cron)"
              : "Manual repayment"}
        </h3>
        <p className="muted story-lede">
          {kind === "smart"
            ? "Triggered by a repayment event. AI decides; Autopay may collect overdue only."
            : kind === "normal"
              ? "Triggered by the daily schedule. No AI. Overdue only."
              : "Your own installment payment."}
        </p>

        {detail.history.length > 0 ? (
          <div className="type-legend">
            {detail.history.map((item) => (
              <div key={item.history_id} className="legend-row">
                <span className={typeClass(item.payment_type)}>{typeLabel(item.payment_type)}</span>
                <span>{money(item.currency, item.amount)}</span>
                <span className="muted">{item.status.replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
        ) : null}

        <ol className="story-steps">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className={`story-step ${index < visibleSteps ? "visible" : ""} ${"highlight" in step && step.highlight ? "ai" : ""}`}
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
