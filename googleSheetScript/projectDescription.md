this project is google sheet script extension code.

this google sheet has sheets listed below

* product - list of product, headers are
  
  | barCode | prodCode | available | category | region | name | name\_eng | wholeSalePrice | .20Price | .25Price | .30Price | storageType | storageType\_eng | storageDay | ingredient | ingredient\_eng | duplicated code |
| ------- | -------- | --------- | -------- | ------ | ---- | --------- | -------------- | -------- | -------- | -------- | ----------- | ---------------- | ---------- | ---------- | --------------- | --------------- |
  
  
* productEnum - defeind enums of product category (column A) and region/country of product (column B)
* prodTag - not used for now
* client - list of website partener, headers are
  
  | client | id | abn | delivery address line 1 | delivery address line 2 | suburb state postcode | phone | mobile | email | discount | name | address line 1 | address line 2 | suburb state postcode |
| ------- | -- | --- | ----------------------- | ----------------------- | --------------------- | ----- | ------ | ----- | -------- | ---- | -------------- | -------------- | --------------------- |
  
  
* invoiceEmail - invoice email content template
* invoiceSummary - invoices summary list
* invoice - invoice template
* wholesale - a list of all invoice summary, invoice state, and invoice pdf link,
  
  * headers are
  * invoice detail data format
    * [["蓝莓蛋糕 8寸","","",1,60,6,60],["芋泥雪贝","","",5,4,0.4,20],["肉松紫米大贝贝","","",5,4.5,0.45,22.5]
    * sub array items are [productName,  ignored, ignored, quatity, unitPrice, GST, SubTotal]

| id | client | issueDate | dueDate | total | gst | detail | bEmailSent | bDilivered | bPaid | invoiceLink | discount | Outdated deduction | Discount deduction | totalLoss | totalPaid |
| -- | ------ | --------- | ------- | ----- | --- | ------ | ---------- | ---------- | ----- | ----------- | -------- | ------------------ | ------------------ | --------- | --------- |

