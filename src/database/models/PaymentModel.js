const { getDb } = require('../connection');

class PaymentModel {
  static async create(data) {
    const db = getDb();
    const sql = `
      INSERT INTO payments (invoice_id, amount_sats, amount_btc, email, description, checkout_link, bolt11, payment_hash, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(sql, [
      data.invoiceId,
      data.amountSats,
      data.amountBtc,
      data.email || null,
      data.description || null,
      data.checkoutLink || null,
      data.bolt11 || null,
      data.paymentHash || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ]);
    return result.insertId;
  }

  static async findByInvoiceId(invoiceId) {
    const db = getDb();
    const sql = `SELECT * FROM payments WHERE invoice_id = ?`;
    const [rows] = await db.execute(sql, [invoiceId]);
    return rows[0];
  }

  static async updateStatus(invoiceId, status, paidAt = null) {
    const db = getDb();
    const sql = `UPDATE payments SET status = ?, paid_at = ? WHERE invoice_id = ?`;
    await db.execute(sql, [status, paidAt, invoiceId]);
  }

  static async getAll(limit = 50, offset = 0, status = null) {
    const db = getDb();
    let sql = `SELECT * FROM payments`;
    let params = [];

    if (status) {
      sql += ` WHERE status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.execute(sql, params);
    return rows;
  }
}

module.exports = PaymentModel;