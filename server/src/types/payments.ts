export interface SetupIntentResponse {
  client_secret: string;
}

export interface SavePaymentMethodBody {
  setup_intent_id?: string;
}

export interface PaymentMethodSummary {
  has_payment_method: boolean;
  card_brand: string | null;
  card_last4: string | null;
}

export interface UserBillingRow {
  stripe_customer_id: string | null;
  default_payment_method_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  email: string;
  display_name: string;
}
