import {
  DefaultLogger,
  examplePaymentHandler,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { CustomerManagedGroupsPlugin } from '../src';
import {
  activeCustomerManagedGroupMemberQuery,
  addCustomerToGroupMutation,
  createCustomerManagedGroupMutation,
  getOrdersForMyCustomerManagedGroup,
  myCustomerManagedGroupQuery,
  removeCustomerFromGroupMutation,
} from './test-helpers';
import { createSettledOrder } from '../../test/src/shop-utils';

jest.setTimeout(10000);

describe('Customer managed groups', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [CustomerManagedGroupsPlugin],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
      },
    });

    ({ server, adminClient, shopClient } = createTestEnvironment(config));
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
      customerCount: 5,
    });
  }, 60000);

  async function authorizeAsGroupAdmin(): Promise<void> {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test'
    );
  }

  async function authorizeAsGroupParticipant(): Promise<void> {
    await shopClient.asUserWithCredentials('eliezer56@yahoo.com', 'test');
  }

  it('Should start successfully', async () => {
    expect(server.app.getHttpServer).toBeDefined;
  });

  it('Fails for unauthenticated calls', async () => {
    expect.assertions(1);
    try {
      await shopClient.query(addCustomerToGroupMutation, {
        input: {
          emailAddress: 'marques.sawayn@hotmail.com',
        },
      });
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        'You are not currently authorized to perform this action'
      );
    }
  });

  it('Returns undefined for myCustomerManagedGroup when not in a group', async () => {
    await authorizeAsGroupAdmin();
    const { myCustomerManagedGroup: group } = await shopClient.query(
      myCustomerManagedGroupQuery
    );
    expect(group).toBe(null);
  });

  it('Returns undefined for activeCustomerManagedGroupMember when not in a group', async () => {
    await authorizeAsGroupAdmin();
    const { activeCustomerManagedGroupMember: member } = await shopClient.query(
      activeCustomerManagedGroupMemberQuery
    );
    expect(member).toBe(null);
  });

  it('Adds a customer to my group', async () => {
    await authorizeAsGroupAdmin();
    const { addCustomerToMyCustomerManagedGroup: group } =
      await shopClient.query(addCustomerToGroupMutation, {
        input: {
          emailAddress: 'marques.sawayn@hotmail.com',
        },
      });
    const hayden = group.customers.find(
      (c: any) => c.emailAddress === 'hayden.zieme12@hotmail.com'
    );
    const marques = group.customers.find(
      (c: any) => c.emailAddress === 'marques.sawayn@hotmail.com'
    );
    expect(group.name).toBe("Zieme's Group");
    expect(hayden.isGroupAdministrator).toBe(true);
    expect(marques.isGroupAdministrator).toBe(false);
  });

  it('Returns active member when in a group', async () => {
    await authorizeAsGroupAdmin();
    const { activeCustomerManagedGroupMember: member } = await shopClient.query(
      activeCustomerManagedGroupMemberQuery
    );
    expect(member.isGroupAdministrator).toBe(true);
  });

  it('Returns my group', async () => {
    await authorizeAsGroupAdmin();
    const { myCustomerManagedGroup: group } = await shopClient.query(
      myCustomerManagedGroupQuery
    );
    expect(group.name).toBe("Zieme's Group");
  });

  it('Adds another customer to my group', async () => {
    await authorizeAsGroupAdmin();
    const { addCustomerToMyCustomerManagedGroup: group } =
      await shopClient.query(addCustomerToGroupMutation, {
        input: {
          emailAddress: 'eliezer56@yahoo.com',
        },
      });
    const marques = group.customers.find(
      (c: any) => c.emailAddress === 'marques.sawayn@hotmail.com'
    );
    const eliezer = group.customers.find(
      (c: any) => c.emailAddress === 'eliezer56@yahoo.com'
    );
    expect(marques.isGroupAdministrator).toBe(false);
    expect(eliezer.isGroupAdministrator).toBe(false);
  });

  it('Fails to create a group if user is already in a group', async () => {
    expect.assertions(1);
    await authorizeAsGroupAdmin();
    try {
      await shopClient.query(createCustomerManagedGroupMutation);
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        'You are already in a customer managed group'
      );
    }
  });

  it('Fails when a participant tries to add customers', async () => {
    expect.assertions(1);
    await authorizeAsGroupParticipant();
    try {
      await shopClient.query(addCustomerToGroupMutation, {
        input: {
          emailAddress: 'marques.sawayn@hotmail.com',
        },
      });
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        'You are not administrator of your group'
      );
    }
  });

  it('Places an order for the group participant', async () => {
    await authorizeAsGroupParticipant();
    const order = await createSettledOrder(shopClient, 1, false);
    expect(order.code).toBeDefined();
  });

  it('Places an order for the group admin', async () => {
    await authorizeAsGroupAdmin();
    const order = await createSettledOrder(shopClient, 1, false);
    expect(order.code).toBeDefined();
  });

  it('Fails to fetch orders when unauthenticated', async () => {
    expect.assertions(1);
    await shopClient.asAnonymousUser();
    try {
      await shopClient.query(getOrdersForMyCustomerManagedGroup);
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        'You are not currently authorized to perform this action'
      );
    }
  });

  it('Fetches 2 orders for the group admin', async () => {
    await authorizeAsGroupAdmin();
    const orders = await shopClient.query(getOrdersForMyCustomerManagedGroup);
    expect(orders.ordersForMyCustomerManagedGroup.totalItems).toBe(2);
    expect(orders.ordersForMyCustomerManagedGroup.items[0].code).toBeDefined();
    expect(orders.ordersForMyCustomerManagedGroup.items[1].code).toBeDefined();
  });

  it('Fetches 1 order for the group participant', async () => {
    await authorizeAsGroupParticipant();
    const orders = await shopClient.query(getOrdersForMyCustomerManagedGroup);
    expect(orders.ordersForMyCustomerManagedGroup.totalItems).toBe(1);
  });

  it('Fails to remove as group participant', async () => {
    expect.assertions(1);
    await authorizeAsGroupParticipant();
    try {
      await shopClient.query(removeCustomerFromGroupMutation, {
        customerId: '3', // marques.sawayn@hotmail.com
      });
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        'You are not administrator of your group'
      );
    }
  });

  it('Removes customer ', async () => {
    await authorizeAsGroupAdmin();
    const { removeCustomerFromMyCustomerManagedGroup: group } =
      await shopClient.query(removeCustomerFromGroupMutation, {
        customerId: '3', // marques.sawayn@hotmail.com
      });
    const marques = group.customers.find(
      (c: any) => c.emailAddress === 'marques.sawayn@hotmail.com'
    );
    expect(marques).toBeUndefined();
  });

  it('Adds another group admin to my group', async () => {
    await authorizeAsGroupAdmin();
    const { addCustomerToMyCustomerManagedGroup: group } =
      await shopClient.query(addCustomerToGroupMutation, {
        input: {
          emailAddress: 'marques.sawayn@hotmail.com',
          isGroupAdmin: true,
        },
      });
    const marques = group.customers.find(
      (c: any) => c.emailAddress === 'marques.sawayn@hotmail.com'
    );
    expect(marques.isGroupAdministrator).toBe(true);
  });

  it('Removes an admin from the group', async () => {
    await authorizeAsGroupAdmin();
    const { removeCustomerFromMyCustomerManagedGroup: group } =
      await shopClient.query(removeCustomerFromGroupMutation, {
        customerId: '3', // marques.sawayn@hotmail.com
      });
    const marques = group.customers.find(
      (c: any) => c.emailAddress === 'marques.sawayn@hotmail.com'
    );
    expect(marques).toBeUndefined();
  });

  afterAll(async () => {
    await server.destroy();
  });
});