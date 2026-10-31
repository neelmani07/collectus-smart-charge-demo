import { useCallback, useEffect, useMemo, useState } from "react";
import {
  checkout,
  fetchCustomer,
  fetchCustomers,
  fetchOrders,
  fetchPaymentDetail,
  fetchPaymentHistory,
  fetchProducts,
  payInstallment,
  resetDemo,
  runCollectionsCron,
} from "./api";
import { PaymentStory } from "./PaymentStory";
import type {
  Customer,
  Installment,
  Order,
  PaymentDetail,
  PaymentHistoryItem,
  PaymentType,
  Product,
  Tab,
} from "./types";

const SESSION_KEY = "collectus_customer_id";

function money(currency: string, amount: number) {
  return `${currency} ${amount.toFixed(2)}`;
}

function statusClass(status: string) {
  return `tag tag-${status}`;
}

function typeLabel(type: PaymentType) {
  if (type === "manual_repayment") return "Manual repayment";
  if (type === "normal_autocharge") return "Normal autocharge";
  return "Smart autocharge";
}

function typeClass(type: PaymentType) {
  return `tag tag-type-${type}`;
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function App() {
  const [accounts, setAccounts] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tab, setTab] = useState<Tab>("shop");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [plan, setPlan] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [storySteps, setStorySteps] = useState(0);
  const [historyFilter, setHistoryFilter] = useState<"all" | PaymentType>("all");
  const [booting, setBooting] = useState(true);

  const filteredHistory = useMemo(() => {
    if (historyFilter === "all") return history;
    return history.filter((h) => h.payment_type === historyFilter);
  }, [history, historyFilter]);

  const loadAccountData = useCallback(async (customerId: string) => {
    const [me, { products: catalog }, { orders: orderList }, { history: paymentHistory }] =
      await Promise.all([
        fetchCustomer(customerId),
        fetchProducts(),
        fetchOrders(customerId),
        fetchPaymentHistory(customerId),
      ]);
    setCustomer(me);
    setProducts(catalog);
    setOrders(orderList);
    setHistory(paymentHistory);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { customers } = await fetchCustomers();
        setAccounts(customers);
        const saved = window.sessionStorage.getItem(SESSION_KEY);
        if (saved && customers.some((c) => c.customer_id === saved)) {
          await loadAccountData(saved);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start");
      } finally {
        setBooting(false);
      }
    })();
  }, [loadAccountData]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!detail) return;
    setStorySteps(0);
    const max = detail.history.some((h) => h.payment_type === "smart_autocharge") ? 4 : 2;
    const timers = Array.from({ length: max }, (_, index) =>
      window.setTimeout(() => setStorySteps(index + 1), 300 + index * 500),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [detail?.event_id]);

  async function loginAs(customerId: string) {
    setLoading(true);
    setError(null);
    try {
      window.sessionStorage.setItem(SESSION_KEY, customerId);
      await loadAccountData(customerId);
      setTab("shop");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    window.sessionStorage.removeItem(SESSION_KEY);
    setCustomer(null);
    setOrders([]);
    setHistory([]);
    setProducts([]);
    setDetail(null);
    setSelectedProduct(null);
    setError(null);
  }

  async function confirmCheckout() {
    if (!customer || !selectedProduct) return;
    setLoading(true);
    setError(null);
    try {
      const result = await checkout(customer.customer_id, selectedProduct.product_id, plan);
      setSelectedProduct(null);
      setToast(`Paid ${money(result.order.currency, result.first_payment_amount)}`);
      setTab("payments");
      await loadAccountData(customer.customer_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  async function onPay(inst: Installment) {
    if (!customer) return;
    setLoading(true);
    setError(null);
    try {
      const result = await payInstallment(inst.installment_id, customer.customer_id);
      setToast(result.message);
      await loadAccountData(customer.customer_id);
      setTab("history");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  }

  async function openDetails(eventId: string | null) {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchPaymentDetail(eventId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load details");
    } finally {
      setLoading(false);
    }
  }

  async function onRunCron() {
    if (!customer) return;
    setLoading(true);
    setError(null);
    try {
      // Only run cron for the logged-in customer — never leak other accounts into this session
      const result = await runCollectionsCron(customer.customer_id, "09:00");
      setToast(result.message);
      await loadAccountData(customer.customer_id);
      setTab("history");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cron failed");
    } finally {
      setLoading(false);
    }
  }

  async function onReset() {
    if (!customer) return;
    setLoading(true);
    setError(null);
    try {
      await resetDemo();
      const { customers } = await fetchCustomers();
      setAccounts(customers);
      await loadAccountData(customer.customer_id);
      setToast("Demo data reset");
      setTab("shop");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  if (booting) {
    return (
      <div className="app">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="app">
        <section className="login-shell">
          <div className="login-card">
            <div className="brand login-brand">
              <div className="logo-mark" aria-hidden />
              <div>
                <h1>Tamara</h1>
                <p>Sign in to your account</p>
              </div>
            </div>
            <p className="muted login-copy">
              Choose your account. After login you’ll only see your own purchases and payments.
            </p>
            {error ? <p className="error">{error}</p> : null}
            <div className="account-list">
              {accounts.map((account) => (
                <button
                  key={account.customer_id}
                  type="button"
                  className="account-btn"
                  disabled={loading}
                  onClick={() => loginAs(account.customer_id)}
                >
                  <strong>{account.name}</strong>
                  <span className="muted">Continue</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const overdueCount = orders
    .flatMap((o) => o.installments)
    .filter((i) => i.status === "overdue" || i.status === "due").length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo-mark" aria-hidden />
          <div>
            <h1>Tamara</h1>
            <p>Hi, {customer.name}</p>
          </div>
        </div>
        <div className="top-actions">
          <button type="button" className="ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Main">
        {(
          [
            ["shop", "Shop"],
            ["payments", "My payments"],
            ["history", "Payment history"],
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
            Pay your installments anytime. Autopay only runs in the daily collections window —
            Smart Autocharge decides then, not when you repay.
          </p>
          <div className="pill-row">
            <span className="pill">Sharia compliant</span>
            <span className="pill">No late fees</span>
            <span className="pill">Cron Autopay</span>
          </div>
        </div>
        <div className="panel stat-card">
          <h3>Your snapshot</h3>
          <div className="stat-grid">
            <div className="stat">
              <strong>{money(customer.currency, customer.overdue_amount)}</strong>
              <span>Overdue balance</span>
            </div>
            <div className="stat">
              <strong>{overdueCount}</strong>
              <span>Due / overdue</span>
            </div>
            <div className="stat">
              <strong>{orders.length}</strong>
              <span>Purchases</span>
            </div>
            <div className="stat">
              <strong>{history.length}</strong>
              <span>History</span>
            </div>
          </div>
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
          <div className="panel-head">
            <h2 className="section-title">My payments</h2>
            <p className="muted">Pay your installment only</p>
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
                            onClick={() => onPay(inst)}
                          >
                            Pay {money(inst.currency, inst.amount)}
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

      {tab === "history" ? (
        <section className="panel">
          <div className="panel-head">
            <h2 className="section-title">Payment history</h2>
            <div className="history-actions">
              <button type="button" className="ghost" disabled={loading} onClick={onRunCron}>
                Simulate 09:00 cron
              </button>
              <button type="button" className="ghost" disabled={loading} onClick={onReset}>
                Reset demo
              </button>
            </div>
          </div>
          <p className="muted cron-hint">
            Autopay runs on the daily collections cron (demo: button above). Manual repayments never
            trigger Autopay.
          </p>

          <div className="history-filters">
            {(
              [
                ["all", "All"],
                ["manual_repayment", "Manual repayment"],
                ["smart_autocharge", "Smart autocharge"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`chip ${historyFilter === id ? "active" : ""}`}
                onClick={() => setHistoryFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredHistory.length === 0 ? (
            <p className="muted">No payments yet.</p>
          ) : (
            <div className="history-list">
              {filteredHistory.map((item) => (
                <article key={item.history_id} className="history-row">
                  <div className="history-main">
                    <div className="history-top">
                      <span className={typeClass(item.payment_type)}>
                        {typeLabel(item.payment_type)}
                      </span>
                      <span className="muted">{formatWhen(item.created_at)}</span>
                    </div>
                    <strong>{item.title}</strong>
                    <div className="muted">
                      {item.product_name ? `${item.merchant} · ${item.product_name} · ` : ""}
                      {item.status.replaceAll("_", " ")}
                    </div>
                  </div>
                  <div className="history-side">
                    <div className="history-amount">{money(item.currency, item.amount)}</div>
                    {item.event_id ? (
                      <button
                        type="button"
                        className="icon-detail"
                        aria-label="View payment details"
                        title="View details"
                        disabled={loading}
                        onClick={() => openDetails(item.event_id)}
                      >
                        i
                      </button>
                    ) : (
                      <span className="icon-detail disabled">i</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {selectedProduct ? (
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

      {detail ? (
        <PaymentStory detail={detail} visibleSteps={storySteps} onClose={() => setDetail(null)} />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
