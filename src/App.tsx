import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCustomers, fetchDecisions, repay, resetDemo } from "./api";
import type { Customer, OrchestrationResult } from "./types";

const SUGGESTED_AMOUNTS: Record<string, number> = {
  clear_charge: 400,
  clear_skip: 120,
  partial: 280,
};

function actionClass(action: string): string {
  if (action === "charge") return "tag tag-charge";
  if (action === "partial") return "tag tag-partial";
  return "tag tag-skip";
}

export default function App() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [amount, setAmount] = useState<number>(400);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrchestrationResult | null>(null);
  const [history, setHistory] = useState<OrchestrationResult[]>([]);

  const selected = useMemo(
    () => customers.find((c) => c.customer_id === selectedId) ?? null,
    [customers, selectedId],
  );

  const load = useCallback(async () => {
    const [{ customers: list }, { decisions }] = await Promise.all([
      fetchCustomers(),
      fetchDecisions(),
    ]);
    setCustomers(list);
    setHistory(decisions);
    if (!selectedId && list[0]) {
      setSelectedId(list[0].customer_id);
      setAmount(SUGGESTED_AMOUNTS[list[0].scenario] ?? 300);
    }
  }, [selectedId]);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    setAmount(SUGGESTED_AMOUNTS[selected.scenario] ?? Math.max(100, selected.overdue_amount));
  }, [selected]);

  async function onRepay() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const orchestration = await repay(selected.customer_id, amount, selected.currency);
      setResult(orchestration);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function onReset() {
    setLoading(true);
    setError(null);
    try {
      await resetDemo();
      setResult(null);
      setSelectedId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Collectus · Tamara AI Hackathon</p>
        <h1>Smart Autocharge</h1>
        <p className="lede">
          Customer repays → event fires → AI decides charge / skip / partial → Autopay runs.
          Cron is not the brain.
        </p>
      </header>

      <section className="panel scenarios">
        <div className="panel-head">
          <h2>Demo scenarios</h2>
          <button type="button" className="ghost" onClick={onReset} disabled={loading}>
            Reset seed data
          </button>
        </div>
        <div className="scenario-grid">
          {customers.map((customer) => (
            <button
              key={customer.customer_id}
              type="button"
              className={`scenario ${selectedId === customer.customer_id ? "active" : ""}`}
              onClick={() => setSelectedId(customer.customer_id)}
            >
              <span className="scenario-label">{customer.scenario.replaceAll("_", " ")}</span>
              <strong>{customer.name}</strong>
              <span>
                Overdue {customer.currency} {customer.overdue_amount.toFixed(2)} · {customer.days_overdue}d
              </span>
              <span className="muted">{customer.notes}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="layout">
        <div className="panel">
          <h2>1 · Simulate repayment</h2>
          {selected ? (
            <>
              <dl className="facts">
                <div>
                  <dt>Customer</dt>
                  <dd>{selected.name}</dd>
                </div>
                <div>
                  <dt>Overdue</dt>
                  <dd>
                    {selected.currency} {selected.overdue_amount.toFixed(2)}
                  </dd>
                </div>
                <div>
                  <dt>PM health</dt>
                  <dd>{selected.pm_health.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Fails (7d)</dt>
                  <dd>{selected.fails_7d}</dd>
                </div>
              </dl>
              <label className="field">
                Repayment amount ({selected.currency})
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </label>
              <button type="button" className="primary" onClick={onRepay} disabled={loading}>
                {loading ? "Running…" : "Trigger repayment → smart charge"}
              </button>
            </>
          ) : (
            <p className="muted">Loading customers…</p>
          )}
          {error ? <p className="error">{error}</p> : null}
        </div>

        <div className="panel">
          <h2>2 · AI decision vs baseline</h2>
          {result ? (
            <div className="compare">
              <div className="compare-card baseline">
                <h3>Always charge (baseline)</h3>
                <span className="tag tag-charge">charge</span>
                <p>
                  Would charge full overdue {result.currency} {result.overdue_before.toFixed(2)} on every
                  repayment event — no judgment.
                </p>
              </div>
              <div className="compare-card smart">
                <h3>Smart charge (ours)</h3>
                <span className={actionClass(result.decision.action)}>{result.decision.action}</span>
                <p className="score">Score {result.decision.score.toFixed(2)}</p>
                <p>{result.decision.reason}</p>
                <p className="muted">
                  Amount: {result.currency} {result.decision.amount.toFixed(2)} · source:{" "}
                  {result.decision.source}
                </p>
              </div>
            </div>
          ) : (
            <p className="muted">Run a repayment to see the decision side-by-side.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>3 · Autopay result</h2>
        {result?.autopay ? (
          <div className="result-row">
            <div>
              <span className={actionClass(result.decision.action)}>{result.autopay.status}</span>
              <p>{result.autopay.message}</p>
              {result.autopay.transaction_id ? (
                <p className="muted">tx: {result.autopay.transaction_id}</p>
              ) : null}
            </div>
            <div>
              <p>
                Overdue {result.overdue_before.toFixed(2)} → {result.overdue_after.toFixed(2)}{" "}
                {result.currency}
              </p>
              <p className="muted">event: {result.event_id}</p>
            </div>
          </div>
        ) : (
          <p className="muted">No autopay yet.</p>
        )}
      </section>

      <section className="panel">
        <h2>Audit log</h2>
        {history.length === 0 ? (
          <p className="muted">No decisions yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Action</th>
                <th>Score</th>
                <th>Amount</th>
                <th>Autopay</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.event_id}>
                  <td>{row.customer_name}</td>
                  <td>
                    <span className={actionClass(row.decision.action)}>{row.decision.action}</span>
                  </td>
                  <td>{row.decision.score.toFixed(2)}</td>
                  <td>
                    {row.currency} {row.decision.amount.toFixed(2)}
                  </td>
                  <td>{row.autopay?.status ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
