// api/create-checkout.js
// Vercel serverless function — crea un PaymentIntent de Stripe
//
// Variables de entorno necesarias (Vercel Dashboard → Settings → Environment Variables):
//   STRIPE_SECRET_KEY  →  sk_live_... (producción) o sk_test_... (pruebas)
//
// Instalar dependencia: npm install stripe

import Stripe from 'stripe';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey || !secretKey.startsWith('sk_')) {
        return res.status(500).json({ error: 'Stripe no configurado en el servidor' });
    }

    const { userId, email } = req.body || {};

    if (!userId || !email) {
        return res.status(400).json({ error: 'userId y email son requeridos' });
    }

    // Validación básica de email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
    }

    try {
        const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

        // Crear PaymentIntent por $129 USD
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 12900,           // en centavos → $129.00
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
            receipt_email: email,
            metadata: {
                supabase_user_id: userId,
                product: 'Trading Survivor Annual',
                plan: 'annual_129'
            },
            description: 'Trading Survivor — Suscripción Anual'
        });

        return res.status(200).json({ clientSecret: paymentIntent.client_secret });

    } catch (err) {
        console.error('[create-checkout] Stripe error:', err.message);
        return res.status(500).json({ error: 'Error al crear sesión de pago' });
    }
}
