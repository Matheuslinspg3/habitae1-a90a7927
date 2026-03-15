/**
 * AI Token Billing — Type definitions
 */

export interface TokenUsageEvent {
  id?: string;
  user_id: string;
  organization_id?: string;
  request_id?: string;
  provider: string;
  model: string;
  function_name?: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens?: number;
  estimated_provider_cost: number;
  markup_percentage: number;
  simulated_bill_amount?: number;
  currency: string;
  request_status: string;
  error_message?: string;
  stripe_meter_event_id?: string;
  stripe_sync_status?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface PricingConfig {
  id?: string;
  provider: string;
  model: string;
  price_per_1k_input_tokens: number;
  price_per_1k_output_tokens: number;
  markup_percentage: number;
  fixed_margin: number;
  currency: string;
  is_active: boolean;
  updated_at?: string;
}

export interface BillingConfig {
  id: string;
  billing_enabled: boolean;
  sandbox_mode: boolean;
  default_markup_percentage: number;
  default_currency: string;
  stripe_test_mode: boolean;
  stripe_webhook_secret?: string;
  updated_at?: string;
}

export interface BillingInvoice {
  id: string;
  user_id: string;
  organization_id?: string;
  period_start: string;
  period_end: string;
  total_tokens: number;
  total_requests: number;
  total_provider_cost: number;
  total_billed_amount: number;
  currency: string;
  stripe_invoice_id?: string;
  status: string;
  created_at: string;
}

export interface CostCalculation {
  provider_cost: number;
  markup_amount: number;
  fixed_margin: number;
  total_billed: number;
  currency: string;
}

export interface UsageAggregation {
  total_requests: number;
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_provider_cost: number;
  total_billed_amount: number;
  success_rate: number;
}
