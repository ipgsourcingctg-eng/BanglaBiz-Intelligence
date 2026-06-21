/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VatTaxMode = "excl-both" | "only-vat" | "only-tax" | "both";

export interface CollectionRecord {
  id: string;
  paymentDate: string;
  transactionNo?: string;
  buyerName: string;
  invoiceNo: string;
  amountCollected: number;
  paymentMethod: string;
  status?: string;
  remarks: string;
  branch?: string;
}

export interface MonthlyTargetRecord {
  year: number;
  month: number; // 1-12
  entityName: string;
  salesTarget: number;
  collectionTarget: number;
}

export interface SalesRecord {
  No: number;
  Branch: string;
  "Sales Person": string;
  "Buyer Group": string;
  "Sales Order": string;
  Invoice: string;
  Remarks: string;
  Buyer: string;
  Brand: string;
  Group: string;
  Product: string;
  Quantity: number;
  "Unit Price": number;
  "Exclude Vat Tax": number;
  Vat: number;
  Tax: number;
  "Vat & Tax": number;
  "Total Price": number;
  "Invoice Date": string;
  "Sales Date": string;
  "Product Manager": string;
  vatTaxMode?: VatTaxMode;
  customVatRate?: number;
  customTaxRate?: number;
}

export type Role = "Admin" | "Sales Manager" | "Viewer";

export interface User {
  id: string;
  username: string;
  role: Role;
  name: string;
  branch?: string;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  fileName: string;
  recordsCount: number;
  status: "success" | "warning" | "failed";
  source: "Excel Import" | "Google Sheets Sync" | "Default Dataset" | "System Action";
  message: string;
}

export interface DashboardFilters {
  dateRange: [string, string]; // [YYYY-MM-DD, YYYY-MM-DD]
  years?: number[];
  branch: string[];
  salesPerson: string[];
  buyerGroup: string[];
  buyer: string[];
  brand: string[];
  productGroup: string[];
  productManager: string[];
  searchQuery: string;
  paymentMethod?: string[];
  collectionStatus?: string[];
  funnelStatus?: string[];
  funnelQuarter?: string[];
  customBuyerGroups?: string[];
}

export interface TargetDetails {
  branchOrName: string;
  target: number;
  actual: number;
  achievementRate: number; // in %
  gap: number;
}

export interface PipelineItem {
  stage: string;
  count: number;
  value: number; // in BDT
}

export interface YearlyEntityTarget {
  year: number;
  entityName: string; // Branch name or Sales Person name
  totalTarget: number;
  totalCollectionTarget?: number;
  monthlyBreakdown?: {
    month: number;
    sales: number;
    collection: number;
  }[];
  q1Target?: number;
  q2Target?: number;
  q3Target?: number;
  q4Target?: number;
  h1Target?: number;
  h2Target?: number;
}

export interface YearlyTaxConfig {
  year: number;
  vatRate: number;
  taxRate: number;
}

export type ThemeType = 
  | "sophisticated-dark"
  | "dark-elegant"
  | "midnight-blue"
  | "forest-green"
  | "corporate-light"
  | "royal-purple"
  | "executive-black";

export interface DashboardTheme {
  variant: ThemeType;
  name: string;
  isDark: boolean;
  primary: string;
  secondary: string;
  bgMain: string;
  bgCard: string;
  border: string;
  textMuted: string;
  textMain: string;
  cardShadow: string;
}

export interface FunnelRecord {
  id: string;
  partner: string;
  salesman: string;
  quarter: string;
  startDate: string;
  endDate: string;
  brand: string;
  amount: number;
  status: string;
  SL?: number;
}

export interface CustomBuyerGroup {
  id: string;
  name: string;
  buyers: string[];
}

export interface SoftwareSubscription {
  id: string;
  account_name: string;
  customer_id: string;
  brand_oem: string;
  local_vendor: string;
  product_name: string;
  part_no: string;
  contract_no: string;
  tenure: string;
  activated_on: string;
  expires_on: string;
  quantity: number;
  unit_price: number;
  total_value: number;
  currency: string;
  renewal_stage: 'Not Started' | 'Customer Contacted' | 'Quotation Sent' | 'Negotiation' | 'PO Expected' | 'PO Received' | 'Renewed' | 'Lost';
  renewal_probability: number;
  status: string;
  sales_owner: string;
  competitor: string;
  remarks: string;
  created_at: string;
  updated_at: string;
}

export interface RenewalActivity {
  id: string;
  subscription_id: string;
  activity_date: string;
  activity_type: 'Call' | 'Meeting' | 'Email' | 'Quotation' | 'Follow-Up' | 'PO Update' | 'Renewal Completed';
  remarks: string;
  next_followup?: string;
  created_by: string;
}

export interface LeadAnalysisRecord {
  id?: string;
  Quarter: string;
  SL: number | string;
  Date: string;
  "Leads Ref.": string;
  "Customer Name": string;
  "Type": string;
  "Lead Value": number;
  OEM?: string;
  Status?: string;
}

export interface SoftwareBrandOem {
  id: string;
  brand_name: string;
  annual_target: number;
  achieved_value: number;
  active_value: number;
}

export interface MonthlyForecastItem {
  month: string;
  predictedRevenue: number;
  organicForecast: number;
  pipelineForecast: number;
  growthRate: number;
}

export interface CustomerForecastItem {
  customer: string;
  predictedNext3Months: number;
  funnelPotential: number;
  activeDealsCount?: number;
  confidence: "High" | "Medium" | "Low";
}

export interface SalesForecastData {
  monthlyForecast: MonthlyForecastItem[];
  customerForecast: CustomerForecastItem[];
  riskFactors?: {
    factor: string;
    impact: "High" | "Medium" | "Low";
    description: string;
    mitigation: string;
  }[];
  strategicAnalysis: string;
}

