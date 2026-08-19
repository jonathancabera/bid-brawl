import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { AuthRequest } from '../types/auth';
import { getStripe } from '../stripe';
import { PaymentMethodSummary, SavePaymentMethodBody, UserBillingRow } from '../types/payments';

const router = Router();

async function loadBilling(userId: number): Promise<UserBillingRow | null> {
  const { rows } = await pool.query<UserBillingRow>(
    `SELECT stripe_customer_id, default_payment_method_id, card_brand, card_last4,
            email, display_name
       FROM users WHERE user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

router.get('/method', requireAuth, async (req, res) => {
  const { user_id } = (req as AuthRequest).user;

  try {
    const billing = await loadBilling(user_id);
    if (!billing) {
      return res.status(404).json({ error: 'user not found' });
    }

    const summary: PaymentMethodSummary = {
      has_payment_method: billing.default_payment_method_id !== null,
      card_brand: billing.card_brand,
      card_last4: billing.card_last4,
    };
    return res.status(200).json(summary);
  } catch (err) {
    console.error('payment method lookup error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/setup-intent', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    console.error('setup-intent error: STRIPE_SECRET_KEY not configured');
    return res.status(500).json({ error: 'server misconfiguration' });
  }

  const { user_id } = (req as AuthRequest).user;

  try {
    const billing = await loadBilling(user_id);
    if (!billing) {
      return res.status(404).json({ error: 'user not found' });
    }

    let customerId = billing.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: billing.email,
        name: billing.display_name,
        metadata: { user_id: String(user_id) },
      });

      const claimed = await pool.query<{ stripe_customer_id: string }>(
        `UPDATE users SET stripe_customer_id = $1
          WHERE user_id = $2 AND stripe_customer_id IS NULL
      RETURNING stripe_customer_id`,
        [customer.id, user_id],
      );

      customerId =
        claimed.rows[0]?.stripe_customer_id ?? (await loadBilling(user_id))!.stripe_customer_id;
    }

    const intent = await stripe.setupIntents.create({
      customer: customerId!,
      usage: 'off_session',
      payment_method_types: ['card'],
    });

    return res.status(200).json({ client_secret: intent.client_secret });
  } catch (err) {
    console.error('setup-intent error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/payment-method', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    console.error('save payment method error: STRIPE_SECRET_KEY not configured');
    return res.status(500).json({ error: 'server misconfiguration' });
  }

  const { setup_intent_id } = req.body as SavePaymentMethodBody;
  if (!setup_intent_id) {
    return res.status(400).json({ error: 'setup_intent_id is required' });
  }

  const { user_id } = (req as AuthRequest).user;

  try {
    const billing = await loadBilling(user_id);
    if (!billing?.stripe_customer_id) {
      return res.status(409).json({ error: 'no billing profile for this user' });
    }

    const intent = await stripe.setupIntents.retrieve(setup_intent_id, {
      expand: ['payment_method'],
    });

    const intentCustomer =
      typeof intent.customer === 'string' ? intent.customer : (intent.customer?.id ?? null);
    if (intentCustomer !== billing.stripe_customer_id) {
      return res.status(403).json({ error: 'setup intent does not belong to this user' });
    }
    if (intent.status !== 'succeeded') {
      return res.status(409).json({ error: `setup intent is ${intent.status}, not succeeded` });
    }

    const method = intent.payment_method;
    if (!method || typeof method === 'string') {
      return res.status(409).json({ error: 'setup intent has no payment method attached' });
    }

    await stripe.customers.update(billing.stripe_customer_id, {
      invoice_settings: { default_payment_method: method.id },
    });

    const brand = method.card?.brand ?? null;
    const last4 = method.card?.last4 ?? null;

    await pool.query(
      `UPDATE users
          SET default_payment_method_id = $1, card_brand = $2, card_last4 = $3
        WHERE user_id = $4`,
      [method.id, brand, last4, user_id],
    );

    const summary: PaymentMethodSummary = {
      has_payment_method: true,
      card_brand: brand,
      card_last4: last4,
    };
    return res.status(200).json(summary);
  } catch (err) {
    console.error('save payment method error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
