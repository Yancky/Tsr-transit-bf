/**
 * TSR APP v1.0 — Serveur Full-Stack Express & Intégration Vite
 * Société de Transport TSR Transport (Burkina Faso)
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PaymentService } from './src/backend/payments/PaymentService';
import { ligdiCashProvider } from './src/backend/payments/LigdiCashProvider';
import { db } from './src/backend/mock-db';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// Middlewares pour parser le JSON et le form-urlencoded (requis par LigdiCash)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Validation des variables de configuration LigdiCash au démarrage
console.log('----------------------------------------------------');
console.log('🚌 TSR TRANSIT — Démarrage du serveur Express');
console.log(`Port d'écoute : ${PORT}`);
console.log(`Environnement LigdiCash : ${ligdiCashProvider.getEnvironment()}`);
console.log(`Clés API LigdiCash configurées : ${ligdiCashProvider.isConfigured() ? 'OUI' : 'NON (Mode Sandbox conforme)'}`);
console.log('----------------------------------------------------');

// =====================================================================
// ROUTES API PAIEMENT LIGDICASH
// =====================================================================

/**
 * 1. Initialisation d'une transaction Paylink LigdiCash
 * POST /api/payments/ligdicash/initiate
 */
app.post('/api/payments/ligdicash/initiate', async (req, res) => {
  try {
    const { bookingId, customerPhone, sessionToken, idempotencyKey } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Identifiant de réservation (bookingId) manquant.' },
      });
    }

    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

    const result = await PaymentService.initiateLigdiCashPayment(
      {
        bookingId,
        sessionToken: sessionToken || 'SESSION-CLIENT',
        customerPhone,
        customIdempotencyKey: idempotencyKey,
      },
      appUrl
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('[API /initiate] Erreur :', err.message);
    return res.status(400).json({
      success: false,
      error: { code: 'PAYMENT_INITIATION_FAILED', message: err.message },
    });
  }
});

/**
 * 2. Vérification et Confirmation officielle d'une transaction
 * POST /api/payments/ligdicash/confirm
 */
app.post('/api/payments/ligdicash/confirm', async (req, res) => {
  try {
    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'paymentId manquant.' },
      });
    }

    const result = await PaymentService.verifyAndConfirmPayment(paymentId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('[API /confirm] Erreur :', err.message);
    return res.status(400).json({
      success: false,
      error: { code: 'PAYMENT_CONFIRMATION_FAILED', message: err.message },
    });
  }
});

/**
 * 3. Consultation du statut courant (pour polling côté client)
 * GET /api/payments/ligdicash/status/:paymentId
 */
app.get('/api/payments/ligdicash/status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = db.payments.find((p) => p.id === paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Paiement introuvable.' },
      });
    }

    const booking = db.bookings.find((b) => b.id === payment.booking_id);
    const tickets = db.tickets.filter((t) => t.booking_id === payment.booking_id);

    return res.status(200).json({
      success: true,
      data: {
        paymentId: payment.id,
        bookingId: payment.booking_id,
        bookingReference: booking?.booking_reference,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        ticketsCount: tickets.length,
        tickets: payment.status === 'SUCCESS' ? tickets : [],
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message },
    });
  }
});

/**
 * 4. Webhook / Callback LigdiCash
 * POST /api/payments/ligdicash/webhook
 */
app.post('/api/payments/ligdicash/webhook', async (req, res) => {
  try {
    console.log('[Webhook LigdiCash] Notification reçue :', req.body);
    const result = await PaymentService.handleWebhook(req.body, req.headers as any);

    // LigdiCash attend un code 00 ou HTTP 200
    return res.status(200).json({
      response_code: '00',
      message: 'Notification traitée avec succès',
      status: result.status,
    });
  } catch (err: any) {
    console.error('[Webhook LigdiCash] Erreur traitement :', err.message);
    // Retourner 200 avec message pour éviter les retries intempestifs si notification invalide
    return res.status(200).json({
      response_code: '01',
      message: err.message,
    });
  }
});

/**
 * 5. URL de retour navigateur après paiement
 * GET /api/payments/ligdicash/return
 */
app.get('/api/payments/ligdicash/return', (req, res) => {
  const paymentId = req.query.paymentId || '';
  res.redirect(`/?paymentId=${encodeURIComponent(String(paymentId))}&action=verify_payment`);
});

/**
 * 6. URL d'annulation navigateur
 * GET /api/payments/ligdicash/cancel
 */
app.get('/api/payments/ligdicash/cancel', (req, res) => {
  const paymentId = req.query.paymentId || '';
  res.redirect(`/?paymentId=${encodeURIComponent(String(paymentId))}&action=cancel_payment`);
});

/**
 * Route Healthcheck
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    version: '1.0.0',
    service: 'TSR Transit Backend',
    ligdicashEnv: ligdiCashProvider.getEnvironment(),
    time: new Date().toISOString(),
  });
});

// =====================================================================
// INTÉGRATION FRONTEND REACT (VITE)
// =====================================================================

async function startServer() {
  if (!isProduction) {
    // Mode Développement : montage de Vite en middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Mode Production : fichiers statiques compilés dans dist
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur TSR Transport actif sur http://0.0.0.0:${PORT}`);
  });
}

startServer();
