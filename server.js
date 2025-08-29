const express = require('express');
const mysql = require('mysql2/promise');
const axios = require('axios');
const crypto = require('crypto');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ⚙️ CONFIGURATION
const config = {
    db: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    },
    btcpay: {
        serverUrl: process.env.BTCPAY_SERVER_URL,
        storeId: process.env.BTCPAY_STORE_ID,
        apiKey: process.env.BTCPAY_API_KEY,
        webhookSecret: process.env.BTCPAY_WEBHOOK_SECRET
    },
    port: process.env.PORT || 3000
};

// 🛡️ MIDDLEWARE
app.use(helmet());
app.use(cors());
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// 🗄️ BASE DE DONNÉES
let db;

async function initDatabase() {
    try {
        db = await mysql.createConnection(config.db);
        console.log('✅ Base de données connectée');
        await createTable();
    } catch (error) {
        console.error('❌ Erreur DB:', error.message);
        process.exit(1);
    }
}

async function createTable() {
    const sql = `
        CREATE TABLE IF NOT EXISTS payments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_id VARCHAR(255) UNIQUE NOT NULL,
            amount_sats BIGINT NOT NULL,
            amount_btc DECIMAL(16,8) NOT NULL,
            email VARCHAR(255) NULL,
            description TEXT,
            status ENUM('pending', 'paid', 'expired', 'invalid') DEFAULT 'pending',
            checkout_link TEXT,
            bolt11 TEXT,
            payment_hash VARCHAR(255),
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            paid_at TIMESTAMP NULL,
            INDEX idx_invoice_id (invoice_id),
            INDEX idx_status (status),
            INDEX idx_email (email)
        )
    `;
    await db.execute(sql);
    console.log('✅ Table payments prête');
}


// 🔧 UTILITAIRES
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

// 🏪 SERVICE BTCPAY
class BTCPayService {
    static async createInvoice(amountSats, description = '', metadata = {}) {
        try {
            const response = await axios.post(
                `${config.btcpay.serverUrl}/api/v1/stores/${config.btcpay.storeId}/invoices`,
                {
                    amount: satsToBtc(amountSats),
                    currency: 'BTC',
                    checkout: {
                        paymentMethods: ['BTC-LightningNetwork']
                    },
                    metadata: metadata
                },
                {
                    headers: {
                        'Authorization': `token ${config.btcpay.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('❌ Erreur BTCPay:', error.response?.data || error.message);
            throw new Error('Création facture échouée');
        }
    }
}

// 📊 MODÈLE PAYMENT
class PaymentModel {
    static async create(data) {
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
            data.metadata ? JSON.stringify(data.metadata) : null
        ]);
        return result.insertId;
    }

    static async findByInvoiceId(invoiceId) {
        const sql = `SELECT * FROM payments WHERE invoice_id = ?`;
        const [rows] = await db.execute(sql, [invoiceId]);
        return rows[0];
    }

    static async updateStatus(invoiceId, status, paidAt = null) {
        const sql = `UPDATE payments SET status = ?, paid_at = ? WHERE invoice_id = ?`;
        await db.execute(sql, [status, paidAt, invoiceId]);
    }

    static async getAll(limit = 50, offset = 0, status = null) {
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

// 🛣️ ROUTES

// Créer un paiement
app.post('/api/payment', async (req, res) => {
    try {
        const { amountSats, email, description, metadata } = req.body;

        if (!amountSats || amountSats <= 0) {
            return res.status(400).json({ error: 'amountSats requis et > 0' });
        }

        // Créer facture BTCPay
        const invoice = await BTCPayService.createInvoice(amountSats, description, metadata);

        // Sauver en DB
        const paymentId = await PaymentModel.create({
            invoiceId: invoice.id,
            amountSats: amountSats,
            amountBtc: satsToBtc(amountSats),
            email,
            description,
            checkoutLink: invoice.checkoutLink,
            bolt11: invoice.bolt11,
            paymentHash: invoice.paymentHash,
            metadata
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
                status: 'pending'
            }
        });

    } catch (error) {
        console.error('❌ Erreur création:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Récupérer un paiement
app.get('/api/payment/:invoiceId', async (req, res) => {
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
                    btc: parseFloat(payment.amount_btc)
                },
                description: payment.description,
                metadata: payment.metadata ? JSON.parse(payment.metadata) : null,
                checkoutLink: payment.checkout_link,
                bolt11: payment.bolt11,
                createdAt: payment.created_at,
                paidAt: payment.paid_at
            }
        });

    } catch (error) {
        console.error('❌ Erreur récupération:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Liste des paiements
app.get('/api/payments', async (req, res) => {
    try {
        const { limit = 50, offset = 0, status } = req.query;
        const payments = await PaymentModel.getAll(
            parseInt(limit), 
            parseInt(offset), 
            status
        );

        res.json({
            success: true,
            payments: payments.map(p => ({
                id: p.id,
                invoiceId: p.invoice_id,
                email: p.email,
                status: p.status,
                amount: { sats: p.amount_sats, btc: parseFloat(p.amount_btc) },
                description: p.description,
                createdAt: p.created_at,
                paidAt: p.paid_at
            })),
            pagination: { limit: parseInt(limit), offset: parseInt(offset) }
        });

    } catch (error) {
        console.error('❌ Erreur liste:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Webhook BTCPay
app.post('/webhook/btcpay', async (req, res) => {
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

// Health check
app.get('/health', async (req, res) => {
    try {
        await db.ping();
        res.json({ 
            status: 'ok', 
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            database: 'disconnected'
        });
    }
});

// Route 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
});

// 🚀 DÉMARRAGE
async function start() {
    await initDatabase();
    
    app.listen(config.port, () => {
        console.log(`🚀 Serveur démarré sur le port ${config.port}`);
        console.log(`📊 Health: http://localhost:${config.port}/health`);
        console.log(`💰 API: http://localhost:${config.port}/api/payment`);
    });
}

process.on('SIGTERM', async () => {
    console.log('🔄 Arrêt...');
    if (db) await db.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🔄 Arrêt...');
    if (db) await db.end();
    process.exit(0);
});

start().catch(console.error);

module.exports = app;
