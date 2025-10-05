
// barCode	barCodeShared	prodCode	available	category	region	name_cn	name	wholeSalePrice	20Price	25Price	30Price	storageType	storageType_eng	storageDay	ingredient_cn	ingredient	barCodeSharedBool
const prodColumn = {
    barCode:"barCode",
    barCodeShared:"barCodeShared",
    prodCode:"prodCode",
    available:"available",
    category:"category",
    region:"region",
    name_cn:"name_cn",
    name:"name",
    wholeSalePrice:"wholeSalePrice",
    price20:"price20",
    price25:"price25",
    price30:"price30",  
    storageType:"storageType",
    storageType_eng:"storageType_eng",
    storageDay:"storageDay",
    ingredient_cn:"ingredient_cn",
    ingredient:"ingredient",
    barCodeSharedBool:"barCodeSharedBool",
}

const clientColumn = {
    client_cn:"client_cn",
    client:"client",
    id:"id",
    abn:"abn",
    addressStreet:"addressStreet",
    addressCode:"addressCode",
    phone:"phone",
    mobile:"mobile",
    email:"email",
    discount:"discount",
    wholesaler:"wholesaler",    // give wholesalePrice
    manager:"manager",
}

const wholesaleColumn = {
    id:"id",
    client:"client",
    clientID:"clientID",
    issueDate:"issueDate",
    dueDate:"dueDate",
    total:"total",
    gst:"gst",
    detail:"detail",
    bEmailSent:"bEmailSent",
    bDilivered:"bDilivered",
    bPaid:"bPaid",
    invoiceLink:"invoiceLink",
    discount:"discount",
    discountDeduction:"discountDeduction",
    outdatedDeduction:"outdatedDeduction",
    discountedLoss:"discountedLoss",
    outdatedLoss:"outdatedLoss",
    totalLoss:"totalLoss",
    totalPaid:"totalPaid",
  }

  
const wholesaleSumColumn = {
    id:"id",
    client:"client",
    clientID:"clientID",
    issueDate:"issueDate",
    dueDate:"dueDate",
    total:"total",
    gst:"gst",
    invoiceLink:"invoiceLink",
    totalLoss:"totalLoss",
    totalPaid:"totalPaid",
}