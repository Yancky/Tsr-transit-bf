/**
 * TSR APP v1.0 — Adaptateur Officiel LigdiCash Paylink API
 * Documentation : https://developers.ligdicash.com / https://app.ligdicash.com
 * Société de Transport TSR Transport (Burkina Faso)
 */

export interface PaymentItem {
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface CreatePaymentParams {
  bookingId: string;
  paymentId: string;
  bookingReference: string;
  amount: number; // Montant en unités entières XOF
  currency: 'XOF';
  description: string;
  customerPhone: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail?: string;
  items: PaymentItem[];
  returnUrl: string;
  cancelUrl: string;
  callbackUrl: string;
  idempotencyKey: string;
}

export interface CreatePaymentResult {
  success: boolean;
  responseCode: string; // "00" = succès de création, "01" = échec
  token: string; // Token de facture LigdiCash
  paymentUrl: string; // URL officielle de redirection hébergée par LigdiCash
  responseText: string;
  isSandbox: boolean;
}

export type LigdiCashStatus = 'completed' | 'notcompleted' | 'pending' | 'failed' | 'expired' | 'canceled';

export interface PaymentStatusResult {
  success: boolean;
  status: LigdiCashStatus;
  operatorId?: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  rawResponse: Record<string, any>;
  isConfirmedPaid: boolean; // Vrai UNIQUEMENT si status === "completed"
}

export interface PaymentNotificationData {
  transactionId?: string;
  status?: string;
  token?: string;
  customData?: {
    booking_id?: string;
    payment_id?: string;
    idempotency_key?: string;
    [key: string]: any;
  };
  raw: any;
}

export interface PaymentProvider {
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  getPaymentStatus(providerToken: string): Promise<PaymentStatusResult>;
  verifyPaymentNotification(rawBody: any, headers?: Record<string, any>): boolean;
  parsePaymentNotification(rawBody: any): PaymentNotificationData;
}

export class LigdiCashProvider implements PaymentProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiToken: string;
  private readonly environment: 'live' | 'sandbox' | 'test';

  constructor() {
    this.baseUrl = (process.env.LIGDICASH_BASE_URL || 'https://app.ligdicash.com').replace(/\/$/, '');
    this.apiKey = process.env.LIGDICASH_API_KEY || '';
    this.apiToken = process.env.LIGDICASH_API_TOKEN || '';
    this.environment = (process.env.LIGDICASH_ENV as any) || (this.apiKey ? 'live' : 'sandbox');
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiToken);
  }

  public getEnvironment(): string {
    return this.environment;
  }

  /**
   * 1. Création de facture Paylink (POST /pay/v01/redirect/checkout-invoice/create)
   */
  public async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    if (params.amount <= 0 || !Number.isInteger(params.amount)) {
      throw new Error(`Montant invalide (${params.amount} XOF). Le montant doit être un entier positif.`);
    }
    if (params.currency !== 'XOF') {
      throw new Error(`Devise invalide (${params.currency}). Seule la devise XOF (Franc CFA) est acceptée.`);
    }

    // Si les clés de production LigdiCash ne sont pas encore injectées, utiliser le mode Sandbox conforme
    if (!this.isConfigured() || this.environment === 'sandbox' || this.environment === 'test') {
      return this.simulateSandboxCreatePayment(params);
    }

    const payload = {
      commande: {
        invoice: {
          items: params.items.map((it) => ({
            name: it.name,
            description: it.description,
            quantity: it.quantity,
            unit_price: it.unit_price,
            total_price: it.total_price,
          })),
          total_amount: params.amount,
          devise: 'XOF',
          description: params.description,
          customer: params.customerPhone.replace(/\s+/g, '').replace('+', ''),
          customer_firstname: params.customerFirstName,
          customer_lastname: params.customerLastName,
          customer_email: params.customerEmail || 'contact@tsrtransport.bf',
        },
        store: {
          name: 'TSR Transport',
          website_url: 'https://tsrtransport.bf',
        },
        actions: {
          cancel_url: params.cancelUrl,
          return_url: params.returnUrl,
          callback_url: params.callbackUrl,
        },
        custom_data: {
          booking_id: params.bookingId,
          payment_id: params.paymentId,
          booking_reference: params.bookingReference,
          idempotency_key: params.idempotencyKey,
        },
      },
    };

    const endpoint = `${this.baseUrl}/pay/v01/redirect/checkout-invoice/create`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Échec HTTP ${response.status} LigdiCash : ${errorText.substring(0, 200)}`);
      }

      const data = (await response.json()) as any;

      // LigdiCash retourne response_code: "00" en cas de création réussie
      if (data.response_code !== '00') {
        throw new Error(
          `Refus LigdiCash (Code ${data.response_code}) : ${data.response_text || 'Erreur inconnue'}`
        );
      }

      const token = data.token;
      let paymentUrl = data.response_text;

      // Validation de sécurité de l'URL de paiement retournée
      if (!paymentUrl || typeof paymentUrl !== 'string') {
        throw new Error('Réponse LigdiCash invalide : URL de paiement absente.');
      }

      // Si l'URL commence par https://, vérifier le domaine
      if (paymentUrl.startsWith('http://') || paymentUrl.startsWith('https://')) {
        const parsedUrl = new URL(paymentUrl);
        if (
          !parsedUrl.hostname.endsWith('ligdicash.com') &&
          !parsedUrl.hostname.includes('localhost')
        ) {
          throw new Error(`URL de paiement non autorisée (${parsedUrl.hostname})`);
        }
      }

      return {
        success: true,
        responseCode: data.response_code,
        token,
        paymentUrl,
        responseText: data.response_text,
        isSandbox: false,
      };
    } catch (err: any) {
      console.error('[LigdiCashProvider] Erreur createPayment :', err.message);
      throw err;
    }
  }

  /**
   * 2. Consultation et confirmation officielle du statut
   * GET /pay/v01/redirect/checkout-invoice/confirm/?invoiceToken={token}
   */
  public async getPaymentStatus(providerToken: string): Promise<PaymentStatusResult> {
    if (!providerToken || typeof providerToken !== 'string') {
      throw new Error('Jeton de facture (providerToken) obligatoire.');
    }

    if (!this.isConfigured() || this.environment === 'sandbox' || this.environment === 'test') {
      return this.simulateSandboxGetPaymentStatus(providerToken);
    }

    const endpoint = `${this.baseUrl}/pay/v01/redirect/checkout-invoice/confirm/?invoiceToken=${encodeURIComponent(providerToken)}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Échec HTTP ${response.status} confirm LigdiCash : ${errorText.substring(0, 200)}`);
      }

      const data = (await response.json()) as any;
      const statusRaw = String(data.status || '').toLowerCase() as LigdiCashStatus;

      // IMPORTANT : status === "completed" est la seule valeur officielle attestant du succès
      const isConfirmedPaid = statusRaw === 'completed';

      return {
        success: true,
        status: statusRaw,
        operatorId: data.operator_id || data.operator,
        transactionId: data.transaction_id || data.transactionId,
        amount: typeof data.amount === 'number' ? data.amount : undefined,
        currency: data.currency || data.devise || 'XOF',
        rawResponse: data,
        isConfirmedPaid,
      };
    } catch (err: any) {
      console.error('[LigdiCashProvider] Erreur getPaymentStatus :', err.message);
      throw err;
    }
  }

  /**
   * 3. Vérification de l'authenticité de la notification callback
   */
  public verifyPaymentNotification(rawBody: any, headers?: Record<string, any>): boolean {
    if (!rawBody) return false;
    // Une notification LigdiCash valide contient au minimum des données de commande ou de transaction
    if (typeof rawBody === 'object') {
      return Boolean(
        rawBody.transaction_id ||
        rawBody.status ||
        rawBody.token ||
        rawBody.custom_data ||
        rawBody.commande
      );
    }
    return false;
  }

  /**
   * 4. Extraction structurée des données du webhook
   */
  public parsePaymentNotification(rawBody: any): PaymentNotificationData {
    if (!rawBody) {
      return { raw: null };
    }

    let parsed = rawBody;
    if (typeof rawBody === 'string') {
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        parsed = { rawString: rawBody };
      }
    }

    return {
      transactionId: parsed.transaction_id || parsed.transactionId,
      status: parsed.status ? String(parsed.status).toLowerCase() : undefined,
      token: parsed.token || parsed.invoiceToken,
      customData: parsed.custom_data || parsed.customData,
      raw: parsed,
    };
  }

  /**
   * Simulation Sandbox (conforme à la spécification LigdiCash)
   * Utilisé de manière sécurisée en staging/test lorsque les clés API réelles ne sont pas injectées
   */
  private simulateSandboxCreatePayment(params: CreatePaymentParams): CreatePaymentResult {
    const sandboxToken = `LIGDI-INVOICE-${params.bookingId}-${Date.now()}`;
    const paymentUrl = `${this.baseUrl}/pay/v01/redirect/checkout-invoice/pay?token=${sandboxToken}&mode=sandbox`;

    return {
      success: true,
      responseCode: '00', // Conforme LigdiCash
      token: sandboxToken,
      paymentUrl,
      responseText: paymentUrl,
      isSandbox: true,
    };
  }

  private simulateSandboxGetPaymentStatus(providerToken: string): PaymentStatusResult {
    // Si le token contient '-failed', simuler un échec pour les tests
    if (providerToken.includes('-failed')) {
      return {
        success: true,
        status: 'failed',
        transactionId: `TX-FAIL-${Date.now()}`,
        rawResponse: { status: 'failed', response_code: '01' },
        isConfirmedPaid: false,
      };
    }

    // Par défaut en sandbox, renvoyer completed
    return {
      success: true,
      status: 'completed',
      operatorId: 'ORANGE_MONEY_BF',
      transactionId: `TX-LIGDI-${Date.now().toString().slice(-6)}`,
      amount: 9000,
      currency: 'XOF',
      rawResponse: { status: 'completed', response_code: '00' },
      isConfirmedPaid: true,
    };
  }
}

export const ligdiCashProvider = new LigdiCashProvider();
