import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  orders,
  paymentAttempts,
  products,
  type Order,
  type OrderItem,
  type PaymentAttempt,
} from './store.js';

interface PaymentBody {
  cardToken?: string;
}

interface ParsedCardToken {
  value: string;
  shouldFail: boolean;
}

function parseCardToken(value: unknown): ParsedCardToken | null {
  if (typeof value !== 'string') {
    return null;
  }

  const cardToken = value.trim();
  if (cardToken.length === 0) {
    return null;
  }

  return {
    value: cardToken,
    shouldFail: cardToken.startsWith('FAIL'),
  };
}

function isPayable(order: Order): boolean {
  return order.status === 'pending' && order.totalKrw > 0;
}

function createAttempt(order: Order, ok: boolean): PaymentAttempt {
  return {
    orderId: order.id,
    ok,
    amountKrw: order.totalKrw,
    at: new Date().toISOString(),
  };
}

function recordAttempt(order: Order, ok: boolean): void {
  paymentAttempts.push(createAttempt(order, ok));
}

function aggregateQuantities(items: OrderItem[]): Map<string, number> {
  const quantities = new Map<string, number>();

  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  return quantities;
}

function hasSufficientStock(order: Order): boolean {
  for (const [productId, quantity] of aggregateQuantities(order.items)) {
    const product = products.get(productId);
    if (!product || product.stock < quantity) {
      return false;
    }
  }

  return true;
}

function decrementStock(order: Order): void {
  for (const [productId, quantity] of aggregateQuantities(order.items)) {
    const product = products.get(productId);
    if (product) {
      product.stock -= quantity;
    }
  }
}

function completePayment(order: Order): Order {
  decrementStock(order);
  order.status = 'paid';
  recordAttempt(order, true);
  return order;
}

function rejectInvalidRequest(res: Response, message: string): void {
  res.status(400).json({ message });
}

export const paymentsRouter = Router();

paymentsRouter.post(
  '/:id/pay',
  (req: Request<{ id: string }, unknown, PaymentBody>, res: Response) => {
    try {
      const orderId = req.params.id;
      const order = orders.get(orderId);
      if (!order) {
        res.status(404).json({ message: 'Order not found' });
        return;
      }

      if (!isPayable(order)) {
        rejectInvalidRequest(res, 'Order is not payable');
        return;
      }

      const card = parseCardToken(req.body.cardToken);
      if (!card) {
        rejectInvalidRequest(res, 'Invalid card token');
        return;
      }

      if (card.shouldFail) {
        recordAttempt(order, false);
        order.status = 'payment_failed';
        res.status(402).json({ ok: false });
        return;
      }

      if (!hasSufficientStock(order)) {
        res.status(409).end();
        return;
      }

      const paidOrder = completePayment(order);
      res.json({ ok: true, order: paidOrder });
    } catch (e) {
      console.log(e);
      res.json({ ok: false });
    }
  },
);
