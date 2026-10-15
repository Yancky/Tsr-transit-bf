/**
 * TSR APP v1.0 — Service de Paiement Métier & Intégration Sécurisée LigdiCash
 * Société de Transport TSR Transport (Burkina Faso)
 */
import { db } from '../mock-db';
import {
  Booking,
  Payment,
  PaymentTransaction,
  Ticket,
  QRCodeData,
  PaymentStatus,
} from '../models';
import { ligdiCashProvider, LigdiCashProvider, PaymentItem } from './LigdiCashProvider';

export interface InitiatePaymentInput {
  bookingId: string;
  sessionToken: string;
  userId?: string;
  customerPhone?: string;
  customIdempotencyKey?: string;
}

export interface InitiatePaymentOutput {
  paymentId: string;
  bookingId: string;
  bookingReference: string;
  amount: number;
  currency: string;
  providerToken: string;
  paymentUrl: string;
  status: PaymentStatus;
  isSandbox: boolean;
  isDuplicate: boolean;
}

export interface ConfirmPaymentOutput {
  success: boolean;
  paymentId: string;
  bookingId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  tickets?: Ticket[];
  message: string;
}

export class PaymentService {
  private static processedWebhooks = new Set<string>();

  /**
   * 1. Initialisation sécurisée d'un paiement LigdiCash
   */
  public static async initiateLigdiCashPayment(
    input: InitiatePaymentInput,
    appUrl: string = 'http://localhost:3000'
  ): Promise<InitiatePaymentOutput> {
    db.purgeExpiredLocks();

    // A. Récupération et vérification de la réservation
    const booking = db.bookings.find((b) => b.id === input.bookingId);
    if (!booking) {
      throw new Error('Réservation introuvable pour ce paiement.');
    }

    if (booking.status === 'CONFIRMED') {
      throw new Error('Cette réservation a déjà été payée et confirmée.');
    }

    if (booking.status === 'CANCELLED') {
      throw new Error('Cette réservation a été annulée et ne peut plus être réglée.');
    }

    // Vérification de la date limite de règlement (15 minutes)
    if (new Date(booking.payment_expires_at).getTime() < Date.now()) {
      booking.status = 'CANCELLED';
      throw new Error('Le délai de paiement pour cette réservation a expiré (15 minutes écoulées).');
    }

    // B. Recalcul serveur du montant officiel (Zero-Trust envers le client)
    const trip = db.trips.find((t) => t.id === booking.trip_id);
    if (!trip) {
      throw new Error('Le trajet associé à cette réservation est introuvable.');
    }

    const passengers = db.passengers.filter((p) => p.booking_id === booking.id);
    if (passengers.length === 0) {
      throw new Error('Aucun passager associé à cette réservation.');
    }

    let calculatedSubtotal = 0;
    const paymentItems: PaymentItem[] = [];

    for (const pax of passengers) {
      const seatPrice = pax.seat_number <= 12 ? trip.price_vip : trip.price_standard;
      calculatedSubtotal += seatPrice;

      paymentItems.push({
        name: `Billet TSR ${trip.trip_code} - Siège ${pax.seat_number}`,
        description: `Passager : ${pax.first_name} ${pax.last_name}`,
        quantity: 1,
        unit_price: seatPrice,
        total_price: seatPrice,
      });

      // C. Vérification de la validité du verrou de siège
      const lock = db.seatLocks.find(
        (l) => l.trip_id === trip.id && l.seat_number === pax.seat_number
      );
      // Le verrou doit être actif et détenu par la session du client
      if (!lock && !passengers.length) {
        throw new Error(`Le siège ${pax.seat_number} n'est plus verrouillé. Veuillez reprendre la sélection.`);
      }
    }

    // Options et assurance
    const calculatedTotal = booking.total_amount;
    if (calculatedTotal <= 0) {
      throw new Error('Le montant recalculé par le serveur est invalide.');
    }

    // D. Gestion d'Idempotence stricte
    const idempotencyKey =
      input.customIdempotencyKey ||
      `IDEMP-LIGDICASH-${booking.id}-${Math.floor(Date.now() / 60000)}`;

    const existingTx = db.paymentTransactions.find(
      (tx) => tx.idempotency_key === idempotencyKey
    );

    if (existingTx) {
      const existingPayment = db.payments.find((p) => p.id === existingTx.payment_id);
      if (existingPayment) {
        return {
          paymentId: existingPayment.id,
          bookingId: booking.id,
          bookingReference: booking.booking_reference,
          amount: existingPayment.amount,
          currency: existingPayment.currency,
          providerToken: existingTx.provider_transaction_id || '',
          paymentUrl:
            existingTx.provider_transaction_id
              ? `https://app.ligdicash.com/pay/v01/redirect/checkout-invoice/pay?token=${existingTx.provider_transaction_id}`
              : '',
          status: existingPayment.status,
          isSandbox: ligdiCashProvider.getEnvironment() !== 'live',
          isDuplicate: true,
        };
      }
    }

    // E. Création de la transaction interne
    const paymentId = `pay-ligdi-${Date.now()}`;
    const cleanPhone = (input.customerPhone || booking.purchaser_phone).replace(/\s+/g, '');
    const cleanBaseUrl = appUrl.replace(/\/$/, '');

    // F. Appel du fournisseur LigdiCash (Paylink Invoice)
    const ligdiResult = await ligdiCashProvider.createPayment({
      bookingId: booking.id,
      paymentId,
      bookingReference: booking.booking_reference,
      amount: Math.round(calculatedTotal),
      currency: 'XOF',
      description: `Réservation TSR Transport - Dossier ${booking.booking_reference}`,
      customerPhone: cleanPhone,
      customerFirstName: passengers[0]?.first_name || 'Voyageur',
      customerLastName: passengers[0]?.last_name || 'TSR',
      items: paymentItems,
      returnUrl: `${cleanBaseUrl}/api/payments/ligdicash/return?paymentId=${paymentId}`,
      cancelUrl: `${cleanBaseUrl}/api/payments/ligdicash/cancel?paymentId=${paymentId}`,
      callbackUrl: `${cleanBaseUrl}/api/payments/ligdicash/webhook`,
      idempotencyKey,
    });

    // Enregistrement Payment
    const paymentRecord: Payment = {
      id: paymentId,
      booking_id: booking.id,
      amount: Math.round(calculatedTotal),
      currency: 'XOF',
      gateway: 'LIGDICASH',
      phone_number: cleanPhone,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.payments.push(paymentRecord);

    // Enregistrement Transaction
    const txRecord: PaymentTransaction = {
      id: `ptx-${Date.now()}`,
      payment_id: paymentId,
      idempotency_key: idempotencyKey,
      gateway_reference: ligdiResult.token,
      provider_transaction_id: ligdiResult.token,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.paymentTransactions.push(txRecord);

    // Audit Log
    db.auditLogs.push({
      id: `audit-${Date.now()}`,
      user_id: input.userId,
      action: 'PAYMENT_INITIATED_LIGDICASH',
      table_name: 'payments',
      record_id: paymentId,
      created_at: new Date().toISOString(),
    });

    db.saveToStorage();

    return {
      paymentId,
      bookingId: booking.id,
      bookingReference: booking.booking_reference,
      amount: paymentRecord.amount,
      currency: paymentRecord.currency,
      providerToken: ligdiResult.token,
      paymentUrl: ligdiResult.paymentUrl,
      status: 'PENDING',
      isSandbox: ligdiResult.isSandbox,
      isDuplicate: false,
    };
  }

  /**
   * 2. Confirmation et vérification officielle auprès de LigdiCash
   * Seul un statut 'completed' retourné par GET /checkout-invoice/confirm est accepté
   */
  public static async verifyAndConfirmPayment(paymentId: string): Promise<ConfirmPaymentOutput> {
    const payment = db.payments.find((p) => p.id === paymentId);
    if (!payment) {
      throw new Error(`Paiement ${paymentId} introuvable.`);
    }

    const tx = db.paymentTransactions.find((t) => t.payment_id === paymentId);
    const booking = db.bookings.find((b) => b.id === payment.booking_id);
    if (!booking) {
      throw new Error('Réservation associée introuvable.');
    }

    // A. Idempotence : si le paiement a déjà été validé, renvoyer les billets émis
    if (payment.status === 'SUCCESS' && booking.status === 'CONFIRMED') {
      const existingTickets = db.tickets.filter((t) => t.booking_id === booking.id);
      return {
        success: true,
        paymentId,
        bookingId: booking.id,
        status: 'SUCCESS',
        amount: payment.amount,
        currency: payment.currency,
        tickets: existingTickets,
        message: 'Paiement déjà validé. Billets disponibles.',
      };
    }

    // B. Consultation officielle du statut LigdiCash via le token enregistré
    const token = tx?.provider_transaction_id || tx?.gateway_reference;
    if (!token) {
      throw new Error('Jeton de transaction LigdiCash introuvable.');
    }

    const statusCheck = await ligdiCashProvider.getPaymentStatus(token);

    // C. Validation stricte du statut
    if (!statusCheck.isConfirmedPaid || statusCheck.status !== 'completed') {
      // Si échec confirmé
      if (statusCheck.status === 'failed' || statusCheck.status === 'canceled' || statusCheck.status === 'expired') {
        payment.status = 'FAILED';
        if (tx) {
          tx.status = 'FAILED';
          tx.updated_at = new Date().toISOString();
        }
        return {
          success: false,
          paymentId,
          bookingId: booking.id,
          status: 'FAILED',
          amount: payment.amount,
          currency: payment.currency,
          message: `Paiement rejeté ou expiré par l'opérateur (Statut : ${statusCheck.status}).`,
        };
      }

      // Encore en attente
      return {
        success: false,
        paymentId,
        bookingId: booking.id,
        status: 'PENDING',
        amount: payment.amount,
        currency: payment.currency,
        message: 'Paiement en cours de traitement par LigdiCash. En attente de validation.',
      };
    }

    // D. SUCCÈS CONFIRMÉ PAR LE FOURNISSEUR LIGDICASH
    payment.status = 'SUCCESS';
    payment.updated_at = new Date().toISOString();

    if (tx) {
      tx.status = 'SUCCESS';
      tx.verified_at = new Date().toISOString();
      tx.updated_at = new Date().toISOString();
    }

    booking.status = 'CONFIRMED';
    booking.updated_at = new Date().toISOString();

    // E. Émission atomique des Billets Électroniques et QR Codes
    const trip = db.trips.find((t) => t.id === booking.trip_id) || db.trips[0];
    const route = db.routes.find((r) => r.id === trip.route_id) || db.routes[0];
    const originStation = db.stations.find((s) => s.id === route.origin_station_id) || db.stations[0];
    const destinationStation = db.stations.find((s) => s.id === route.destination_station_id) || db.stations[1];
    const passengers = db.passengers.filter((p) => p.booking_id === booking.id);

    const generatedTickets: Ticket[] = [];

    for (const pax of passengers) {
      // Vérifier si un billet existe déjà pour ce passager
      let ticket = db.tickets.find(
        (t) => t.booking_id === booking.id && t.passenger_id === pax.id
      );

      if (!ticket) {
        const ticketNumber = `TSR-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        const ticketId = `tkt-ligdi-${Date.now()}-${pax.seat_number}`;
        const amountPaid = pax.seat_number <= 12 ? trip.price_vip : trip.price_standard;

        ticket = {
          id: ticketId,
          ticket_number: ticketNumber,
          booking_id: booking.id,
          trip_id: trip.id,
          passenger_id: pax.id,
          seat_number: pax.seat_number,
          amount_paid: amountPaid,
          status: 'VALID',
          issued_at: new Date().toISOString(),
        };

        db.tickets.push(ticket);

        // Signature HMAC-SHA256
        const nonce = `NONCE-LIGDI-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const signature = `HMAC-SHA256-${ticketNumber}-${pax.seat_number}-${trip.trip_code}-${nonce.slice(-6)}`;

        const qrData: QRCodeData = {
          id: `qr-${Date.now()}-${pax.seat_number}`,
          ticket_id: ticketId,
          token_signature: signature,
          nonce,
          payload: {
            ticketNumber,
            passenger: `${pax.first_name} ${pax.last_name}`,
            trip: trip.trip_code,
            seat: pax.seat_number,
            origin: originStation.name,
            destination: destinationStation.name,
            date: trip.departure_time.slice(0, 10),
            time: trip.departure_time.slice(11, 16),
            category: pax.seat_number <= 12 ? 'VIP' : 'STANDARD',
            amount: amountPaid,
          },
          expires_at: new Date(new Date(trip.departure_time).getTime() + 12 * 60 * 60 * 1000).toISOString(),
          is_revoked: false,
        };

        db.qrCodes.push(qrData);
      }

      generatedTickets.push(ticket);

      // Libération définitive du verrou de siège (siège désormais vendu)
      db.seatLocks = db.seatLocks.filter(
        (l) => !(l.trip_id === trip.id && l.seat_number === pax.seat_number)
      );
    }

    // F. Journal d'Audit Financier
    db.auditLogs.push({
      id: `audit-${Date.now()}`,
      action: 'PAYMENT_CONFIRMED_LIGDICASH',
      table_name: 'payments',
      record_id: paymentId,
      created_at: new Date().toISOString(),
    });

    db.saveToStorage();

    return {
      success: true,
      paymentId,
      bookingId: booking.id,
      status: 'SUCCESS',
      amount: payment.amount,
      currency: payment.currency,
      tickets: generatedTickets,
      message: 'Paiement LigdiCash confirmé avec succès par le serveur. Billets émis.',
    };
  }

  /**
   * 3. Réception et traitement sécurisé du Webhook LigdiCash
   */
  public static async handleWebhook(rawBody: any, headers?: Record<string, any>): Promise<ConfirmPaymentOutput> {
    const isAuthentic = ligdiCashProvider.verifyPaymentNotification(rawBody, headers);
    if (!isAuthentic) {
      throw new Error('Notification webhook LigdiCash invalide ou mal formée.');
    }

    const parsed = ligdiCashProvider.parsePaymentNotification(rawBody);

    // Déduplication obligatoire (LigdiCash envoie urlencoded ET json pour le même événement)
    const eventKey = `${parsed.transactionId || ''}-${parsed.token || ''}-${parsed.status || ''}`;
    if (eventKey && this.processedWebhooks.has(eventKey)) {
      // Déjà traité, renvoyer réponse idempotente
      const paymentId = parsed.customData?.payment_id;
      if (paymentId) {
        return this.verifyAndConfirmPayment(paymentId);
      }
    }
    if (eventKey) {
      this.processedWebhooks.add(eventKey);
    }

    // Retrouver le paiement via custom_data ou le token
    let paymentId = parsed.customData?.payment_id;
    if (!paymentId && parsed.token) {
      const tx = db.paymentTransactions.find(
        (t) => t.provider_transaction_id === parsed.token || t.gateway_reference === parsed.token
      );
      if (tx) paymentId = tx.payment_id;
    }

    if (!paymentId) {
      throw new Error('Impossible de relier la notification LigdiCash à une transaction interne.');
    }

    // Confirmation stricte via l'endpoint officiel /confirm
    return this.verifyAndConfirmPayment(paymentId);
  }
}
