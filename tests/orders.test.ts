import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/server.js';
import { orders, paymentAttempts, products, resetStore } from '../src/store.js';

describe('order operations', () => {
  beforeEach(() => {
    resetStore();
  });

  it('creates an order', async () => {
    const response = await request(app)
      .post('/orders')
      .send({ items: [{ productId: 'keyboard', quantity: 1 }] });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      items: [{ productId: 'keyboard', quantity: 1 }],
      totalKrw: 49_000,
      status: 'pending',
    });
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.createdAt).toEqual(expect.any(String));
    expect(orders.get(response.body.id)).toMatchObject({
      id: response.body.id,
      items: [{ productId: 'keyboard', quantity: 1 }],
      totalKrw: 49_000,
      status: 'pending',
      createdAt: response.body.createdAt,
    });
  });

  it('rejects an order when aggregated quantities exceed stock without changing orders or products', async () => {
    const response = await request(app)
      .post('/orders')
      .send({
        items: [
          { productId: 'keyboard', quantity: 3 },
          { productId: 'mouse', quantity: 1 },
          { productId: 'keyboard', quantity: 3 },
        ],
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: 'Insufficient stock' });
    expect(orders.size).toBe(0);
    expect(products.get('keyboard')?.stock).toBe(5);
    expect(products.get('mouse')?.stock).toBe(10);
    expect(products.get('monitor')?.stock).toBe(2);
  });

  it('stores a sufficiently stocked multi-item order as pending without decrementing stock', async () => {
    const response = await request(app)
      .post('/orders')
      .send({
        items: [
          { productId: 'keyboard', quantity: 1 },
          { productId: 'mouse', quantity: 2 },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('pending');
    expect(products.get('keyboard')?.stock).toBe(5);
    expect(products.get('mouse')?.stock).toBe(10);
  });

  it('gets an order', async () => {
    const created = await request(app)
      .post('/orders')
      .send({ items: [{ productId: 'mouse', quantity: 1 }] });
    const response = await request(app).get(`/orders/${created.body.id as string}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(created.body);
  });

  it('decrements aggregated stock once and records a successful payment', async () => {
    const created = await request(app)
      .post('/orders')
      .send({
        items: [
          { productId: 'keyboard', quantity: 1 },
          { productId: 'mouse', quantity: 1 },
          { productId: 'keyboard', quantity: 2 },
        ],
      });
    const response = await request(app)
      .post(`/orders/${created.body.id as string}/pay`)
      .send({ cardToken: 'CARD-123' });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.order).toMatchObject({
      id: created.body.id,
      items: [
        { productId: 'keyboard', quantity: 1 },
        { productId: 'mouse', quantity: 1 },
        { productId: 'keyboard', quantity: 2 },
      ],
      totalKrw: 170_000,
      status: 'paid',
      createdAt: created.body.createdAt,
    });
    expect(orders.get(created.body.id as string)?.status).toBe('paid');
    expect(products.get('keyboard')?.stock).toBe(2);
    expect(products.get('mouse')?.stock).toBe(9);
    expect(paymentAttempts).toHaveLength(1);
    expect(paymentAttempts[0]).toMatchObject({ orderId: created.body.id, ok: true });

    await request(app)
      .post(`/orders/${created.body.id as string}/pay`)
      .send({ cardToken: 'CARD-123' });

    expect(products.get('keyboard')?.stock).toBe(2);
    expect(products.get('mouse')?.stock).toBe(9);
    expect(paymentAttempts).toHaveLength(1);
  });

  it('leaves a multi-item pending order, all stock, and attempts unchanged when stock is insufficient at payment time', async () => {
    const created = await request(app)
      .post('/orders')
      .send({
        items: [
          { productId: 'keyboard', quantity: 1 },
          { productId: 'mouse', quantity: 1 },
        ],
      });
    const orderId = created.body.id as string;
    const keyboard = products.get('keyboard');
    if (!keyboard) {
      throw new Error('Expected seeded keyboard product');
    }
    keyboard.stock = 0;

    const response = await request(app)
      .post(`/orders/${orderId}/pay`)
      .send({ cardToken: 'CARD-123' });

    expect(response.status).toBe(409);
    expect(orders.get(orderId)?.status).toBe('pending');
    expect(products.get('keyboard')?.stock).toBe(0);
    expect(products.get('mouse')?.stock).toBe(10);
    expect(paymentAttempts).toHaveLength(0);
  });

  it('preserves a failed payment order and its attempt without decrementing stock', async () => {
    const created = await request(app)
      .post('/orders')
      .send({ items: [{ productId: 'mouse', quantity: 2 }] });
    const orderId = created.body.id as string;

    const payment = await request(app)
      .post(`/orders/${orderId}/pay`)
      .send({ cardToken: 'FAIL-CARD' });
    const fetched = await request(app).get(`/orders/${orderId}`);

    expect(payment.status).toBe(402);
    expect(payment.body).toEqual({ ok: false });
    expect(fetched.status).toBe(200);
    expect(fetched.body).toMatchObject({
      id: orderId,
      items: [{ productId: 'mouse', quantity: 2 }],
      totalKrw: 46_000,
      status: 'payment_failed',
      createdAt: created.body.createdAt,
    });
    expect(paymentAttempts).toHaveLength(1);
    expect(paymentAttempts[0]).toMatchObject({
      orderId,
      ok: false,
      amountKrw: 46_000,
    });
    expect(paymentAttempts[0]?.at).toEqual(expect.any(String));
    expect(Date.parse(paymentAttempts[0]?.at ?? '')).not.toBeNaN();
    expect(products.get('mouse')?.stock).toBe(10);
  });

  it('does not change a failed order, attempts, or stock when it is paid again', async () => {
    const created = await request(app)
      .post('/orders')
      .send({ items: [{ productId: 'monitor', quantity: 1 }] });
    const orderId = created.body.id as string;
    await request(app)
      .post(`/orders/${orderId}/pay`)
      .send({ cardToken: 'FAIL-CARD' });

    const attemptsBeforeRetry = paymentAttempts.length;
    const stockBeforeRetry = products.get('monitor')?.stock;

    const retry = await request(app)
      .post(`/orders/${orderId}/pay`)
      .send({ cardToken: 'CARD-123' });

    expect(retry.status).toBe(400);
    expect(retry.body).toEqual({ message: 'Order is not payable' });
    expect(orders.get(orderId)?.status).toBe('payment_failed');
    expect(paymentAttempts).toHaveLength(attemptsBeforeRetry);
    expect(products.get('monitor')?.stock).toBe(stockBeforeRetry);
  });

  it('returns an approved internal error response and preserves payment error context', async () => {
    const created = await request(app)
      .post('/orders')
      .send({ items: [{ productId: 'keyboard', quantity: 1 }] });
    const orderId = created.body.id as string;
    const order = orders.get(orderId);
    if (!order) {
      throw new Error('Expected created order');
    }

    const originalItems = order.items;
    const unexpected = new Error('Simulated payment exception');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    Object.defineProperty(order, 'items', {
      configurable: true,
      enumerable: true,
      get: () => {
        throw unexpected;
      },
    });

    try {
      const response = await request(app)
        .post(`/orders/${orderId}/pay`)
        .send({ cardToken: 'CARD-123' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        ok: false,
        error: 'internal_error',
        requestId: expect.any(String),
      });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          errorType: 'Error',
          requestId: response.body.requestId,
          orderId,
          phase: 'inventory_check',
          message: 'Simulated payment exception',
          stack: expect.any(String),
          beforeStatus: 'pending',
          afterStatus: 'pending',
          location: 'paymentsRouter.post /:id/pay',
        }),
      );
      expect(paymentAttempts).toHaveLength(0);
      expect(products.get('keyboard')?.stock).toBe(5);
    } finally {
      Object.defineProperty(order, 'items', {
        configurable: true,
        enumerable: true,
        value: originalItems,
        writable: true,
      });
      errorSpy.mockRestore();
    }
  });

  it('lists a pending order for administrators', async () => {
    const created = await request(app)
      .post('/orders')
      .send({ items: [{ productId: 'keyboard', quantity: 1 }] });

    const response = await request(app).get('/admin/orders');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: created.body.id,
        totalKrw: 49_000,
        status: 'pending',
        createdAt: created.body.createdAt,
      },
    ]);
  });

  it('returns an approved internal error response and preserves admin error context', async () => {
    const unexpected = new Error('Simulated admin exception');
    const originalValues = orders.values;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    orders.values = () => {
      throw unexpected;
    };

    try {
      const response = await request(app).get('/admin/orders');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        ok: false,
        error: 'internal_error',
        requestId: expect.any(String),
      });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          errorType: 'Error',
          requestId: response.body.requestId,
          orderId: undefined,
          phase: 'list_orders',
          message: 'Simulated admin exception',
          stack: expect.any(String),
          beforeStatus: undefined,
          afterStatus: undefined,
          location: 'adminRouter.get /orders',
        }),
      );
    } finally {
      orders.values = originalValues;
      errorSpy.mockRestore();
    }
  });

  // 정책은 실패 주문 상태를 `payment_failed`로 요구하지만, 현재 구현은 `결제실패`를 파생한다.
  it.fails('lists stored orders with their policy statuses for administrators', async () => {
    const pending = await request(app)
      .post('/orders')
      .send({ items: [{ productId: 'keyboard', quantity: 1 }] });
    const failed = await request(app)
      .post('/orders')
      .send({ items: [{ productId: 'mouse', quantity: 2 }] });
    await request(app)
      .post(`/orders/${failed.body.id as string}/pay`)
      .send({ cardToken: 'FAIL-CARD' });

    const response = await request(app).get('/admin/orders');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body).toEqual(
      expect.arrayContaining([
        {
          id: pending.body.id,
          totalKrw: 49_000,
          status: 'pending',
          createdAt: pending.body.createdAt,
        },
        {
          id: failed.body.id,
          totalKrw: 46_000,
          status: 'payment_failed',
          createdAt: failed.body.createdAt,
        },
      ]),
    );
  });
});
