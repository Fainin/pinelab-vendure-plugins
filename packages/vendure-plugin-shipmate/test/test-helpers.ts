import type { ShipmateConfigEntity } from '../src/api/shipmate-config.entity';
export const authToken = 'SHIPMATE_WEBHOOK_AUTH_TOKEN';

const newShipment = {
  id: '4e084315-f87f-4d9f-994e-9b25f6b9844d',
  shipment_reference: 'FBJYSHC7WTRQEA14',
  parcel_reference: 'rai10d',
  carrier: 'GENERIC_LABEL',
  service_name: 'Demo Label',
  tracking_reference: 'P5D414200003',
  universal_tracking_reference: 'C5D414200003',
  created_by: 'Surafel .',
  created_with: 'vendure-test',
  created_at: '2024-05-21 13:24:12',
  price: '0.00',
  estimated_delivery_date: '2024-05-23 23:59',
  to_address: {
    delivery_name: 'Hayden Zieme',
    line_1: '9584 Judge Harbor',
    line_2: '',
    line_3: '',
    city: 'South Shadberg',
    county: 'Bedfordshire',
    postcode: 'RX44 5LD',
    country: 'GB',
  },
  pdf: '',
  zpl:
    'CT~~CD,~CC^~CT~\n' +
    '^XA\n' +
    '\n' +
    '~TA000~JSN^MNW^MTD^PON^PMN^JMA^PR5,5~SD15^JUS^LRN^CI0^XZ\n' +
    '^XA\n' +
    '^MMT\n' +
    '^PW812\n' +
    '^LL1218\n' +
    '\n' +
    '^FO509,32^GFA,1734,1734,34,003FF8I01O03CgQ01ER0F801JFI07CN0FEgQ03FQ01DC03JF800FEN0FFgQ03F8P01760KFC00FEN0FFgQ03F8P037E1KFE00FEN0FFgQ03F8P03721LF00FEN0FFgQ03F8P03563FF87FF00FEN0FEgQ03F8P01CE3FC00FF80FEN07EgQ03F8P01FC7F8007F80FEhG03F8Q07,7FI03F80FEhG03F8,7FI01F00FEhG03F8,7FJ0E00FE1FCS03FCK07E07EJ07F8K03F8L07F8,7FM0FE7FF8007FFEJ07CIFI07CFF9FF8001IF3E07LFI03FFE,7F8L0FEIFC00JFJ0KFC00MF8007JFE07LF800JF8,3FEL0KFE00JFJ0KFE00MFC00LF0MF801JFC,3FF8K0LF00JFJ0LF00MFC01LF07LF803JFE,3IF8J0LF007IFJ0LF00MFE03LF07LF007KF,1JFJ0IF0FF003IFJ0FFE0FF80FF1FF1FE03FE0IF01KFE007FC1FF8,0JFEI0FFC07F8I07FJ0FF803F80FF0FE0FE07F803FFI03F8J0FF007F8,07JF800FF803F8I07FJ0FF003FC0FE0FE0FE07F001FFI03F8J0FE003FC,01JFE00FF003F8I07FJ0FF001FC0FE0FE0FE0FFI0FFI03F8I01FC001FC,003JF00FF003F8I07FJ0FE001FC0FE0FE0FE0FEI0FFI03F8I01FCI0FC,I07IF00FE003F8I07FJ0FEI0FE0FE0FE0FE0FEI0FFI03F8I01LFC,J07FF80FE003F8I07FJ0FEI0FE0FE0FE0FE0FEI07FI03F8I03LFE,K0FFC0FE003F8I07FJ0FCI0FE0FE0FE0FE0FCI07FI03F8I03LFE,K03FC0FE003F8I07FJ0FCI0FE0FE0FE0FE0FCI07FI03F8I03LFE,K03FC0FE003F8I07FJ0FCI0FE0FE0FE0FE0FCI07FI03F8I03LFC,K01FC0FE003F8I07FJ0FCI0FE0FE0FE0FE0FEI07FI03F8I03LFC,7CI01FC0FE003F8I07FJ0FEI0FE0FE0FE0FE0FEI07FI03F8I03LF,FEI01FC0FE003F8I07FJ0FEI0FE0FE0FE0FE0FEI0FFI03F8I01FC,FEI01FC0FE003F8I07FJ0FE001FC0FE0FE0FE0FEI0FFI03F8I01FC,FFI03FC0FE003F8I07FJ0FF001FC0FE0FE0FE07F001FFI03F8I01FEI078,FFC007FC0FE003F8I07FJ0FF803FC0FE0FE0FE07F801FFI03F80380FE001FC,7FF00FF80FE003F8I07FJ0FFC07F80FE0FE0FE07FC07FFI03FC0FC0FF803FC,7LF80FE003F80LF80IF1FF80FE0FE0FE03FF1IFI01FF3FC07FF1FFC,3LF00FE003F81LFC0LF00FE0FE0FE01LFI01JFC07KF8,1KFE00FE003F81LFE0KFE00FE0FE0FE01LFJ0JFC03KF,0KFC00FE003F81LFE0KFC00FE0FC0FE00KFEJ0JF801JFE,03JFI07C001F01LFC0KF800FC0FC0FC003IF7EJ07IFI07IFC,00IFCI038I0E00LF80FCFFEI078078078I0FFE3CJ01FFCI01IF,I038g0FC0EV0EN01CK01E,gK0FC,::::::::gK078,^FS\n' +
    '\n' +
    '^FO32,32^A0N,22,20^FB460,3,0,L,0^FH^FDSender: Shipmate Systems Limited, Friar Gate Studios, Ford Street, Derby DE1 1EE United Kingdom^FS\n' +
    '\n' +
    '^FO32,110^A0N,24,22^FB300,1,0,L,0^FH^FDDeliver To^FS\n' +
    '\n' +
    '^FT32,180^A0N,34,32^FH^FDHayden Zieme^FS\n' +
    '%COMPANY_NAME%\n' +
    '^FT32,224^A0N,34,32^FH^FD9584 Judge Harbor^FS\n' +
    '%ADDRESS_LINE_2%\n' +
    '%ADDRESS_LINE_3%\n' +
    '^FT32,268^A0N,34,32^FH^FDSouth Shadberg^FS\n' +
    '^FT32,312^A0N,34,32^FH^FDRX44 5LD^FS\n' +
    '%ADDRESS_LINE_6%\n' +
    '\n' +
    '\n' +
    '^FO0,520^GB812,0,3^FS\n' +
    '^FO0,640^GB812,0,3^FS\n' +
    '^FO0,740^GB812,0,3^FS\n' +
    '^FO0,840^GB812,0,3^FS\n' +
    '^FO0,935^GB812,0,3^FS\n' +
    '\n' +
    '\n' +
    '^FO32,544^A0N,24,22^FB300,1,0,L,0^FH^FDDespatch Date^FS\n' +
    '^FO320,544^A0N,24,22^FB200,1,0,C,0^FH^FDWeight^FS\n' +
    '^FO600,544^A0N,24,22^FB200,1,0,C,0^FH^FDParcel^FS\n' +
    '\n' +
    '^FO32,590^A0N,32,32^FB300,1,0,L,0^FH^FD21-May-2024^FS\n' +
    '^FO320,590^A0N,32,32^FB200,1,0,C,0^FH^FD0.03kg^FS\n' +
    '^FO600,590^A0N,32,32^FB200,1,0,C,0^FH^FD1 of 1^FS\n' +
    '\n' +
    '^FO32,659^A0N,24,22^FB300,1,0,L,0^FH^FDSender Reference^FS\n' +
    '^FO32,695^A0N,32,32^FB600,1,0,L,0^FH^FDrai10d^FS\n' +
    '\n' +
    '^FO32,759^A0N,24,22^FB300,1,0,L,0^FH^FDConsignment Number^FS\n' +
    '^FO32,795^A0N,32,32^FB600,1,0,L,0^FH^FD24052159466^FS\n' +
    '\n' +
    '^FO32,859^A0N,24,22^FB300,1,0,L,0^FH^FDDelivery Instructions^FS\n' +
    '^FO32,895^A0N,28,26^FB600,1,0,L,0^FH^FD^FS\n' +
    '\n' +
    '\n' +
    '\n' +
    '^FO0,1170^A0N,31,30^FB812,1,0,C,0^FH^FD24052159466-1^FS\n' +
    '\n' +
    '\n' +
    '\n' +
    '^FT688,475^A0N,14,16^FH^FDLabelled by^FS\n' +
    '^FO664,482^GFA,400,400,16,,07F81CI07T038,0FFC3CI0F8S038,1FFE3CI0F8S038,1E3E3CI07T038,3C0E3CX038,3C063FF07F00FF83FDF07F63FFE0FE,3F003FFC7F81FFE3IF8IF7FFE1FF8,1FE03FFC7F81FFE3IF8IF7FFE3FF8,1FFC3F3C0781F9F3DF79F3F03803C7C,07FE3E3C0781F0F3DE79E1F0380783C,00FF3C1C0781E073DE7BC0F03807FFC,001F3C1C0781E073DE7BC0F03807FFC,380F3C1C0781E073DE7BC0F03807FFC,3C0F3C1C0781E0F3DE79C0F038078,3E1F3C1C0781F0F3DE79E1F03C67C,3IF3C1C7FF9IF3DE79IF03FF3FFC,1FFE3C1CIFDFFE3DE78IF03FF3FFC,0FFC1C1CIF9FFC3CE787FF01FE1FF8,01EN01E6L01CI07003C,Q01E,:::,^FS\n' +
    '\n' +
    '\n' +
    '^PQ1,0,1,Y^XZ',
  png: '',
};

const testShipmateConfig: ShipmateConfigEntity = {
  channelId: '1',
  apiKey: 'SHIPMATE_API_KEY',
  webhookAuthTokens: [],
  id: 1,
  username: 'SHIPMATE_USERNAME',
  password: 'SHIPMATE_PASSWORD',
  createdAt: new Date(),
  updatedAt: new Date(),
};

testShipmateConfig.webhookAuthTokens.push({
  token: authToken,
  shipmateConfig: testShipmateConfig,
  id: '1',
  createdAt: new Date(),
  updatedAt: new Date(),
});

export { testShipmateConfig, newShipment };
