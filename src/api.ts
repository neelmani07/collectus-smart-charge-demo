import type {
  CheckoutResult,
  CronRunResult,
  Customer,
  ManualPayResult,
  Order,
  PaymentDetail,
  PaymentHistoryItem,
  Product,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export const fetchCustomers = () => request<{ customers: Customer[] }>("/api/customers");
export const fetchCustomer = (customerId: string) =>
  request<Customer>(`/api/customers/${customerId}`);
export const fetchProducts = () => request<{ products: Product[] }>("/api/products");
export const fetchOrders = (customerId: string) =>
  request<{ orders: Order[] }>(`/api/customers/${customerId}/orders`);
export const fetchPaymentHistory = (customerId: string) =>
  request<{ history: PaymentHistoryItem[] }>(`/api/customers/${customerId}/payment-history`);
export const fetchPaymentDetail = (eventId: string) =>
  request<PaymentDetail>(`/api/payment-events/${eventId}`);

export const checkout = (customerId: string, productId: string, plan: number) =>
  request<CheckoutResult>("/api/checkout", {
    method: "POST",
    body: JSON.stringify({ customer_id: customerId, product_id: productId, plan }),
  });

export const payInstallment = (installmentId: string, customerId: string) =>
  request<ManualPayResult>(`/api/installments/${installmentId}/pay`, {
    method: "POST",
    body: JSON.stringify({ customer_id: customerId }),
  });

export const runCollectionsCron = (customerId?: string, scheduledFor = "09:00") =>
  request<CronRunResult>("/api/cron/collections", {
    method: "POST",
    body: JSON.stringify({
      customer_id: customerId ?? null,
      scheduled_for: scheduledFor,
    }),
  });

export const resetDemo = () =>
  request<{ status: string }>("/api/admin/reset", { method: "POST" });
