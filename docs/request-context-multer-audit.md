# Request Context + Multer Audit Report

Audit of backend routes that use multer and may lose AsyncLocalStorage request context.
Ref: xituan_agent/devGuide/request-context-multer-workaround.md

## Summary

| Domain | Route / Handler | Multer Type | Has Restore? | Risk |
|--------|-----------------|-------------|--------------|------|
| expense | uploadAndRecognize | upload.single | ✓ Fixed | - |
| expense | uploadImageManually | upload.single | ✓ Fixed | - |
| expense | createExpense | upload.none | ✗ | **Same issue** |
| expense | updateExpense | upload.none | ✗ | **Same issue** |
| printTemp | uploadImage | upload.single | ✗ | **Same issue** |
| supplier | createSupplier | upload.none | ✗ | **Same issue** |
| supplier | updateSupplier | upload.none | ✗ | **Same issue** |
| partner | createPartnerInvoiceSummary | upload.none | ✗ | **Same issue** |
| partner | updatePartnerInvoiceSummary | upload.none | ✗ | **Same issue** |
| partner | createPartner, updatePartner | upload.none | ✗ | **Same issue** |
| partner | createPartnerAddress, updatePartnerAddress | upload.none | ✗ | **Same issue** |
| partner | createPartnerInvoice, updatePartnerInvoice | upload.none | ✗ | **Same issue** |
| partner | confirmSummaryPayment | upload.none | ✗ | **Same issue** |
| equipment | createEquipment | upload.none | ✗ | **Same issue** |
| equipment | updateEquipment | upload.none | ✗ | **Same issue** |
| equipment-depreciation | createDepreciationRecord | upload.none | ✗ | **Same issue** |
| equipment-depreciation | updateDepreciationRecord | upload.none | ✗ | **Same issue** |
| store-address | create/update (multer) | upload.none | ✗ | **Same issue** |
| product | createProduct, updateProduct | upload.array | ✓ | - |
| product | createCategory, updateCategory | upload.none | ✓ | - |
| product | createProductCustomPreset, updateProductCustomPreset | upload.single | ✓ | - |
| offer | create/update | upload.array | ✓ | - |
| preorder-promotes | create/update | upload.fields | ✓ | - |
| news | createNewsWithImages, updateNews | upload.array | ✓ | - |
| merchant-setting | (multer routes) | upload.fields | ✓ | - |
| platform-setting | (multer routes) | upload.fields | ✓ | - |
| cart | uploadCartImages | upload.array | ✓ | - |
| auth | uploadAvatar | upload.single | N/A | User-scoped; no merchant context |

## Routes Requiring Fix

All routes using multer (single/array/fields/none) that call services/repositories using `getMerchantId()` need `restoreRequestContextFromReq` + `requestContext.run` in the controller.

1. **expense.controller.ts**: `createExpense`, `updateExpense`
2. **printTemp.controller.ts**: `uploadImage`
3. **supplier.controller.ts**: `createSupplier`, `updateSupplier`
4. **partner.controller.ts**: `createPartnerInvoiceSummary`, `updatePartnerInvoiceSummary`, `createPartner`, `updatePartner`, `createPartnerAddress`, `updatePartnerAddress`, `createPartnerInvoice`, `updatePartnerInvoice`, `confirmSummaryPayment`
5. **equipment.controller.ts**: `createEquipment`, `updateEquipment`
6. **equipment-depreciation.controller.ts**: `createDepreciationRecord`, `updateDepreciationRecord`
7. **store-address** (controller with upload.none routes)
