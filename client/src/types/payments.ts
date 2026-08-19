export interface PaymentMethodSummary {
  has_payment_method: boolean;
  card_brand: string | null;
  card_last4: string | null;
}

export interface SetupIntentResponse {
  client_secret: string;
}
