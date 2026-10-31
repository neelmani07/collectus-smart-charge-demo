export type DecisionAction = "charge" | "partial" | "skip";

export interface Customer {
  customer_id: string;
  name: string;
  overdue_amount: number;
  days_overdue: number;
  pm_health: number;
  fails_7d: number;
  recent_success: number;
  currency: string;
  scenario: string;
  notes: string;
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
}

export interface OrchestrationResult {
  event_id: string;
  customer_id: string;
  customer_name: string;
  scenario: string;
  amount_paid: number;
  overdue_before: number;
  currency: string;
  decision: Decision;
  autopay: AutopayResult | null;
  overdue_after: number;
  created_at: string;
}
