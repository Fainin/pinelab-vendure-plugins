import {
  FulfillmentHandler,
  Injector,
  LanguageCode,
  Logger,
} from '@vendure/core';
import { MyparcelService } from './myparcel.service';
import { MyparcelPlugin } from '../myparcel.plugin';
import { loggerCtx } from '../constants';

let myparcelService: MyparcelService;
export const myparcelHandler = new FulfillmentHandler({
  code: 'my-parcel',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Send order to MyParcel',
    },
  ],
  args: {},
  init: (injector: Injector) => {
    myparcelService = injector.get(MyparcelService);
  },
  createFulfillment: async (ctx, orders, orderItems, args) => {
    const shipmentId = await myparcelService
      .createShipments(ctx, orders)
      .catch((err) => {
        Logger.error(err?.message, loggerCtx, err?.stack);
        throw err;
      });
    return {
      method: shipmentId,
    };
  },
});
