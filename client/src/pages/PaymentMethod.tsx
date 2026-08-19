import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { createSetupIntent, getPaymentMethod, savePaymentMethod } from '../api/payments';
import { getToken } from '../api/auth';
import { ApiError } from '../api/client';
import type { PaymentMethodSummary } from '../types/payments';

const PLACEHOLDER_KEY = 'pk_test_change_me';
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

// A placeholder key is worse than a missing one: Stripe.js loads, the element
// fails to authenticate, and the iframe silently tears itself down. Treat the
// .env.example value as unconfigured so it surfaces as a message instead.
const isStripeConfigured = Boolean(publishableKey) && publishableKey !== PLACEHOLDER_KEY;
const stripePromise = isStripeConfigured ? loadStripe(publishableKey as string) : null;

export default function PaymentMethodPage() {
  const isAuthed = getToken() !== null;

  const [summary, setSummary] = useState<PaymentMethodSummary | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  // Seeded from isAuthed so the effect never has to setState synchronously.
  const [loading, setLoading] = useState<boolean>(isAuthed);
  const [starting, setStarting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthed) return;

    let ignore = false;
    async function load() {
      try {
        const res = await getPaymentMethod();
        if (!ignore) setSummary(res);
      } catch (err) {
        if (!ignore) {
          setError(err instanceof ApiError ? err.message : 'something went wrong');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [isAuthed]);

  const handleSaved = useCallback((saved: PaymentMethodSummary) => {
    setSummary(saved);
    setClientSecret(null);
  }, []);

  const handleCancel = useCallback(() => setClientSecret(null), []);

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const res = await createSetupIntent();
      setClientSecret(res.client_secret);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'something went wrong');
    } finally {
      setStarting(false);
    }
  }

  if (!isAuthed) {
    return (
      <p>
        <Link to="/login">Log in</Link> to manage your payment method.
      </p>
    );
  }
  if (loading) {
    return <div>loading...</div>;
  }
  if (!stripePromise) {
    return (
      <p>
        Payments are not configured — set VITE_STRIPE_PUBLISHABLE_KEY in client/.env to your
        pk_test_ key from the Stripe dashboard, then restart the dev server.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-semibold">Payment method</h1>

      {summary?.has_payment_method ? (
        <p>
          Card on file: {summary.card_brand ?? 'card'} ending {summary.card_last4 ?? '****'}
        </p>
      ) : (
        <p>No card on file. You need one before you can place a bid.</p>
      )}

      {error && <p>{error}</p>}

      {clientSecret ? (
        <SetupForm clientSecret={clientSecret} onSaved={handleSaved} onCancel={handleCancel} />
      ) : (
        <button type="button" onClick={handleStart} disabled={starting}>
          {starting ? 'Loading...' : summary?.has_payment_method ? 'Replace card' : 'Add a card'}
        </button>
      )}
    </div>
  );
}

interface SetupFormProps {
  clientSecret: string;
  onSaved: (summary: PaymentMethodSummary) => void;
  onCancel: () => void;
}

// Elements lives in its own component with memoized options so the provider is
// created once. A fresh `{ clientSecret }` literal on every parent render makes
// react-stripe-js churn the element group underneath the mounted iframe.
function SetupForm({ clientSecret, onSaved, onCancel }: SetupFormProps) {
  const options = useMemo(() => ({ clientSecret }), [clientSecret]);

  return (
    <Elements stripe={stripePromise} options={options}>
      <CardSetupForm onSaved={onSaved} onCancel={onCancel} />
    </Elements>
  );
}

interface CardSetupFormProps {
  onSaved: (summary: PaymentMethodSummary) => void;
  onCancel: () => void;
}

function CardSetupForm({ onSaved, onCancel }: CardSetupFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);
    try {
      // redirect: 'if_required' keeps the whole flow on this page for cards; a
      // method that needs a redirect would send the user away and come back.
      const result = await stripe.confirmSetup({ elements, redirect: 'if_required' });

      if (result.error) {
        setError(result.error.message ?? 'could not save card');
        return;
      }
      if (!result.setupIntent) {
        setError('card setup did not complete');
        return;
      }

      // The server re-reads the intent from Stripe before trusting it.
      const saved = await savePaymentMethod(result.setupIntent.id);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <PaymentElement />
      {error && <p>{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={!stripe || submitting}>
          {submitting ? 'Saving...' : 'Save card'}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}
