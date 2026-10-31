import { useCallback, useEffect, useMemo, useState } from "react";
import {
  checkout,
  fetchCustomers,
  fetchDecisions,
  fetchInstallments,
  fetchOrders,
  fetchProducts,
  payInstallment,
  resetDemo,
} from "./api";
import { PaymentStory } from "./PaymentStory";
import type {
  Customer,
  Installment,
  OrchestrationResult,
  Order,
  Product,
  Tab,
} from "./types";

function money(currency: string, amount: number) {
  return `${currency} ${amount.toFixed(2)}`;
}

function statusClass(status: string) {
  return `tag tag-${status}`;
}

function actionClass(action: string) {
  return `tag tag-${action}`;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("shop");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [history, setHistory] = useState<OrchestrationResult[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [payTarget, setPayTarget] = useState<Installment | null>(null);
  const [plan, setPlan] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<OrchestrationResult | null>(null);
  const [showStory, setShowStory] = useState(false);
  const [storySteps, setStorySteps] = useState(0);

  const customer = useMemo(
    () => customers.find((c) => c.customer_id === customerId) ?? null,
    [customers, customerId],
  );

  const otherOverdueIfPay = useMemo(() => {
    if (!payTarget) return 0;
    return installments
      .filter(
        (i) =>
          i.installment_id !== payTarget.installment_id &&
          (i.status === "due" || i.status === "overdue"),
      )
      .reduce((sum, i) => sum + i.amount, 0);
  }, [payTarget, installments]);

  const load = useCallback(async (selected?: string) => {
    const activeId = selected ?? customerId;
    const [{ customers: list }, { products: catalog }, { decisions }] = await Promise.all([
      fetchCustomers(),
      fetchProducts(),
      fetchDecisions(),
    ]);
    setCustomers(list);
    setProducts(catalog);
    setHistory(decisions);

    const nextId =
      activeId && list.some((c) => c.customer_id === activeId)
        ? activeId
        : (list[0]?.customer_id ?? "");
    setCustomerId(nextId);

    if (nextId) {
      const [{ orders: orderList }, { installments: installmentList }] = await Promise.all([
        fetchOrders(nextId),
        fetchInstallments(nextId),
      ]);
      setOrders(orderList);
      setInstallments(installmentList);
    } else {
      setOrders([]);
      setInstallments([]);
    }
  }, [customerId]);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!showStory || !lastResult) return;
    setStorySteps(0);
    const timers = [1, 2, 3, 4].map((step, index) =>
      window.setTimeout(() => setStorySteps(step), 450 + index * 700),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [showStory, lastResult?.event_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onCustomerChange(id: string) {
    setCustomerId(id);
    setError(null);
    try {
      const [{ orders: orderList }, { installments: installmentList }, { customers: list }] =
        await Promise.all([fetchOrders(id), fetchInstallments(id), fetchCustomers()]);
      setCustomers(list);
      setOrders(orderList);
      setInstallments(installmentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customer");
    }
  }

  async function confirmCheckout() {
    if (!customer || !selectedProduct) return;
    setLoading(true);
    setError(null);
    try {
      const result = await checkout(customer.customer_id, selectedProduct.product_id, plan);
      setSelectedProduct(null);
      setToast(result.message);
      setTab("payments");
      await load(customer.customer_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  async function confirmPay() {
    if (!customer || !payTarget) return;
    setLoading(true);
    setError(null);
    try {
      const result = await payInstallment(payTarget.installment_id, customer.customer_id);
      setPayTarget(null);
      setLastResult(result);
      setShowStory(true);
      setTab("activity");
      await load(customer.customer_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  }

  async function onReset() {
    setLoading(true);
    setError(null);
    try {
      await resetDemo();
      setLastResult(null);
      setSelectedProduct(null);
      setPayTarget(null);
      setShowStory(false);
      setToast("Demo data reset");
      await load("");
      setTab("shop");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  const overdueCount = installments.filter((i) => i.status === "overdue" || i.status === "due").length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo-mark" aria-hidden />
          <div>
            <h1>Tamara</h1>
            <p>Collectus · Smart Autocharge demo</p>
          </div>
        </div>
        <div className="top-actions">
          <select
            className="customer-select"
            value={customerId}
            onChange={(e) => onCustomerChange(e.target.value)}
            aria-label="Demo customer"
          >
            {customers.map((c) => (
              <option key={c.customer_id} value={c.customer_id}>
                {c.name} · {c.scenario.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <button type="button" className="ghost" onClick={onReset} disabled={loading}>
            Reset demo
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Main">
        {(
          [
            ["shop", "Shop"],
            ["payments", "My payments"],
            ["activity", "How Smart Autocharge works"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="hero-strip">
        <div className="hero-card">
          <h2>Own your dream. Pay your way.</h2>
          <p>
            Shop in installments like Tamara. When you repay, AI decides whether Autopay should
            also collect other overdue — that’s Smart Autocharge.
          </p>
          <div className="pill-row">
            <span className="pill">Sharia compliant</span>
            <span className="pill">No late fees</span>
            <span className="pill">AI decides Autopay</span>
          </div>
        </div>
        <div className="panel stat-card">
          <h3>Customer snapshot</h3>
          {customer ? (
            <div className="stat-grid">
              <div className="stat">
                <strong>{money(customer.currency, customer.overdue_amount)}</strong>
                <span>Overdue balance</span>
              </div>
              <div className="stat">
                <strong>{overdueCount}</strong>
                <span>Due / overdue items</span>
              </div>
              <div className="stat">
                <strong>{customer.pm_health.toFixed(2)}</strong>
                <span>Payment method health</span>
              </div>
              <div className="stat">
                <strong>{customer.fails_7d}</strong>
                <span>Fails (7d)</span>
              </div>
            </div>
          ) : (
            <p className="muted">Loading customer…</p>
          )}
          {customer ? <p className="muted">{customer.notes}</p> : null}
        </div>
      </section>

      {error ? <p className="error">{error}</p> : null}

      {tab === "shop" ? (
        <section className="panel">
          <div className="panel-head">
            <h2 className="section-title">Shop partner stores</h2>
            <p className="muted">Split any purchase · first payment due today</p>
          </div>
          <div className="product-grid">
            {products.map((product) => {
              const perMonth = product.price / 4;
              return (
                <article key={product.product_id} className="product-card">
                  <div
                    className="product-visual"
                    style={{
                      background: `linear-gradient(145deg, ${product.accent}, #5300ba)`,
                    }}
                  >
                    {product.badge ? <span className="badge">{product.badge}</span> : null}
                    {product.category}
                  </div>
                  <div className="product-body">
                    <span className="merchant">{product.merchant}</span>
                    <strong>{product.name}</strong>
                    <p className="muted">{product.description}</p>
                    <div className="price">{money(product.currency, product.price)}</div>
                    <div className="split-hint">
                      or {money(product.currency, perMonth)}/mo · Pay in 4
                    </div>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        setSelectedProduct(product);
                        setPlan(4);
                      }}
                    >
                      Buy with Tamara
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "payments" ? (
        <section className="panel">
          <div className="explain-banner">
            <div>
              <strong>How Pay now triggers Smart Autocharge</strong>
              <p>
                <span>1</span> You pay one installment (your choice)
                <span>2</span> That creates a repayment event
                <span>3</span> AI checks if other overdue should be autocharged
                <span>4</span> Autopay runs only if AI says yes
              </p>
            </div>
            <p className="muted tip">
              Tip: pay an <strong>overdue</strong> item for Aisha (charge) or Omar (skip) to see AI
              clearly.
            </p>
          </div>

          <div className="panel-head">
            <h2 className="section-title">My payments</h2>
            <p className="muted">Upcoming, due, and overdue installments by purchase</p>
          </div>
          {orders.length === 0 ? (
            <p className="muted">No purchases yet — grab something from Shop.</p>
          ) : (
            <div className="order-list">
              {orders.map((order) => (
                <article key={order.order_id} className="order-card">
                  <div className="order-head">
                    <div>
                      <div className="merchant">{order.merchant}</div>
                      <strong>{order.product_name}</strong>
                      <div className="muted">
                        {order.plan} payments · total {money(order.currency, order.total_amount)}
                      </div>
                    </div>
                  </div>
                  <div className="timeline">
                    {order.installments.map((inst) => (
                      <div key={inst.installment_id} className={`inst-row ${inst.status}`}>
                        <div>
                          <strong>
                            Payment {inst.sequence}/{inst.plan_size}
                          </strong>
                          <div className="muted">Due {inst.due_date}</div>
                        </div>
                        <div>
                          <span className={statusClass(inst.status)}>{inst.status}</span>
                          <div className="muted">{money(inst.currency, inst.amount)}</div>
                        </div>
                        {inst.status !== "paid" ? (
                          <button
                            type="button"
                            className="pay-btn"
                            disabled={loading}
                            onClick={() => setPayTarget(inst)}
                          >
                            Pay now
                          </button>
                        ) : (
                          <span className="muted">Paid</span>
                        )}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === "activity" ? (
        <>
          <section className="panel">
            <div className="panel-head">
              <h2 className="section-title">AI’s role in one sentence</h2>
            </div>
            <p className="role-line">
              After you repay, <strong>AI is the decision brain</strong> between “customer was
              active” and “Autopay may charge other overdue.” Without AI we would always charge —
              which is aggressive and wasteful.
            </p>
            {!lastResult ? (
              <p className="muted">
                Pay a due/overdue installment in <strong>My payments</strong> to see the live
                story.
              </p>
            ) : (
              <button type="button" className="ghost" onClick={() => setShowStory(true)}>
                Replay last payment story
              </button>
            )}
          </section>

          {lastResult ? (
            <section className="panel">
              <div className="panel-head">
                <h2 className="section-title">Latest result</h2>
                <p className="muted">Your pay vs what AI told Autopay to do</p>
              </div>
              <div className="compare">
                <div className="compare-card">
                  <h3>You paid (RPM)</h3>
                  <p className="score">{money(lastResult.currency, lastResult.amount_paid)}</p>
                  <p className="muted">Voluntary installment repayment — always happens first.</p>
                </div>
                <div className="compare-card smart">
                  <h3>AI → Autopay</h3>
                  <span className={actionClass(lastResult.decision.action)}>
                    {lastResult.decision.action}
                  </span>
                  <div className="score">{lastResult.decision.score.toFixed(2)}</div>
                  <p>{lastResult.decision.reason}</p>
                  <p className="muted">
                    Other overdue {lastResult.overdue_before.toFixed(2)} →{" "}
                    {lastResult.overdue_after.toFixed(2)} · {lastResult.autopay?.message}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="panel">
            <h2 className="section-title">Activity log</h2>
            {history.length === 0 ? (
              <p className="muted">No smart decisions yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>You paid</th>
                    <th>AI said</th>
                    <th>Score</th>
                    <th>Autopay</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.event_id}>
                      <td>{row.customer_name}</td>
                      <td>{money(row.currency, row.amount_paid)}</td>
                      <td>
                        <span className={actionClass(row.decision.action)}>
                          {row.decision.action}
                        </span>
                      </td>
                      <td>{row.decision.score.toFixed(2)}</td>
                      <td>{row.autopay?.status ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : null}

      {selectedProduct && customer ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedProduct(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedProduct.name}</h3>
            <p className="muted">
              {selectedProduct.merchant} · {money(selectedProduct.currency, selectedProduct.price)}
            </p>
            <div className="trust-row">
              <span className="trust">Sharia compliant</span>
              <span className="trust">No late fees</span>
              <span className="trust">Buyer protection</span>
            </div>
            <p className="muted">Choose your plan — pay the first installment today.</p>
            <div className="plan-options">
              {[3, 4].map((n) => {
                const installment = selectedProduct.price / n;
                return (
                  <button
                    key={n}
                    type="button"
                    className={`plan-option ${plan === n ? "active" : ""}`}
                    onClick={() => setPlan(n)}
                  >
                    <strong>Pay in {n}</strong>
                    <span className="muted">
                      {money(selectedProduct.currency, installment)} today, then {n - 1} more
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setSelectedProduct(null)}>
                Cancel
              </button>
              <button type="button" className="primary" disabled={loading} onClick={confirmCheckout}>
                {loading
                  ? "Processing…"
                  : `Pay ${money(selectedProduct.currency, selectedProduct.price / plan)} now`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {payTarget && customer ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setPayTarget(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <p className="story-kicker">Before you pay</p>
            <h3>
              Pay installment {payTarget.sequence}/{payTarget.plan_size}
            </h3>
            <p className="muted">
              {payTarget.product_name} · {money(payTarget.currency, payTarget.amount)} ·{" "}
              <span className={statusClass(payTarget.status)}>{payTarget.status}</span>
            </p>

            <div className="prepay-flow">
              <div className="prepay-step">
                <strong>A. Your payment</strong>
                <p>We collect this installment now (RPM repayment).</p>
              </div>
              <div className="prepay-step ai">
                <strong>B. AI decision</strong>
                <p>
                  AI then reviews <strong>other overdue</strong> still open
                  {otherOverdueIfPay > 0
                    ? ` (${money(payTarget.currency, otherOverdueIfPay)})`
                    : " (none right now)"}
                  .
                </p>
              </div>
              <div className="prepay-step">
                <strong>C. Autopay</strong>
                <p>
                  Only if AI says charge/partial, Autopay hits the saved card for that extra
                  overdue — not for the installment you just chose to pay.
                </p>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setPayTarget(null)}>
                Cancel
              </button>
              <button type="button" className="primary" disabled={loading} onClick={confirmPay}>
                {loading ? "Running Smart Autocharge…" : "Confirm pay & run AI"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showStory && lastResult ? (
        <PaymentStory
          result={lastResult}
          visibleSteps={storySteps}
          onClose={() => {
            setShowStory(false);
            setTab("payments");
          }}
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
