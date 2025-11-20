const Stripe = require("stripe");
const UserSubscription = require("../models/UserSubscription");
const Plan = require("../models/PlanSubscriptionSchema");
const { response } = require("../utils/response");
const mongoose = require("mongoose");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Stripe webhook handler
 * NOTE: route must use express.raw({type: 'application/json'}) to preserve raw body for signature verification.
 */
exports.webhook = async (req, res) => {
  let event;
  try {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      console.warn("Stripe webhook missing signature header");
      return res.status(400).send("Missing stripe signature");
    }

    // req.body must be the raw body buffer
    event = stripe.webhooks.constructEvent(req.rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err && err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription;
        const us = await UserSubscription.findOne({ stripeSubscriptionId: stripeSubId });
        if (us) {
          us.status = "active";
          us.paymentReference = invoice.id;
          us.metadata = us.metadata || {};
          us.metadata.lastInvoice = invoice;
          // extend endDate by one billing period if appropriate
          const plan = await Plan.findById(us.planId).lean();
          if (plan) {
            const currentEnd = us.endDate ? new Date(us.endDate) : new Date();
            us.startDate = us.startDate || new Date();
            us.endDate = new Date(currentEnd);
            if (plan.billing_period === "annual" || plan.billing_period === "year") {
              us.endDate.setFullYear(us.endDate.getFullYear() + 1);
            } else {
              us.endDate.setMonth(us.endDate.getMonth() + 1);
            }
          }
          await us.save();
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription;
        const us = await UserSubscription.findOne({ stripeSubscriptionId: stripeSubId });
        if (us) {
          // You might want to mark as unpaid or take action. Do not cancel automatically here.
          us.metadata = us.metadata || {};
          us.metadata.lastFailedInvoice = invoice;
          await us.save();
        }
        break;
      }

      case "customer.subscription.deleted":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const stripeSubId = subscription.id;
        const us = await UserSubscription.findOne({ stripeSubscriptionId: stripeSubId });
        if (us) {
          // Map Stripe status to our DB status
          if (subscription.status === "active") {
            us.status = "active";
          } else if (subscription.status === "canceled" || subscription.status === "deleted") {
            us.status = "cancelled";
          } else if (subscription.pause_collection && subscription.pause_collection.resumes_at) {
            us.status = "paused";
          } else {
            // pending or incomplete etc - keep as-is or set to active/inactive as desired
            us.status = subscription.status || us.status;
          }
          us.metadata = us.metadata || {};
          us.metadata.stripeRaw = subscription;
          await us.save();
        }
        break;
      }

      default:
        // Other events can be logged for debugging
        // console.log(`Unhandled event type ${event.type}`);
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("Error handling stripe webhook:", err);
    return res.status(500).send("Webhook handler error");
  }
};