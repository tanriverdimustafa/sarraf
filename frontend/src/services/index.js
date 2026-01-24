/**
 * Services Barrel Export
 * Tüm servisleri tek noktadan export eder
 */

export { partyService } from './partyService';
export { productService } from './productService';
export { transactionService } from './transactionService';
export { cashService } from './cashService';
export { reportService } from './reportService';
export { lookupService } from './lookupService';
export { employeeService } from './employeeService';
export { partnerService } from './partnerService';
export { expenseService } from './expenseService';
export { inventoryService } from './inventoryService';
export { marketService } from './marketService';

// Eski service'i de export et (geriye uyumluluk için)
export * from './financialV2Service';

// Default export - tüm servisler
export default {
  party: require('./partyService').partyService,
  product: require('./productService').productService,
  transaction: require('./transactionService').transactionService,
  cash: require('./cashService').cashService,
  report: require('./reportService').reportService,
  lookup: require('./lookupService').lookupService,
  employee: require('./employeeService').employeeService,
  partner: require('./partnerService').partnerService,
  expense: require('./expenseService').expenseService,
  inventory: require('./inventoryService').inventoryService,
  market: require('./marketService').marketService
};
