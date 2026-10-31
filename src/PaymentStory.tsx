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
  const currency = manual?.currency ?? smart?.currency ?? "SAR";
  const isCron = Boolean(smart?.details?.trigger === "cron" || detail.orchestration?.trigger === "cron");
  const normalWould = Number(
    smart?.details?.normal_would_charge_amount ?? detail.orchestration?.overdue_before ?? 0,
  );

  const steps = isCron
    ? [
        {
          title: "1 · Collections cron window",
          body: (
            <>
              Scheduled collections ran at{" "}
              <strong>{String(smart?.details?.scheduled_for ?? detail.orchestration?.scheduled_for ?? "09:00")}</strong>
              . This is the only time Autopay is allowed to run — not right after a customer payment.
            </>
          ),
          meta: `event: ${detail.event_id.slice(0, 18)}…`,
        },
        {
          title: "2 · What normal autocharge would do",
          body: (
            <>
              Blind cron autocharge would attempt{" "}
              <strong>{money(currency, normalWould)}</strong> overdue with no AI check. It was{" "}
              <strong>not executed</strong> — Smart mode replaced it.
            </>
          ),
          meta: String(smart?.details?.normal_note ?? "Reference only"),
        },
        {
          title: "3 · Smart autocharge (AI decision)",
          body: smart ? (
            <>
              AI chose <strong>{String(smart.details.ai_action ?? "—")}</strong>
              {smart.details.ai_reason ? <> — {String(smart.details.ai_reason)}</> : null}
            </>
          ) : (
            <>No smart decision recorded.</>
          ),
          meta: smart
            ? `Score ${Number(smart.details.ai_score ?? 0).toFixed(2)}`
            : null,
          highlight: true,
        },
        {
          title: "4 · Autopay result",
          body: smart ? (
            smart.status === "succeeded" ? (
              <>
                Autopay charged <strong>{money(currency, smart.amount)}</strong>. Overdue{" "}
                {Number(smart.details.overdue_before ?? 0).toFixed(2)} →{" "}
                {Number(smart.details.overdue_after ?? 0).toFixed(2)}.
              </>
            ) : (
              <>
                Autopay did not collect extra ({smart.status.replaceAll("_", " ")}).
              </>
            )
          ) : (
            <>No Autopay result.</>
          ),
          meta: smart ? String(smart.details.autopay_message ?? smart.status) : null,
        },
      ]
    : [
        {
          title: "1 · Manual repayment",
          body: manual ? (
            <>
              You paid <strong>{money(currency, manual.amount)}</strong>
              {manual.product_name ? ` for ${manual.product_name}` : ""}. Autopay was{" "}
              <strong>not</strong> triggered by this payment.
            </>
          ) : (
            <>Manual repayment recorded.</>
          ),
          meta: manual ? `Status: ${manual.status}` : null,
        },
        {
          title: "2 · Activity noted",
          body: (
            <>
              Your repayment was saved as activity. Smart Autocharge only runs in the daily
              collections cron window (e.g. 09:00), not immediately after you pay.
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
        <h3>{isCron ? "Smart Autocharge (cron)" : "Manual repayment"}</h3>
        <p className="muted story-lede">
          {isCron
            ? "Autopay runs only on the scheduled collections window, gated by AI."
            : "This was your own installment payment only."}
        </p>

        {isCron ? (
          <div className="story-compare">
            <div className="mini-card">
              <span className="mini-label">Normal autocharge</span>
              <strong className={typeClass("normal_autocharge")}>Not executed</strong>
              <p>Would have charged {money(currency, normalWould)}</p>
            </div>
            <div className="mini-card smart">
              <span className="mini-label">Smart autocharge</span>
              <strong className={typeClass("smart_autocharge")}>
                {String(smart?.details.ai_action ?? smart?.status ?? "—")}
              </strong>
              <p>{String(smart?.details.ai_reason ?? "")}</p>
            </div>
          </div>
        ) : null}

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
