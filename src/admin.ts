import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { orders, paymentAttempts, type Order, type PaymentAttempt } from './store.js';

type DisplayStatus = Order['status'] | '결제실패';

interface AdminOrder {
  id: string;
  totalKrw: number;
  status: DisplayStatus;
  createdAt: string;
  paymentFailure?: {
    amountKrw: number;
    at: string;
    reason: 'payment_declined';
  };
}

function deriveDisplayStatus(order: Order): DisplayStatus {
  const attempts = paymentAttempts.filter((attempt) => attempt.orderId === order.id);
  if (attempts.some((attempt) => !attempt.ok)) {
    return '결제실패';
  }
  return order.status;
}

function latestFailureAttempt(orderId: string): PaymentAttempt | undefined {
  const attempts = paymentAttempts.filter((attempt) => attempt.orderId === orderId && !attempt.ok);
  for (const attempt of attempts) {
    if (
      typeof attempt.amountKrw !== 'number' || !Number.isFinite(attempt.amountKrw) ||
      attempt.amountKrw < 0 || typeof attempt.at !== 'string' ||
      !Number.isFinite(Date.parse(attempt.at)) || attempt.reason !== 'payment_declined'
    ) {
      throw new Error('Incomplete payment failure attempt');
    }
  }
  return attempts.sort((left, right) => Date.parse(right.at) - Date.parse(left.at))[0];
}

function toAdminOrder(order: Order): AdminOrder {
  const adminOrder: AdminOrder = {
    id: order.id,
    totalKrw: order.totalKrw,
    status: deriveDisplayStatus(order),
    createdAt: order.createdAt,
  };

  if (order.status === 'payment_failed') {
    const attempt = latestFailureAttempt(order.id);
    if (!attempt || attempt.reason !== 'payment_declined') {
      throw new Error('Missing completed payment failure attempt');
    }
    adminOrder.paymentFailure = {
      amountKrw: attempt.amountKrw,
      at: attempt.at,
      reason: attempt.reason,
    };
  }

  return adminOrder;
}

export const adminRouter = Router();

adminRouter.get('/orders', (_req: Request, res: Response) => {
  const requestId = randomUUID();
  const phase = 'list_orders';

  try {
    res.json(Array.from(orders.values(), toAdminOrder));
  } catch (error) {
    console.error({
      errorType: error instanceof Error ? error.name : typeof error,
      requestId,
      orderId: undefined,
      phase,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      beforeStatus: undefined,
      afterStatus: undefined,
      location: 'adminRouter.get /orders',
    });
    res.status(500).json({ ok: false, error: 'internal_error', requestId });
  }
});
