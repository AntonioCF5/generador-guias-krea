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
  NUMERO_DE_ORDEN: "Numero_de_orden",
  FECHA_Y_HORA: "Fecha_y_Hora",

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
  ENVIA_TRACKING_NUMBER: "Numero_de_Guia",
  ENVIA_CARRIER: "Paqueteria",
  ENVIA_SERVICE: "Envia_Service",
  ENVIA_LABEL_URL: "Envia_Label_URL",
  ENVIA_TRACKING_URL: "URL_de_Rastreo",
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
  PENDIENTE: "Pendiente",
  PICKED_UP: "Picked Up",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  ADDRESS_ERROR: "Address error",
};

export const SHIPMENT_STATUS_LABELS = {
  [SHIPMENT_STATUS.PENDIENTE]: "Pendiente",
  [SHIPMENT_STATUS.PICKED_UP]: "Recolectado",
  [SHIPMENT_STATUS.SHIPPED]: "Enviado",
  [SHIPMENT_STATUS.OUT_FOR_DELIVERY]: "En reparto",
  [SHIPMENT_STATUS.DELIVERED]: "Entregado",
  [SHIPMENT_STATUS.ADDRESS_ERROR]: "Error de dirección",
};

export const DEALS_LIST_PAGE_SIZE = 25;

export const DEAL_STAGES = [
  "Cita Agendada",
  "Asistio",
  "No Asistio",
  "No Compro Cuadro",
  "Compro Cuadro",
  "Diseño Enviado",
  "Diseño Aprobado",
  "Finalizado sin Cuadro",
  "En Produccion",
  "Guía Impresa",
  "Enviado a Cliente",
  "Finalizado con Cuadro",
  "Cancelada",
  "Reposicion",
  "Reposicion en Camino",
  "Reposicion entregada",
];

export const ESTADOS_MEXICO = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas",
];
