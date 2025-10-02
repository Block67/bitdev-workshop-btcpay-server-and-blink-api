const axios = require('axios');
const config = require('../config');
const { satsToBtc } = require('../utils');

class BTCPayService {
  static async createInvoice(amountSats, description = '', metadata = {}) {
    try {
      const response = await axios.post(
        `${config.btcpay.serverUrl}/api/v1/stores/${config.btcpay.storeId}/invoices`,
        {
          amount: satsToBtc(amountSats),
          currency: 'BTC',
          checkout: {
            paymentMethods: ['BTC-LightningNetwork'],
          },
          metadata,
        },
        {
          headers: {
            Authorization: `token ${config.btcpay.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('❌ Erreur BTCPay:', error.response?.data || error.message);
      throw new Error('Création facture échouée');
    }
  }
}

module.exports = BTCPayService;