const express = require('express');
const router = express.Router();
const PaymentModel = require('../database/models/PaymentModel');
const { verifyWebhookSignature } = require('../utils');

router.post('/btcpay', async (req, res) => {
  try {
    const rawBody = req.body;
    const signature = req.headers['btcpay-sig'];

    console.log('🔔 Webhook reçu');

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('❌ Signature invalide');
      return res.status(400).json({ error: 'Signature invalide' });
    }

    const payload = JSON.parse(rawBody.toString());
    console.log('📦 Event:', payload.type, 'Invoice:', payload.invoiceId);

    const payment = await PaymentModel.findByInvoiceId(payload.invoiceId);
    if (!payment) {
      console.error('❌ Paiement introuvable:', payload.invoiceId);
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    let newStatus = payment.status;
    let paidAt = null;

    switch (payload.type) {
      case 'InvoiceSettled':
        newStatus = 'paid';
        paidAt = new Date();
        break;
      case 'InvoiceExpired':
        newStatus = 'expired';
        break;
      case 'InvoiceInvalid':
        newStatus = 'invalid';
        break;
      default:
        console.log('⚠️ Événement ignoré:', payload.type);
        return res.json({ ignored: true });
    }

    if (newStatus !== payment.status) {
      await PaymentModel.updateStatus(payload.invoiceId, newStatus, paidAt);
      console.log('✅ Statut mis à jour:', payment.status, '→', newStatus);
    }

    res.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('❌ Erreur webhook:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;