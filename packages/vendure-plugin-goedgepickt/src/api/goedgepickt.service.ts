import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  ChannelService,
  ConfigService,
  EntityHydrator,
  EventBus,
  ID,
  JobQueue,
  JobQueueService,
  ListQueryBuilder,
  Logger,
  Order,
  OrderItem,
  OrderPlacedEvent,
  OrderService,
  ProductPriceApplicator,
  ProductVariant,
  ProductVariantService,
  RequestContext,
  TransactionalConnection,
  Translated,
  translateDeep,
} from '@vendure/core';
import { GoedgepicktClient } from './goedgepickt.client';
import {
  GoedgepicktEvent,
  GoedgepicktPluginConfig,
  Order as GgOrder,
  OrderInput,
  OrderItemInput,
  OrderStatus,
  ProductInput,
} from './goedgepickt.types';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { GoedgepicktConfigEntity } from './goedgepickt-config.entity';
import { fulfillAll, transitionToDelivered } from '../../../util/src';
import { goedgepicktHandler } from './goedgepickt.handler';
import { PickupPointCustomFields } from './custom-fields';

interface StockInput {
  variantId: string;
  stock: number;
}

type VariantWithImage = {
  id: ID;
  productId: ID;
  sku: string;
  name: string;
  price: number;
  absoluteImageUrl?: string;
};

@Injectable()
export class GoedgepicktService
  implements OnApplicationBootstrap, OnModuleInit
{
  readonly queryLimit: number;
  public fullSyncQueue: JobQueue<{ channelToken: string }> | undefined;
  private autofulfilleQueue:
    | JobQueue<{ channelToken: string; orderCode: string }>
    | undefined;

  constructor(
    private variantService: ProductVariantService,
    private channelService: ChannelService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: GoedgepicktPluginConfig,
    private configService: ConfigService,
    private connection: TransactionalConnection,
    private jobQueueService: JobQueueService,
    private orderService: OrderService,
    private entityHydrator: EntityHydrator,
    private listQueryBuilder: ListQueryBuilder,
    private eventBus: EventBus,
    private productPriceApplicator: ProductPriceApplicator
  ) {
    this.queryLimit = configService.apiOptions.adminListQueryLimit;
  }

  async onModuleInit() {
    // Start JobQueue
    this.fullSyncQueue = await this.jobQueueService.createQueue({
      name: 'goedgepickt-full-sync',
      process: async (job) =>
        await this.fullSync(job.data.channelToken).catch((error) => {
          Logger.error(
            `Failed to sync products and stocklevels for ${job.data.channelToken}: ${error.message}`,
            loggerCtx,
            error
          );
        }),
    });
    this.autofulfilleQueue = await this.jobQueueService.createQueue({
      name: 'autofulfill-goedgepickt-orders',
      process: async (job) =>
        await this.autoFulfill(job.data.channelToken, job.data.orderCode).catch(
          (e) => {
            Logger.error(
              `Failed to autofulfill order ${job.data.orderCode}`,
              loggerCtx,
              e
            );
          }
        ),
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    // Listen for Settled orders for autoFulfillment
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async (event) => {
      await this.autofulfilleQueue!.add({
        orderCode: event.order.code,
        channelToken: event.ctx.channel.token,
      });
    });
  }

  async upsertConfig(
    config: Partial<GoedgepicktConfigEntity>
  ): Promise<GoedgepicktConfigEntity> {
    const existing = await this.connection
      .getRepository(GoedgepicktConfigEntity)
      .findOne({ channelToken: config.channelToken });
    if (existing) {
      await this.connection
        .getRepository(GoedgepicktConfigEntity)
        .update(existing.id, config);
    } else {
      await this.connection
        .getRepository(GoedgepicktConfigEntity)
        .insert(config);
    }
    return this.connection
      .getRepository(GoedgepicktConfigEntity)
      .findOneOrFail({ channelToken: config.channelToken });
  }

  async getConfig(
    channelToken: string
  ): Promise<GoedgepicktConfigEntity | undefined> {
    return this.connection
      .getRepository(GoedgepicktConfigEntity)
      .findOne({ channelToken });
  }

  async getConfigs(): Promise<GoedgepicktConfigEntity[]> {
    return this.connection.getRepository(GoedgepicktConfigEntity).find();
  }

  /**
   * Set webhook and update secrets in DB
   */
  async setWebhooks(channelToken: string): Promise<GoedgepicktConfigEntity> {
    const client = await this.getClientForChannel(channelToken);
    const webhookTarget = this.getWebhookUrl(channelToken);
    // Check if webhooks already present
    const webhooks = await client.getWebhooks();
    const orderStatusWebhook = webhooks.find(
      (webhook) =>
        webhook.targetUrl === webhookTarget &&
        webhook.webhookEvent === GoedgepicktEvent.orderStatusChanged
    );
    const stockWebhook = webhooks.find(
      (webhook) =>
        webhook.targetUrl === webhookTarget &&
        webhook.webhookEvent === GoedgepicktEvent.stockChanged
    );
    let orderSecret = orderStatusWebhook?.webhookSecret;
    let stockSecret = stockWebhook?.webhookSecret;
    if (!orderSecret) {
      Logger.info(
        `Creating OrderStatusWebhook because it didn't exist.`,
        loggerCtx
      );
      const created = await client.createWebhook({
        webhookEvent: GoedgepicktEvent.orderStatusChanged,
        targetUrl: webhookTarget,
      });
      orderSecret = created.webhookSecret;
    } else {
      Logger.info(`OrderStatusWebhook already present`, loggerCtx);
    }
    if (!stockSecret) {
      Logger.info(`Creating stockWebhook because it didn't exist.`, loggerCtx);
      const created = await client.createWebhook({
        webhookEvent: GoedgepicktEvent.stockChanged,
        targetUrl: webhookTarget,
      });
      stockSecret = created.webhookSecret;
    } else {
      Logger.info(`StockWebhook already present`, loggerCtx);
    }
    return await this.upsertConfig({
      channelToken: channelToken,
      orderWebhookKey: orderSecret,
      stockWebhookKey: stockSecret,
    });
  }

  /**
   * Accepts the order and corresponding orderItems, because fulfillment can take place for a partial order
   */
  async createOrder(
    channelToken: string,
    order: Order,
    orderItems: OrderItem[]
  ): Promise<GgOrder> {
    const ctx = await this.getCtxForChannel(channelToken);
    await this.entityHydrator.hydrate(ctx, order, { relations: ['customer'] });
    const mergedItems: OrderItemInput[] = [];
    // Merge same SKU's into single item with quantity
    orderItems.forEach((orderItem) => {
      const existingItem = mergedItems.find(
        (i) => i.sku === orderItem.line.productVariant.sku
      );
      if (existingItem) {
        existingItem.productQuantity++;
      } else {
        mergedItems.push({
          sku: orderItem.line.productVariant.sku,
          productName: orderItem.line.productVariant.name,
          productQuantity: 1, // OrderItems are always 1 each
          taxRate: orderItem.taxRate,
        });
      }
    });
    const client = await this.getClientForChannel(channelToken);
    if (
      !order.shippingAddress.streetLine2 ||
      !order.shippingAddress.streetLine1
    ) {
      throw Error(
        `Order.shippingAddress.streetLine1 and streetLine2 are needed to push order to Goedgepickt`
      );
    }
    const { houseNumber, addition } =
      GoedgepicktService.splitHouseNumberAndAddition(
        order.shippingAddress.streetLine2
      );
    const billingAddress =
      order.billingAddress && order.billingAddress.streetLine1
        ? order.billingAddress
        : order.shippingAddress;
    const { houseNumber: billingHouseNumber, addition: billingAddition } =
      GoedgepicktService.splitHouseNumberAndAddition(
        order.shippingAddress.streetLine2
      );
    const orderInput: OrderInput = {
      orderId: order.code,
      orderDisplayId: order.code,
      createDate: GoedgepicktService.toLocalTime(order.createdAt)!,
      finishDate: GoedgepicktService.toLocalTime(order.orderPlacedAt),
      orderStatus: 'open',
      orderItems: mergedItems,
      shippingFirstName: order.customer?.firstName,
      shippingLastName: order.customer?.lastName,
      shippingCompany: order.shippingAddress.company,
      shippingAddress: order.shippingAddress.streetLine1,
      shippingHouseNumber: houseNumber,
      shippingHouseNumberAddition: addition,
      shippingZipcode: order.shippingAddress.postalCode,
      shippingCity: order.shippingAddress.city,
      shippingCountry: order.shippingAddress.countryCode?.toUpperCase(),
      billingFirstName: order.customer?.firstName,
      billingLastName: order.customer?.lastName,
      billingCompany: billingAddress.company,
      billingHouseNumber: billingHouseNumber,
      billingHouseNumberAddition: billingAddition,
      billingZipcode: billingAddress.postalCode,
      billingCity: billingAddress.city,
      billingCountry: billingAddress.countryCode?.toUpperCase(),
      billingEmail: order.customer?.emailAddress,
      billingPhone: order.customer?.phoneNumber,
      paymentMethod: order.payments?.[0]?.method,
    };
    const customFields = order.customFields as
      | PickupPointCustomFields
      | undefined;
    if (
      customFields?.pickupLocationNumber ||
      customFields?.pickupLocationName
    ) {
      orderInput.pickupLocationData = {
        locationNumber: customFields.pickupLocationNumber,
        location: customFields.pickupLocationName,
        carrier: customFields.pickupLocationCarrier,
        street: customFields.pickupLocationStreet,
        houseNumber: customFields.pickupLocationHouseNumber,
        zipcode: customFields.pickupLocationZipcode,
        city: customFields.pickupLocationCity,
        country: customFields.pickupLocationCountry?.toUpperCase(),
      };
    }
    return client.createOrder(orderInput);
  }

  /**
   * Update order status in Vendure based on event
   */
  async updateOrderStatus(
    channelToken: string,
    orderCode: string,
    newStatus: OrderStatus
  ): Promise<void> {
    const ctx = await this.getCtxForChannel(channelToken);
    let order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      Logger.warn(
        `Order with code ${orderCode} doesn't exists. Not updating status to ${newStatus} for this order in channel ${channelToken}`,
        loggerCtx
      );
      return;
    }
    if (newStatus !== 'completed') {
      return Logger.info(
        `No status updates needed for order ${orderCode} for status ${newStatus}`,
        loggerCtx
      );
    }
    await transitionToDelivered(this.orderService, ctx, order, {
      code: goedgepicktHandler.code,
      arguments: [],
    });
    Logger.info(`Updated orderstatus of ${orderCode}`, loggerCtx);
  }

  /**
   * Update stock in Vendure based on event
   */
  async processStockUpdateEvent(
    channelToken: string,
    productSku: string,
    newStock: number
  ): Promise<void> {
    const ctx = await this.getCtxForChannel(channelToken);
    const { items: variants } = await this.variantService.findAll(ctx, {
      filter: { sku: { eq: productSku } },
    });
    const updatedStock: StockInput[] = variants.map((variant) => ({
      variantId: variant.id as string,
      stock: newStock,
    }));
    await this.updateStock(ctx, updatedStock);
    Logger.info(
      `Updated stock for ${productSku} to ${newStock} via incoming event`,
      loggerCtx
    );
  }

  async getClientForChannel(channelToken: string): Promise<GoedgepicktClient> {
    const config = await this.getConfig(channelToken);
    if (!config || !config?.apiKey || !config.webshopUuid) {
      throw Error(`Incomplete config found for channel ${channelToken}`);
    }
    return new GoedgepicktClient({
      webshopUuid: config.webshopUuid,
      apiKey: config.apiKey,
      orderWebhookKey: config.orderWebhookKey,
      stockWebhookKey: config.stockWebhookKey,
    });
  }

  getWebhookUrl(channelToken: string): string {
    let webhookTarget = this.config.vendureHost;
    if (!webhookTarget.endsWith('/')) {
      webhookTarget += '/';
    }
    return `${webhookTarget}goedgepickt/webhook/${channelToken}`;
  }

  /**
   * Creates admin context for channel
   */
  async getCtxForChannel(channelToken: string): Promise<RequestContext> {
    const channel = await this.channelService.getChannelFromToken(channelToken);
    return new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel,
    });
  }

  /**
   * For given channel:
   * 1. Push all products to Goedgepickt
   * 2. Pulls all stocklevels from Goedgepickt
   */
  private async fullSync(channelToken: string): Promise<void> {
    const client = await this.getClientForChannel(channelToken);
    const [ggProducts, variants] = await Promise.all([
      client.getAllProducts(),
      this.getAllVariants(channelToken),
    ]);
    // Push products to Goedgepickt
    for (const variant of variants) {
      const product: ProductInput = {
        name: variant.name,
        sku: variant.sku,
        productId: variant.sku,
        stockManagement: true,
        url: `${this.config.vendureHost}/admin/catalog/products/${variant.productId};id=${variant.productId};tab=variants`,
        picture: variant.absoluteImageUrl,
        price: (variant.price / 100).toFixed(2),
      };
      const exists = ggProducts.find(
        (ggProduct) => ggProduct.sku === product.sku
      );
      try {
        if (exists) {
          await client.updateProduct(exists.uuid, product);
          Logger.debug(`Updated variant ${variant.sku}`, loggerCtx);
        } else {
          await client.createProduct(product);
          Logger.debug(`Created variant ${variant.sku}`, loggerCtx);
        }
      } catch (err) {
        // Don't throw, because we want other products to sync
        Logger.error(
          `Failed to push variant ${variant.sku}: ${err.message}`,
          loggerCtx,
          err
        );
      }
    }
    Logger.info(
      `Pushed ${variants.length} variants for channel ${channelToken}`,
      loggerCtx
    );
    // Pull stockLevels from Goedgepickt
    const stockPerVariant: StockInput[] = [];
    for (const ggProduct of ggProducts) {
      const variant = variants.find((v) => v.sku === ggProduct.sku);
      const newStock = ggProduct.stock?.freeStock;
      if (!newStock) {
        Logger.info(
          `Goedgepickt variant ${ggProduct.sku} has no stock set. Cannot update stock in Vendure for this variant.`,
          loggerCtx
        );
        continue;
      }
      if (!variant) {
        Logger.info(
          `Goedgepickt product with sku ${ggProduct.sku} doesn't exist as variant in Vendure. Not updating stock for this variant`,
          loggerCtx
        );
        continue;
      }
      stockPerVariant.push({
        variantId: variant.id as string,
        stock: newStock,
      });
    }
    const ctx = await this.getCtxForChannel(channelToken);
    await this.updateStock(ctx, stockPerVariant);
    Logger.info(
      `Synced stockLevels of ${stockPerVariant.length} variants for channel ${channelToken}`,
      loggerCtx
    );
  }

  private async getAllVariants(
    channelToken: string
  ): Promise<VariantWithImage[]> {
    let ctx = await this.getCtxForChannel(channelToken);
    const translatedVariants: VariantWithImage[] = [];
    const take = 100;
    let skip = 0;
    let hasMore = true;
    while (hasMore) {
      const variants = await this.listQueryBuilder
        .build(
          ProductVariant,
          {
            skip,
            take,
          },
          {
            relations: [
              'featuredAsset',
              'channels',
              'product',
              'product.featuredAsset',
              'taxCategory',
            ],
            channelId: ctx.channelId,
            where: { deletedAt: null },
            ctx,
          }
        )
        .getMany();
      hasMore = !!variants.length;
      skip += take;
      const variantsWithPrice = await Promise.all(
        variants.map((v) =>
          this.productPriceApplicator.applyChannelPriceAndTax(v, ctx)
        )
      );
      const mappedVariants = variantsWithPrice
        .map((v) => translateDeep(v, ctx.languageCode))
        .map((v) => this.setAbsoluteImage(ctx, v));
      translatedVariants.push(...mappedVariants);
    }
    return translatedVariants;
  }

  private setAbsoluteImage(
    ctx: RequestContext,
    variant: Translated<ProductVariant>
  ): VariantWithImage {
    // Resolve images as if we are shop client
    const shopCtx = new RequestContext({
      apiType: 'shop',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel: ctx.channel,
    });
    let imageUrl =
      variant.featuredAsset?.preview || variant.product.featuredAsset?.preview;
    if (
      this.configService.assetOptions.assetStorageStrategy.toAbsoluteUrl &&
      imageUrl
    ) {
      imageUrl = this.configService.assetOptions.assetStorageStrategy
        .toAbsoluteUrl!(shopCtx.req as any, imageUrl);
    }
    return {
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      name: variant.name,
      price: variant.price,
      absoluteImageUrl: imageUrl,
    };
  }

  private async updateStock(
    ctx: RequestContext,
    stockInput: StockInput[]
  ): Promise<ProductVariant[]> {
    const positiveLevels = stockInput.map((input) => ({
      id: input.variantId,
      stockOnHand: input.stock >= 0 ? input.stock : 0,
    }));
    return this.variantService.update(ctx, positiveLevels);
  }

  private async autoFulfill(
    channelToken: string,
    orderCode: string
  ): Promise<void> {
    const ctx = await this.getCtxForChannel(channelToken);
    const config = await this.getConfig(channelToken);
    if (!config?.enabled || !config.autoFulfill) {
      return;
    }
    Logger.info(
      `Autofulfilling order ${orderCode} for channel ${channelToken}`,
      loggerCtx
    );
    let order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      Logger.error(
        `No order found with code ${orderCode}. Can not autofulfilling this order.`,
        loggerCtx
      );
      return;
    }
    order = await this.entityHydrator.hydrate(ctx, order, {
      relations: ['shippingLines', 'shippingLines.shippingMethod'],
    });
    const hasGoedgepicktHandler = order.shippingLines.some(
      (shippingLine) =>
        shippingLine.shippingMethod?.fulfillmentHandlerCode ===
        goedgepicktHandler.code
    );
    if (!hasGoedgepicktHandler) {
      Logger.info(
        `Order ${order.code} does not have Goedgepickt set as handler. Not autofulfilling this order.`,
        loggerCtx
      );
      return;
    }
    await fulfillAll(ctx, this.orderService, order, {
      code: goedgepicktHandler.code,
      arguments: [],
    });
    Logger.info(`Order ${order.code} autofulfilled`, loggerCtx);
  }

  static splitHouseNumberAndAddition(houseNumberString: string): {
    houseNumber: number;
    addition?: string;
  } {
    const [houseNumber, ...addition] = houseNumberString.match(
      /[a-z]+|\d+/gi
    ) as any[];
    return {
      houseNumber,
      addition: addition.join() || undefined, // .join() can result in empty string
    };
  }

  static toLocalTime(date?: Date) {
    if (!date) {
      return undefined;
    }
    const tzoffset = date.getTimezoneOffset() * 60000; //offset in milliseconds
    return new Date(date.getTime() - tzoffset).toISOString().slice(0, -1);
  }
}
