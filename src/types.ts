export type DecisionAction = "charge" | "partial" | "skip";
export type InstallmentStatus = "paid" | "upcoming" | "due" | "overdue";
export type Tab = "shop" | "payments" | "history";
export type PaymentType = "manual_repayment" | "normal_autocharge" | "smart_autocharge";

export interface Customer {
  customer_id: string;
  name: string;
  pm_health: number;
  fails_7d: number;
  recent_success: number;
  currency: string;
  scenario: string;
  notes: string;
  overdue_amount: number;
  days_overdue: number;
}

export interface Product {
  product_id: string;
  name: string;
  merchant: string;
  category: string;
  price: number;
  currency: string;
  badge: string;
  accent: string;
  description: string;
}

export interface Installment {
  installment_id: string;
  order_id: string;
  customer_id: string;
  product_name: string;
  merchant: string;
  sequence: number;
  plan_size: number;
  amount: number;
  currency: string;
  due_date: string;
  status: InstallmentStatus;
  paid_at: string | null;
}

export interface Order {
  order_id: string;
  customer_id: string;
  product_id: string;
  product_name: string;
  merchant: string;
  total_amount: number;
  currency: string;
  plan: number;
  created_at: string;
  accent: string;
  installments: Installment[];
}

export interface CheckoutResult {
  order: Order;
  first_payment_amount: number;
  message: string;
}

export interface Decision {
  action: DecisionAction;
  amount: number;
  score: number;
  reason: string;
  baseline_action: DecisionAction;
  source: string;
}

export interface AutopayResult {
  status: string;
  transaction_id: string | null;
  message: string;
  installments_settled: string[];
}

export interface OrchestrationResult {
  event_id: string;
  customer_id: string;
  customer_name: string;
  scenario: string;
  amount_paid: number;
  paid_installment_id: string | null;
  overdue_before: number;
  currency: string;
  decision: Decision;
  autopay: AutopayResult | null;
  overdue_after: number;
  created_at: string;
  order_snapshot: Order | null;
}

export interface PaymentHistoryItem {
  history_id: string;
  event_id: string | null;
  customer_id: string;
  payment_type: PaymentType;
  title: string;
  amount: number;
  currency: string;
  status: string;
  product_name: string;
  merchant: string;
  installment_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface PaymentDetail {
  event_id: string;
  history: PaymentHistoryItem[];
  orchestration: OrchestrationResult | null;
}
