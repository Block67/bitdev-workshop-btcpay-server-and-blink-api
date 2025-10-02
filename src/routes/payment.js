const express = require('express');
const router = express.Router();
const PaymentModel = require('../database/models/PaymentModel');
const BTCPayService = require('../services/BTCPayService');
const { satsToBtc } = require('../utils');

router.post('/', async (req, res) => {
  try {
    const { amountSats, email, description, metadata } = req.body;

    if (!amountSats || amountSats <= 0) {
      return res.status(400).json({ error: 'amountSats requis et > 0' });
    }

    const invoice = await BTCPayService.createInvoice(amountSats, description, metadata);

    const paymentId = await PaymentModel.create({
      invoiceId: invoice.id,
      amountSats,
      amountBtc: satsToBtc(amountSats),
      email,
      description,
      checkoutLink: invoice.checkoutLink,
      bolt11: invoice.bolt11,
      paymentHash: invoice.paymentHash,
      metadata,
    });

    console.log('✅ Paiement créé:', { id: paymentId, invoiceId: invoice.id, email });

    res.json({
      success: true,
      payment: {
        id: paymentId,
        invoiceId: invoice.id,
        email,
        checkoutLink: invoice.checkoutLink,
        bolt11: invoice.bolt11,
        amount: { sats: amountSats, btc: satsToBtc(amountSats) },
        status: 'pending',
      },
    });
  } catch (error) {
    console.error('❌ Erreur création:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:invoiceId', async (req, res) => {
  try {
    const invoiceId = req.params.invoiceId;

    if (!invoiceId || invoiceId.trim() === '') {
      return res.status(400).json({ error: 'Invoice ID requis' });
    }

    const payment = await PaymentModel.findByInvoiceId(invoiceId);

    if (!payment) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    res.json({
      success: true,
      payment: {
        id: payment.id,
        invoiceId: payment.invoice_id,
        email: payment.email,
        status: payment.status,
        amount: {
          sats: payment.amount_sats,
          btc: parseFloat(payment.amount_btc),
        },
        description: payment.description,
        metadata: payment.metadata ? JSON.parse(payment.metadata) : null,
        checkoutLink: payment.checkout_link,
        bolt11: payment.bolt11,
        createdAt: payment.created_at,
        paidAt: payment.paid_at,
      },
    });
  } catch (error) {
    console.error('❌ Erreur récupération:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    const payments = await PaymentModel.getAll(
      parseInt(limit),
      parseInt(offset),
      status
    );

    res.json({
      success: true,
      payments: payments.map((p) => ({
        id: p.id,
        invoiceId: p.invoice_id,
        email: p.email,
        status: p.status,
        amount: { sats: p.amount_sats, btc: parseFloat(p.amount_btc) },
        description: p.description,
        createdAt: p.created_at,
        paidAt: p.paid_at,
      })),
      pagination: { limit: parseInt(limit), offset: parseInt(offset) },
    });
  } catch (error) {
    console.error('❌ Erreur liste:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;