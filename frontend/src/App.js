import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MarketDataProvider } from './contexts/MarketDataContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import PartiesPage from './pages/PartiesPage';
import PartyDetailPage from './pages/PartyDetailPage';
import TransactionsPage from './pages/TransactionsPage';
import TransactionDetailPage from './pages/TransactionDetailPage';
import PurchaseTransactionPage from './pages/transactions/PurchaseTransactionPage';
import SaleTransactionPage from './pages/transactions/SaleTransactionPage';
import PaymentTransactionPage from './pages/transactions/PaymentTransactionPage';
import ReceiptTransactionPage from './pages/transactions/ReceiptTransactionPage';
import ExchangeTransactionPage from './pages/transactions/ExchangeTransactionPage';
import HurdaTransactionPage from './pages/transactions/HurdaTransactionPage';
import ReportsPage from './pages/ReportsPage';
import AccountStatementPage from './pages/reports/AccountStatementPage';
import ProfitLossReport from './pages/reports/ProfitLossReport';
import GoldMovementsReport from './pages/reports/GoldMovementsReport';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import StockReportPage from './pages/StockReportPage';
import CashDashboardPage from './pages/CashDashboardPage';
import CashRegistersPage from './pages/CashRegistersPage';
import CashMovementsPage from './pages/CashMovementsPage';
// Expense pages
import ExpensesPage from './pages/expenses/ExpensesPage';
import NewExpensePage from './pages/expenses/NewExpensePage';
import ExpenseCategoriesPage from './pages/expenses/ExpenseCategoriesPage';
// Partner pages
import PartnersPage from './pages/partners/PartnersPage';
import CapitalMovementsPage from './pages/partners/CapitalMovementsPage';
// Employee pages
import EmployeesPage from './pages/employees/EmployeesPage';
import SalaryMovementsPage from './pages/employees/SalaryMovementsPage';
import EmployeeDebtsPage from './pages/employees/EmployeeDebtsPage';
// Settings pages
import AccrualPeriodsPage from './pages/settings/AccrualPeriodsPage';
// Unified Ledger
import UnifiedLedgerPage from './pages/UnifiedLedgerPage';
// Stock Count pages
import StockCountsPage from './pages/inventory/StockCountsPage';
import NewStockCountPage from './pages/inventory/NewStockCountPage';
import ManualCountPage from './pages/inventory/ManualCountPage';
import BarcodeCountPage from './pages/inventory/BarcodeCountPage';
import StockCountReportPage from './pages/inventory/StockCountReportPage';
import StockCountPrintPage from './pages/inventory/StockCountPrintPage';
import Layout from './components/Layout';
import { Toaster } from './components/ui/sonner';
import './App.css';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
};

const App = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <MarketDataProvider>
            <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Layout>
                    <DashboardPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/products"
              element={
                <PrivateRoute>
                  <Layout>
                    <ProductsPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/products/:id"
              element={
                <PrivateRoute>
                  <Layout>
                    <ProductDetailPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/parties"
              element={
                <PrivateRoute>
                  <Layout>
                    <PartiesPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/parties/:id"
              element={
                <PrivateRoute>
                  <Layout>
                    <PartyDetailPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/transactions"
              element={
                <PrivateRoute>
                  <Layout>
                    <TransactionsPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/transactions/:code"
              element={
                <PrivateRoute>
                  <Layout>
                    <TransactionDetailPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/transactions/create/purchase"
              element={
                <PrivateRoute>
                  <Layout>
                    <PurchaseTransactionPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/transactions/create/sale"
              element={
                <PrivateRoute>
                  <Layout>
                    <SaleTransactionPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/transactions/create/payment"
              element={
                <PrivateRoute>
                  <Layout>
                    <PaymentTransactionPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/transactions/create/receipt"
              element={
                <PrivateRoute>
                  <Layout>
                    <ReceiptTransactionPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/transactions/create/exchange"
              element={
                <PrivateRoute>
                  <Layout>
                    <ExchangeTransactionPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/transactions/create/hurda"
              element={
                <PrivateRoute>
                  <Layout>
                    <HurdaTransactionPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <PrivateRoute>
                  <Layout>
                    <ReportsPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/reports/account-statement"
              element={
                <PrivateRoute>
                  <Layout>
                    <AccountStatementPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/reports/profit-loss"
              element={
                <PrivateRoute>
                  <Layout>
                    <ProfitLossReport />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/reports/gold-movements"
              element={
                <PrivateRoute>
                  <Layout>
                    <GoldMovementsReport />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/stock-report"
              element={
                <PrivateRoute>
                  <Layout>
                    <StockReportPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            {/* Stock Count Routes */}
            <Route
              path="/inventory/stock-counts"
              element={
                <PrivateRoute>
                  <Layout>
                    <StockCountsPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/inventory/stock-counts/new"
              element={
                <PrivateRoute>
                  <Layout>
                    <NewStockCountPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/inventory/stock-counts/:id/manual"
              element={
                <PrivateRoute>
                  <Layout>
                    <ManualCountPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/inventory/stock-counts/:id/barcode"
              element={
                <PrivateRoute>
                  <Layout>
                    <BarcodeCountPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/inventory/stock-counts/:id/report"
              element={
                <PrivateRoute>
                  <Layout>
                    <StockCountReportPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/inventory/stock-counts/:id/print"
              element={
                <StockCountPrintPage />
              }
            />
            {/* Unified Ledger Route */}
            <Route
              path="/unified-ledger"
              element={
                <PrivateRoute>
                  <Layout>
                    <UnifiedLedgerPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            {/* Cash Management Routes */}
            <Route
              path="/cash"
              element={
                <PrivateRoute>
                  <Layout>
                    <CashDashboardPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/cash/registers"
              element={
                <PrivateRoute>
                  <Layout>
                    <CashRegistersPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/cash/movements"
              element={
                <PrivateRoute>
                  <Layout>
                    <CashMovementsPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            {/* Expense Management Routes */}
            <Route
              path="/expenses"
              element={
                <PrivateRoute>
                  <ExpensesPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/expenses/new"
              element={
                <PrivateRoute>
                  <NewExpensePage />
                </PrivateRoute>
              }
            />
            <Route
              path="/expenses/categories"
              element={
                <PrivateRoute>
                  <ExpenseCategoriesPage />
                </PrivateRoute>
              }
            />
            {/* Partner Routes */}
            <Route
              path="/partners"
              element={
                <PrivateRoute>
                  <PartnersPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/partners/movements"
              element={
                <PrivateRoute>
                  <CapitalMovementsPage />
                </PrivateRoute>
              }
            />
            {/* Employee Routes */}
            <Route
              path="/employees"
              element={
                <PrivateRoute>
                  <EmployeesPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/employees/salary"
              element={
                <PrivateRoute>
                  <SalaryMovementsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/employees/debts"
              element={
                <PrivateRoute>
                  <EmployeeDebtsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/users"
              element={
                <PrivateRoute>
                  <Layout>
                    <UsersPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <Layout>
                    <SettingsPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/settings/accrual-periods"
              element={
                <PrivateRoute>
                  <AccrualPeriodsPage />
                </PrivateRoute>
              }
            />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
            <Toaster />
          </MarketDataProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;