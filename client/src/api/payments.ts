import { request } from './client';
import type { PaymentMethodSummary, SetupIntentResponse } from '../types/payments';

export function getPaymentMethod(): Promise<PaymentMethodSummary> {
  return request<PaymentMethodSummary>('/api/payments/method');
}

export function createSetupIntent(): Promise<SetupIntentResponse> {
  return request<SetupIntentResponse>('/api/payments/setup-intent', { method: 'POST' });
}

export function savePaymentMethod(setupIntentId: string): Promise<PaymentMethodSummary> {
  return request<PaymentMethodSummary>('/api/payments/payment-method', {
    method: 'POST',
    body: JSON.stringify({ setup_intent_id: setupIntentId }),
  });
}
