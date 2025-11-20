const express = require("express");
const router = express.Router();
const StripeWebhookController = require("../controllers/StripeWebhookController");

/**
 * IMPORTANT: this route must be registered in app.js (or server entry)
 * with express.raw({ type: 'application/json' }) middleware to preserve raw body for Stripe signature.
 *
 * Example in app.js:
 *   app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), require('./routes/stripeWebhook'));
 */
router.post("/", StripeWebhookController.webhook);

module.exports = router;