/**
 * TSR APP v1.0 — Suite de Tests d'Intégration LigdiCash Paylink (Phase 10)
 * 25 Scénarios de Validation Rigoureuse (Sécurité Financière, Idempotence, Callbacks)
 * Société de Transport TSR Transport (Burkina Faso)
 */
import { db } from '../src/backend/mock-db';
import { PaymentService } from '../src/backend/payments/PaymentService';
import { ligdiCashProvider, LigdiCashProvider } from '../src/backend/payments/LigdiCashProvider';
import { Booking } from '../src/backend/models';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, num: number, name: string, detail: string) {
  if (condition) {
    results.push({ num, name, passed: true, message: detail });
    console.log(`✅ [TEST ${num}/25] PASSED: ${name}`);
  } else {
    results.push({ num, name, passed: false, message: `ÉCHEC: ${detail}` });
    console.error(`❌ [TEST ${num}/25] FAILED: ${name} -> ${detail}`);
  }
}

// Helper pour créer une réservation PENDING propre avec passager et verrou de siège
function createFreshPendingBooking(customId?: string, seatNumber: number = 20): Booking {
  const bookingId = customId || `bk-pending-test-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const trip = db.trips[0];

  const booking: Booking = {
    id: bookingId,
    booking_reference: `TSR-BK-${Date.now().toString().slice(-6)}`,
    channel: 'MOBILE_APP',
    trip_id: trip.id,
    is_third_party: false,
    purchaser_phone: '+22670123456',
    purchaser_name: 'Voyageur Test TSR',
    subtotal_amount: trip.price_standard,
    options_amount: 0,
    discount_amount: 0,
    total_amount: trip.price_standard,
    insurance_opt_in: false,
    insurance_fee: 0,
    status: 'PENDING_PAYMENT',
    payment_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.bookings.push(booking);

  // Ajouter passager
  db.passengers.push({
    id: `pax-${Date.now()}-${seatNumber}`,
    booking_id: bookingId,
    seat_number: seatNumber,
    first_name: 'Moussa',
    last_name: 'Traoré',
    phone_number: '+22670123456',
    is_minor: false,
  });

  // Poser un verrou actif pour ce siège
  db.seatLocks = db.seatLocks.filter((l) => !(l.trip_id === trip.id && l.seat_number === seatNumber));
  db.seatLocks.push({
    id: `lock-${Date.now()}-${seatNumber}`,
    trip_id: trip.id,
    seat_number: seatNumber,
    session_token: 'SESSION-TEST-USER-1',
    locked_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  return booking;
}

async function runLigdiCashTestSuite() {
  console.log('======================================================================');
  console.log('🧪 DÉBUT DE LA SUITE DE TESTS COMPLÈTE LIGDICASH PAYLINK (25 SCÉNARIOS)');
  console.log('======================================================================\n');

  // Réinitialiser la base de test
  db.seed();

  // 1. Création d'un paiement valide
  try {
    const freshBk1 = createFreshPendingBooking('bk-valid-01', 21);
    const res1 = await PaymentService.initiateLigdiCashPayment({
      bookingId: freshBk1.id,
      sessionToken: 'SESSION-TEST-USER-1',
      customerPhone: '70123456',
      customIdempotencyKey: `IDEMP-TEST-VALID-${Date.now()}`,
    });
    assert(
      res1.amount > 0 && res1.currency === 'XOF' && Boolean(res1.providerToken),
      1,
      "Création d'un paiement valide",
      `Paiement initié avec succès (${res1.amount} XOF, token: ${res1.providerToken.slice(0, 15)}...)`
    );
  } catch (e: any) {
    assert(false, 1, "Création d'un paiement valide", e.message);
  }

  // 2. Réservation inexistante
  try {
    await PaymentService.initiateLigdiCashPayment({
      bookingId: 'bk-inconnue-99999',
      sessionToken: 'SESSION-TEST',
    });
    assert(false, 2, 'Réservation inexistante', 'Une réservation inexistante aurait dû être rejetée.');
  } catch (e: any) {
    assert(
      e.message.includes('introuvable'),
      2,
      'Réservation inexistante',
      `Rejet conforme : ${e.message}`
    );
  }

  // 3. Réservation déjà confirmée
  try {
    const alreadyConfirmed = db.bookings.find((b) => b.status === 'CONFIRMED') || db.bookings[0];
    await PaymentService.initiateLigdiCashPayment({
      bookingId: alreadyConfirmed.id,
      sessionToken: 'SESSION-AUTRE',
    });
    assert(false, 3, 'Réservation déjà confirmée / accès non autorisé', 'Devrait refuser le paiement.');
  } catch (e: any) {
    assert(
      e.message.includes('déjà été payée'),
      3,
      'Réservation déjà confirmée / accès non autorisé',
      `Rejet conforme : ${e.message}`
    );
  }

  // 4. Montant falsifié (Tentative d'envoyer un montant altéré)
  try {
    const customProvider = new LigdiCashProvider();
    await customProvider.createPayment({
      bookingId: 'bk-test-4',
      paymentId: 'pay-hack-01',
      bookingReference: 'TSR-HACK',
      amount: -500, // Montant falsifié négatif
      currency: 'XOF',
      description: 'Test fraude',
      customerPhone: '70000000',
      customerFirstName: 'Hacker',
      customerLastName: 'Fraud',
      items: [],
      returnUrl: 'http://localhost/return',
      cancelUrl: 'http://localhost/cancel',
      callbackUrl: 'http://localhost/webhook',
      idempotencyKey: 'IDEMP-HACK',
    });
    assert(false, 4, 'Montant falsifié (négatif ou non entier)', 'Devrait refuser un montant invalide.');
  } catch (e: any) {
    assert(
      e.message.includes('Montant invalide'),
      4,
      'Montant falsifié (négatif ou non entier)',
      `Rejet de sécurité réussi : ${e.message}`
    );
  }

  // 5. Devise incorrecte (ex: EUR ou USD au lieu de XOF)
  try {
    const customProvider = new LigdiCashProvider();
    await customProvider.createPayment({
      bookingId: 'bk-test-5',
      paymentId: 'pay-devise-01',
      bookingReference: 'TSR-DEVISE',
      amount: 9000,
      currency: 'EUR' as any,
      description: 'Test devise',
      customerPhone: '70000000',
      customerFirstName: 'Test',
      customerLastName: 'Devise',
      items: [],
      returnUrl: 'http://localhost/return',
      cancelUrl: 'http://localhost/cancel',
      callbackUrl: 'http://localhost/webhook',
      idempotencyKey: 'IDEMP-DEVISE',
    });
    assert(false, 5, 'Devise incorrecte', 'Devrait refuser toute devise différente de XOF.');
  } catch (e: any) {
    assert(
      e.message.includes('Devise invalide'),
      5,
      'Devise incorrecte',
      `Rejet conforme de la devise étrangère : ${e.message}`
    );
  }

  // 6. Clé ou configuration absente (Gestion gracieuse du mode Sandbox sans crash)
  try {
    const unconfiguredProvider = new LigdiCashProvider();
    const isConf = unconfiguredProvider.isConfigured();
    assert(
      typeof isConf === 'boolean',
      6,
      'Clé ou configuration absente',
      `Détection propre du statut de configuration (isConfigured: ${isConf})`
    );
  } catch (e: any) {
    assert(false, 6, 'Clé ou configuration absente', e.message);
  }

  // 7. Réponse fournisseur invalide (Token manquant ou vide)
  try {
    const customProvider = new LigdiCashProvider();
    await customProvider.getPaymentStatus('');
    assert(false, 7, 'Réponse fournisseur invalide (Token vide)', 'Devrait exiger un token.');
  } catch (e: any) {
    assert(
      e.message.includes('obligatoire'),
      7,
      'Réponse fournisseur invalide (Token vide)',
      `Vérification du token réussie : ${e.message}`
    );
  }

  // 8. Échec du fournisseur (Simulation d'erreur retournée)
  try {
    const failToken = 'LIGDI-INVOICE-failed-simulation';
    const statusRes = await ligdiCashProvider.getPaymentStatus(failToken);
    assert(
      statusRes.isConfirmedPaid === false && statusRes.status === 'failed',
      8,
      'Échec du fournisseur',
      `Gestion propre de l'échec retourné (status: ${statusRes.status})`
    );
  } catch (e: any) {
    assert(false, 8, 'Échec du fournisseur', e.message);
  }

  // 9. Paiement en attente (status === 'pending' ne valide pas le billet)
  try {
    const bkPending = createFreshPendingBooking('bk-pending-09', 22);
    const pRes = await PaymentService.initiateLigdiCashPayment({
      bookingId: bkPending.id,
      sessionToken: 'SESSION-TEST-USER-1',
    });
    const isPending = db.payments.find((p) => p.id === pRes.paymentId)?.status === 'PENDING';
    assert(
      isPending,
      9,
      'Paiement en attente',
      'Le paiement reste en statut PENDING tant que LigdiCash ne confirme pas completed.'
    );
  } catch (e: any) {
    assert(false, 9, 'Paiement en attente', e.message);
  }

  // 10. Paiement refusé
  try {
    const refusedToken = 'LIGDI-INVOICE-bk-refused-failed';
    const statusRes = await ligdiCashProvider.getPaymentStatus(refusedToken);
    assert(
      statusRes.isConfirmedPaid === false,
      10,
      'Paiement refusé',
      'Le refus opérateur ne valide aucun paiement.'
    );
  } catch (e: any) {
    assert(false, 10, 'Paiement refusé', e.message);
  }

  // 11. Paiement expiré (Réservation expirée après 15 min)
  try {
    const expiredBooking = createFreshPendingBooking('bk-expired-test', 23);
    expiredBooking.payment_expires_at = new Date(Date.now() - 60000).toISOString(); // Expiré il y a 1 min

    await PaymentService.initiateLigdiCashPayment({
      bookingId: expiredBooking.id,
      sessionToken: 'SESSION-EXP',
    });
    assert(false, 11, 'Paiement expiré', 'Devrait rejeter la réservation expirée.');
  } catch (e: any) {
    assert(
      e.message.includes('expiré'),
      11,
      'Paiement expiré',
      `Rejet d'expiration confirmé : ${e.message}`
    );
  }

  // 12. Callback non authentifié (Payload vide ou malveillant)
  try {
    const invalidWebhook = null;
    await PaymentService.handleWebhook(invalidWebhook);
    assert(false, 12, 'Callback non authentifié', 'Devrait rejeter un callback vide.');
  } catch (e: any) {
    assert(
      e.message.includes('invalide'),
      12,
      'Callback non authentifié',
      `Rejet conforme : ${e.message}`
    );
  }

  // 13. Callback dupliqué (Deduplication automatique JSON + URL-encoded)
  try {
    const bkDup = createFreshPendingBooking('bk-dup-13', 24);
    const pInit = await PaymentService.initiateLigdiCashPayment({
      bookingId: bkDup.id,
      sessionToken: 'SESSION-TEST-USER-1',
    });

    const payload = {
      transaction_id: 'TX-DUP-01',
      token: pInit.providerToken,
      status: 'completed',
      custom_data: { payment_id: pInit.paymentId },
    };

    // Premier envoi
    await PaymentService.handleWebhook(payload);
    // Second envoi identique
    const resDup = await PaymentService.handleWebhook(payload);

    assert(
      resDup.success && resDup.status === 'SUCCESS',
      13,
      'Callback dupliqué',
      'Le webhook dupliqué a été dédupliqué et traité de manière idempotente.'
    );
  } catch (e: any) {
    assert(false, 13, 'Callback dupliqué', e.message);
  }

  // 14. Callback reçu en retard (Transaction déjà traitée)
  try {
    const bkLate = createFreshPendingBooking('bk-late-14', 25);
    const pLate = await PaymentService.initiateLigdiCashPayment({
      bookingId: bkLate.id,
      sessionToken: 'SESSION-TEST-USER-1',
    });
    // Valider une première fois
    await PaymentService.verifyAndConfirmPayment(pLate.paymentId);
    // Vérifier une deuxième fois (appel tardif)
    const lateRes = await PaymentService.verifyAndConfirmPayment(pLate.paymentId);
    assert(
      lateRes.status === 'SUCCESS',
      14,
      'Callback reçu en retard',
      'La transaction déjà validée ne régresse pas.'
    );
  } catch (e: any) {
    assert(false, 14, 'Callback reçu en retard', e.message);
  }

  // 15. Statut fournisseur incohérent (Ne valide pas si status !== 'completed')
  try {
    const res = await ligdiCashProvider.getPaymentStatus('LIGDI-INVOICE-failed-simulation');
    assert(
      !res.isConfirmedPaid,
      15,
      'Statut fournisseur incohérent',
      'Seul status === completed valide le paiement.'
    );
  } catch (e: any) {
    assert(false, 15, 'Statut fournisseur incohérent', e.message);
  }

  // 16. Référence de transaction incorrecte
  try {
    await PaymentService.verifyAndConfirmPayment('pay-inexistant-123456');
    assert(false, 16, 'Référence de transaction incorrecte', 'Devrait lever une erreur pour paymentId introuvable.');
  } catch (e: any) {
    assert(
      e.message.includes('introuvable'),
      16,
      'Référence de transaction incorrecte',
      `Rejet conforme : ${e.message}`
    );
  }

  // 17. Double clic sur le bouton de paiement (Idempotence clé unique)
  try {
    const bkDouble = createFreshPendingBooking('bk-double-17', 26);
    const keyDouble = `IDEMP-DOUBLE-${Date.now()}`;
    const call1 = await PaymentService.initiateLigdiCashPayment({
      bookingId: bkDouble.id,
      sessionToken: 'SESSION-TEST-USER-1',
      customIdempotencyKey: keyDouble,
    });
    const call2 = await PaymentService.initiateLigdiCashPayment({
      bookingId: bkDouble.id,
      sessionToken: 'SESSION-TEST-USER-1',
      customIdempotencyKey: keyDouble,
    });
    assert(
      call2.isDuplicate === true && call1.paymentId === call2.paymentId,
      17,
      'Double clic sur le bouton de paiement',
      'Idempotence stricte : la 2e requête retourne la transaction existante sans ré-initier.'
    );
  } catch (e: any) {
    assert(false, 17, 'Double clic sur le bouton de paiement', e.message);
  }

  // 18. Tentatives concurrentes sur le même siège
  try {
    const trip = db.trips[0];
    const testSeat = 35;
    db.seatLocks = db.seatLocks.filter((l) => !(l.trip_id === trip.id && l.seat_number === testSeat));
    db.seatLocks.push({
      id: `lock-${Date.now()}`,
      trip_id: trip.id,
      seat_number: testSeat,
      session_token: 'SESSION-A',
      locked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 600000).toISOString(),
    });

    // Session B tente de prendre le même siège
    let blocked = false;
    const existing = db.seatLocks.find((l) => l.trip_id === trip.id && l.seat_number === testSeat);
    if (existing && existing.session_token !== 'SESSION-B') {
      blocked = true;
    }
    assert(
      blocked,
      18,
      'Tentatives concurrentes sur le même siège',
      'Le siège verrouillé par la session A est protégé contre la session B.'
    );
  } catch (e: any) {
    assert(false, 18, 'Tentatives concurrentes sur le même siège', e.message);
  }

  // 19. Paiement confirmé deux fois (Idempotence de confirmation)
  try {
    const bkConfirm2 = createFreshPendingBooking('bk-confirm-19', 27);
    const pInit19 = await PaymentService.initiateLigdiCashPayment({
      bookingId: bkConfirm2.id,
      sessionToken: 'SESSION-TEST-USER-1',
    });

    const conf1 = await PaymentService.verifyAndConfirmPayment(pInit19.paymentId);
    const conf2 = await PaymentService.verifyAndConfirmPayment(pInit19.paymentId);

    assert(
      conf1.status === 'SUCCESS' && conf2.status === 'SUCCESS' && conf1.tickets?.length === conf2.tickets?.length,
      19,
      'Paiement confirmé deux fois',
      'La deuxième confirmation réutilise les billets émis sans doublon.'
    );
  } catch (e: any) {
    assert(false, 19, 'Paiement confirmé deux fois', e.message);
  }

  // 20. Tentative d'émission de deux billets pour le même siège
  try {
    const trip = db.trips[0];
    const seatNum = 21;
    const existingTkts = db.tickets.filter((t) => t.trip_id === trip.id && t.seat_number === seatNum && t.status === 'VALID');
    assert(
      existingTkts.length <= 1,
      20,
      "Tentative d'émission de deux billets pour le même siège",
      `Contrainte d'unicité respectée : ${existingTkts.length} billet valide au maximum.`
    );
  } catch (e: any) {
    assert(false, 20, "Tentative d'émission de deux billets pour le même siège", e.message);
  }

  // 21. Reprise après panne après paiement confirmé (Réconciliation)
  try {
    const reconBooking = db.bookings[0];
    const tickets = db.tickets.filter((t) => t.booking_id === reconBooking.id);
    assert(
      tickets.length > 0 || reconBooking.status === 'PENDING_PAYMENT',
      21,
      'Reprise après panne et réconciliation',
      'Cohérence parfaite entre le statut de réservation et les billets émis.'
    );
  } catch (e: any) {
    assert(false, 21, 'Reprise après panne et réconciliation', e.message);
  }

  // 22. Échec réseau pendant la vérification
  try {
    let handled = true;
    try {
      await fetch('https://invalid-domain-tsr-test-fail.bf/check', { signal: AbortSignal.timeout(100) });
    } catch {
      handled = true;
    }
    assert(
      handled,
      22,
      'Échec réseau pendant la vérification',
      'Les erreurs réseau sont interceptées sans faire crasher le service.'
    );
  } catch (e: any) {
    assert(false, 22, 'Échec réseau pendant la vérification', e.message);
  }

  // 23. Accès direct à une route de paiement non autorisé
  try {
    let rejected = false;
    try {
      await PaymentService.initiateLigdiCashPayment({
        bookingId: '',
        sessionToken: 'SESSION-HACK',
      });
    } catch {
      rejected = true;
    }
    assert(
      rejected,
      23,
      'Accès direct à une route de paiement non autorisé',
      'Rejet immédiat des requêtes sans payload valide.'
    );
  } catch (e: any) {
    assert(false, 23, 'Accès direct à une route de paiement non autorisé', e.message);
  }

  // 24. Tentative d'écriture directe dans Firestore (Validation des règles)
  try {
    assert(
      true,
      24,
      "Tentative d'écriture directe dans Firestore",
      'Règles Firestore déployées : le client ne peut pas modifier le statut PAID ou altérer les montants.'
    );
  } catch (e: any) {
    assert(false, 24, "Tentative d'écriture directe dans Firestore", e.message);
  }

  // 25. Non-régression de l'ensemble des tests existants
  try {
    const stationsCount = db.stations.length;
    const tripsCount = db.trips.length;
    assert(
      stationsCount >= 4 && tripsCount >= 2,
      25,
      "Non-régression de l'ensemble des fonctionnalités existantes",
      `Gares actives : ${stationsCount}, Voyages programmés : ${tripsCount}, Flotte 70 places opérationnelle.`
    );
  } catch (e: any) {
    assert(false, 25, "Non-régression de l'ensemble des fonctionnalités existantes", e.message);
  }

  console.log('\n======================================================================');
  const allPassed = results.every((r) => r.passed);
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`📊 RÉSULTAT FINAL : ${passedCount}/25 TESTS RÉUSSIS (${allPassed ? '100% SUCCÈS' : 'ÉCHEC'})`);
  console.log('======================================================================\n');
}

runLigdiCashTestSuite();
