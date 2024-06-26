import {
  mergeConfig,
  DefaultLogger,
  LogLevel,
  OrderService,
  RequestContext,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
  SimpleGraphQLClient,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { afterAll, beforeAll, expect, it, describe, vi } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import nock from 'nock';

import { ShipmatePlugin } from '../src/shipmate.plugin';
import { mockShipment } from './test-helpers';
import { createSettledOrder } from '../../test/src/shop-utils';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { getSuperadminContext } from '@vendure/testing/lib/utils/get-superadmin-context';
import { ShipmateConfigService } from '../src/api/shipmate-config.service';
import axios from 'axios';
import type { TrackingEventPayload } from '../src/types';
import { authToken } from './test-helpers';
import { OrderCodeStrategy } from '@vendure/core';

class MockOrderCodeStrategy implements OrderCodeStrategy {
  generate(ctx: RequestContext): string | Promise<string> {
    // Mock order code as 'FBJYSHC7WTRQEA14', as defined in the mock object
    return mockShipment.shipment_reference;
  }
}

describe('Shipmate plugin', async () => {
  let server: TestServer;
  let shopClient: SimpleGraphQLClient;
  let ctx: RequestContext;
  const port = 3105;
  const nockBaseUrl = 'https://api-staging.shipmate.co.uk/v1.2';
  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      apiOptions: {
        port,
      },
      plugins: [
        ShipmatePlugin.init({
          apiUrl: nockBaseUrl,
        }),
      ],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
      },
      orderOptions: {
        orderCodeStrategy: new MockOrderCodeStrategy(),
      },
    });

    ({ server, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData: {
        ...initialData,
        paymentMethods: [
          {
            name: testPaymentMethod.code,
            handler: { code: testPaymentMethod.code, arguments: [] },
          },
        ],
      },
      productsCsvPath: '../test/src/products-import.csv',
      customerCount: 2,
    });
    ctx = await getSuperadminContext(server.app);
    await server.app
      .get(ShipmateConfigService)
      .upsertConfig(
        ctx,
        'SHIPMATE_API_KEY',
        'SHIPMATE_USERNAME',
        'SHIPMATE_PASSWORD',
        [authToken]
      );
  }, 60000);

  it('Should start successfully', () => {
    expect(server.app.getHttpServer()).toBeDefined();
  });

  it('Should create a Shipment when an Order is placed', async () => {
    nock(nockBaseUrl)
      .post('/tokens', (reqBody) => {
        return true;
      })
      .reply(200, {
        message: 'Login Successful',
        data: {
          token: '749a75e3c1048965c498017efae8051f',
        },
      });
    let shipmentRequest: any;
    nock(nockBaseUrl)
      .post('/shipments', (reqBody) => {
        shipmentRequest = reqBody;
        return true;
      })
      .reply(200, { data: [mockShipment], message: 'Shipment Created' });
    await createSettledOrder(shopClient, 'T_1');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const orderService = server.app.get(OrderService);
    const detailedOrder = await orderService.findOne(ctx, 1);
    expect(shipmentRequest?.shipment_reference).toBe(detailedOrder?.code);
  });

  it('Should mark Order as Shipped when receiving "TRACKING_COLLECTED" event', async () => {
    const result = await axios.post(`http://localhost:${port}/shipmate`, <
      TrackingEventPayload
    >{
      auth_token: authToken,
      event: 'TRACKING_COLLECTED',
      shipment_reference: mockShipment.shipment_reference,
    });
    //shipmate's api expects a status of 201
    expect(result.status).toBe(201);
    // await new Promise((resolve) => setTimeout(resolve, 4000));
    const orderService = server.app.get(OrderService);
    const detailedOrder = await orderService.findOne(ctx, 1, ['fulfillments']);
    expect(detailedOrder?.state).toBe('Shipped');
    expect(detailedOrder?.fulfillments?.length).toBeGreaterThan(0);
  });

  it('Should mark Order as Delivered when receiving "TRACKING_DELIVERED" event', async () => {
    const result = await axios.post(`http://localhost:${port}/shipmate`, <
      TrackingEventPayload
    >{
      auth_token: authToken,
      event: 'TRACKING_DELIVERED',
      shipment_reference: mockShipment.shipment_reference,
    });
    //shipmate's api expects a status of 201
    expect(result.status).toBe(201);
    // await new Promise((resolve) => setTimeout(resolve, 4000));
    const orderService = server.app.get(OrderService);
    const detailedOrder = await orderService.findOne(ctx, 1, ['fulfillments']);
    expect(detailedOrder?.state).toBe('Delivered');
    expect(detailedOrder?.fulfillments?.length).toBeGreaterThan(0);
  });

  afterAll(() => {
    return server.destroy();
  });
});
