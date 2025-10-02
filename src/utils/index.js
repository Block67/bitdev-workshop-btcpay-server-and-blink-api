const crypto = require('crypto');
const config = require('../config');

function satsToBtc(sats) {
  return parseFloat((sats / 100_000_000).toFixed(8));
}

function verifyWebhookSignature(rawBody, signature) {
  if (!signature || !signature.startsWith('sha256=')) return false;

  const providedSignature = signature.substring(7);
  const computedSignature = crypto
    .createHmac('sha256', config.btcpay.webhookSecret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(providedSignature, 'hex'),
    Buffer.from(computedSignature, 'hex')
  );
}

module.exports = { satsToBtc, verifyWebhookSignature };