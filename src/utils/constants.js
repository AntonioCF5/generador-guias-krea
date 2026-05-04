export const MODULES = {
  DEALS: "Deals",
  CONTACTS: "Contacts",
};

export const DEAL_FIELDS = {
  ID: "id",
  NAME: "Deal_Name",
  STAGE: "Stage",
  CONTACT: "Contact_Name",
  AMOUNT: "Amount",
  CLOSING_DATE: "Closing_Date",
  MODIFIED_TIME: "Modified_Time",

  // Existing shipping address fields
  CALLE_Y_NUMERO: "Calle_y_Numero",
  COLONIA: "Colonia",
  CODIGO_POSTAL: "Codigo_Postal",
  CIUDAD: "Ciudad",
  ESTADO: "Estado",
  NOTAS_ENTREGA: "Notas_Extra_de_Entrega",

  // NEW package fields
  PACKAGE_WEIGHT_KG: "Package_Weight_Kg",
  PACKAGE_LENGTH_CM: "Package_Length_Cm",
  PACKAGE_WIDTH_CM: "Package_Width_Cm",
  PACKAGE_HEIGHT_CM: "Package_Height_Cm",
  PACKAGE_CONTENT: "Package_Content_Description",
  PACKAGE_DECLARED_VALUE: "Package_Declared_Value",

  // NEW Envia shipment metadata
  ENVIA_SHIPMENT_ID: "Envia_Shipment_ID",
  ENVIA_TRACKING_NUMBER: "Envia_Tracking_Number",
  ENVIA_CARRIER: "Envia_Carrier",
  ENVIA_SERVICE: "Envia_Service",
  ENVIA_LABEL_URL: "Envia_Label_URL",
  ENVIA_LABEL_GENERATED_AT: "Envia_Label_Generated_At",
  ENVIA_SHIPMENT_STATUS: "Envia_Shipment_Status",
  ENVIA_SHIPPING_COST: "Envia_Shipping_Cost",
};

export const CONTACT_FIELDS = {
  ID: "id",
  FIRST_NAME: "First_Name",
  LAST_NAME: "Last_Name",
  FULL_NAME: "Full_Name",
  PHONE: "Phone",
  EMAIL: "Email",
};

export const SHIPMENT_STATUS = {
  PENDING: "Pending",
  QUOTED: "Quoted",
  GENERATED: "Generated",
  IN_TRANSIT: "In_Transit",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const SHIPMENT_STATUS_LABELS = {
  [SHIPMENT_STATUS.PENDING]: "Pendiente",
  [SHIPMENT_STATUS.QUOTED]: "Cotizado",
  [SHIPMENT_STATUS.GENERATED]: "Guía generada",
  [SHIPMENT_STATUS.IN_TRANSIT]: "En tránsito",
  [SHIPMENT_STATUS.DELIVERED]: "Entregado",
  [SHIPMENT_STATUS.CANCELLED]: "Cancelado",
};

export const DEALS_LIST_PAGE_SIZE = 25;
