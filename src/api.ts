import type { Customer, OrchestrationResult } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function fetchCustomers(): Promise<{ customers: Customer[] }> {
  return request("/api/customers");
}

export function repay(customerId: string, amount: number, currency = "SAR"): Promise<OrchestrationResult> {
  return request("/api/rpm/repay", {
    method: "POST",
    body: JSON.stringify({ customer_id: customerId, amount, currency }),
  });
}

export function resetDemo(): Promise<{ status: string; customers: Customer[] }> {
  return request("/api/admin/reset", { method: "POST" });
}

export function fetchDecisions(): Promise<{ decisions: OrchestrationResult[] }> {
  return request("/api/decisions");
}
