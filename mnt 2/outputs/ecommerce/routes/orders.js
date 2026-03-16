/**
 * routes/orders.js — Order lookup (public: by email + order number)
 */

const router = require('express').Router();
const db     = require('../db');

// GET /api/orders/lookup?email=&order_number=
router.get('/lookup', (req, res) => {
  const { email, order_number } = req.query;
  if (!email || !order_number) {
    return res.status(400).json({ error: 'email and order_number are required' });
  }

  const order = db.prepare(`
    SELECT * FROM orders
    WHERE customer_email = ? AND order_number = ?
  `).get(email.trim().toLowerCase(), order_number.trim().toUpperCase());

  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

  res.json({
    order: {
      ...order,
      items,
      subtotal_formatted: `$${db.helpers.formatPrice(order.subtotal)}`,
      shipping_formatted: `$${db.helpers.formatPrice(order.shipping)}`,
      tax_formatted:      `$${db.helpers.formatPrice(order.tax)}`,
      total_formatted:    `$${db.helpers.formatPrice(order.total)}`,
    }
  });
});

module.exports = router;
