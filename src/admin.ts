import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { orders, paymentAttempts, type Order } from './store.js';

type DisplayStatus = Order['status'] | '결제실패';

interface AdminOrder {
  id: string;
  totalKrw: number;
  status: DisplayStatus;
  createdAt: string;
}

function deriveDisplayStatus(order: Order): DisplayStatus {
  const attempts = paymentAttempts.filter((attempt) => attempt.orderId === order.id);
  if (attempts.some((attempt) => !attempt.ok)) {
    return '결제실패';
  }
  return order.status;
}

function toAdminOrder(order: Order): AdminOrder {
  return {
    id: order.id,
    totalKrw: order.totalKrw,
    status: deriveDisplayStatus(order),
    createdAt: order.createdAt,
  };
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
