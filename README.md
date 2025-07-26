# 💰 BTCPay Payments API

API REST simple pour gérer les paiements Bitcoin via BTCPay Server.

## 🚀 Installation Rapide

```bash
# 1. Cloner le projet
git clone <your-repo>
cd btcpay-payments-api

# 2. Installer les dépendances
npm install

# 3. Configurer la base de données MySQL
mysql -u root -p
CREATE DATABASE btcpay_payments;

# 4. Configurer .env (voir exemple ci-dessous)
cp .env.example .env

# 5. Démarrer l'API
npm start
```

## ⚙️ Configuration (.env)

```bash
# Base de données
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=votre_mot_de_passe
DB_NAME=btcpay_payments

# BTCPay Server
BTCPAY_SERVER_URL=https://votre-btcpay.com
BTCPAY_STORE_ID=votre_store_id
BTCPAY_API_KEY=votre_api_key
BTCPAY_WEBHOOK_SECRET=votre_webhook_secret
```

## 📡 API Endpoints

### Créer un paiement
```http
POST /api/payment
Content-Type: application/json

{
    "amountSats": 100000,
    "description": "Test payment",
    "metadata": { "orderId": "12345" }
}
```

**Réponse :**
```json
{
    "success": true,
    "payment": {
        "id": 1,
        "invoiceId": "ABC123",
        "checkoutLink": "https://btcpay.../invoice?id=ABC123",
        "bolt11": "lnbc1000...",
        "amount": { "sats": 100000, "btc": 0.001 },
        "status": "pending"
    }
}
```

### Récupérer un paiement
```http
GET /api/payment/:invoiceId
```

### Liste des paiements
```http
GET /api/payments?status=paid&limit=10&offset=0
```

### Health Check
```http
GET /health
```

## 🔔 Webhook BTCPay

L'API reçoit automatiquement les webhooks BTCPay sur :
```
POST /webhook/btcpay
```

**Statuts mis à jour automatiquement :**
- `InvoiceSettled` → `paid`
- `InvoiceExpired` → `expired`
- `InvoiceInvalid` → `invalid`

## 🗄️ Base de Données

Une seule table `payments` :

| Champ | Type | Description |
|-------|------|-------------|
| id | INT | ID unique |
| invoice_id | VARCHAR | ID facture BTCPay |
| amount_sats | BIGINT | Montant en satoshis |
| amount_btc | DECIMAL | Montant en BTC |
| description | TEXT | Description |
| status | ENUM | pending/paid/expired/invalid |
| metadata | JSON | Données personnalisées |
| created_at | TIMESTAMP | Date création |
| paid_at | TIMESTAMP | Date paiement |

## 🔧 Développement

```bash
# Mode développement avec auto-reload
npm run dev

# Logs en temps réel
tail -f logs/app.log
```

## 🛡️ Sécurité

- ✅ **Vérification signature** HMAC des webhooks
- ✅ **Headers sécurisés** avec Helmet.js  
- ✅ **Protection CORS**
- ✅ **Validation des données** d'entrée

## 📊 Monitoring

- **Health check** : `GET /health`
- **Logs console** avec timestamps
- **Statuts MySQL** dans health check

## 🐳 Docker (Optionnel)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t btcpay-api .
docker run -p 3000:3000 --env-file .env btcpay-api
```

## 🆘 Dépannage

**Erreur DB :**
```bash
# Vérifier MySQL
mysql -u root -p -e "SHOW DATABASES;"

# Créer la DB si besoin
mysql -u root -p -e "CREATE DATABASE btcpay_payments;"
```

**Erreur BTCPay :**
- Vérifier l'URL du serveur
- Vérifier l'API key et Store ID
- Tester manuellement : `curl -H "Authorization: token YOUR_KEY" https://btcpay.../api/v1/stores`

## 📝 Licence

MIT