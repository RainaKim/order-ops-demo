import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  orders,
  products,
  type Order,
  type OrderItem,
} from './store.js';

interface CreateOrderBody {
  items?: OrderItem[];
}

function isOrderItem(value: unknown): value is OrderItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.productId === 'string' &&
    typeof item.quantity === 'number' &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0
  );
}

function calculateTotal(items: OrderItem[]): number | null {
  let totalKrw = 0;

  for (const item of items) {
    const product = products.get(item.productId);
    if (!product) {
      return null;
    }
    totalKrw += product.priceKrw * item.quantity;
  }

  return totalKrw;
}

function aggregateQuantities(items: OrderItem[]): Map<string, number> {
  const quantities = new Map<string, number>();

  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  return quantities;
}

function hasSufficientStock(items: OrderItem[]): boolean {
  for (const [productId, quantity] of aggregateQuantities(items)) {
    const product = products.get(productId);
    if (!product || product.stock < quantity) {
      return false;
    }
  }

  return true;
}

export const ordersRouter = Router();

ordersRouter.post('/', (req: Request<unknown, unknown, CreateOrderBody>, res: Response) => {
  const items = req.body.items;

  if (!Array.isArray(items) || items.length === 0 || !items.every(isOrderItem)) {
    res.status(400).json({ message: 'Invalid items' });
    return;
  }

  const totalKrw = calculateTotal(items);
  if (totalKrw === null) {
    res.status(400).json({ message: 'Unknown product' });
    return;
  }

  if (!hasSufficientStock(items)) {
    res.status(409).json({ message: 'Insufficient stock' });
    return;
  }

  const order: Order = {
    id: randomUUID(),
    items: items.map((item) => ({ ...item })),
    totalKrw,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  orders.set(order.id, order);
  res.status(201).json(order);
});

ordersRouter.get('/:id', (req: Request<{ id: string }>, res: Response) => {
  const order = orders.get(req.params.id);

  if (!order) {
    res.status(404).json({ message: 'Order not found' });
    return;
  }

  res.json(order);
});
