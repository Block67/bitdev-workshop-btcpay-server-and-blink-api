const axios = require("axios");

function setupPay(app) {
  // Création d'une facture
  app.post("/invoice", async function (req, res) {
    const { amount, comment } = req.body;

    try {
      // Création de la facture sur BTCPay
      const response = await axios.post(
        `${process.env.BTCPAY_URL}/api/v1/stores/${process.env.BTCPAY_STORE_ID}/invoices`,
        {
          amount: 21,
          currency: "BTC",
          checkout: { paymentMethods: ["BTC-LightningNetwork"] },
          itemDesc: comment || "",
          metadata: { comment: comment || "" },
        },
        {
          headers: {
            Authorization: `token ${process.env.BTCPAY_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const invoice = response.data;

      // 🔹 Récupération du payment_request Lightning via GET
      const invoiceDetails = await axios.get(
        `${process.env.BTCPAY_URL}/api/v1/stores/${process.env.BTCPAY_STORE_ID}/invoices/${invoice.id}`,
        {
          headers: {
            Authorization: `token ${process.env.BTCPAY_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Renvoie tout ce qui est utile à ton frontend
      res.json({
        id: invoice.id,
        status: invoiceDetails.data.status,
        paymentRequest:
          invoiceDetails.data.lightningInvoice?.paymentRequest || null,
        bolt11: invoiceDetails.data.lightningInvoice?.bolt11 || null,
        checkoutLink: invoice.checkoutLink,
        amount: invoice.amount,
        currency: invoice.currency,
        metadata: invoice.metadata,
        createdTime: invoice.createdTime,
        expirationTime: invoice.expirationTime,
      });
    } catch (e) {
      console.error("❌ Erreur BTCPay:", e.response?.data || e.message);
      res.status(500).json({ error: "Création facture échouée" });
    }
  });
}

module.exports = { setupPay };
