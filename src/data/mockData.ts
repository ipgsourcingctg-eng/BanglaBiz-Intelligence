/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SalesRecord, PipelineItem, CollectionRecord, MonthlyTargetRecord } from "../types";

export const INITIAL_SALES_DATA: SalesRecord[] = [];

// Let's create more records dynamically to have > 100 elements. This is highly impressive and enables large dataset visualizations.
const sampleBranches = ["Unassigned", "Chattogram Hub", "Sylhet Apex", "Rajshahi Tech", "Khulna Point"];
const sampleSalesPersons: Record<string, string[]> = {
  "Unassigned": ["Unassigned", "Ayesha Siddiqua", "Fatema Tuz Zohra"],
  "Chattogram Hub": ["Tanvir Islam", "Rashedul Alam"],
  "Sylhet Apex": ["Imran Hossain", "Sayeeda Yasmin"],
  "Rajshahi Tech": ["Sumaiya Chowdhury", "Niaz Morshed"],
  "Khulna Point": ["Zahid Hasan", "Mitu Akter"]
};
const sampleBuyers: Record<string, { name: string; group: string }[]> = {
  Telecom: [
    { name: "Grameenphone Ltd.", group: "Telecom" },
    { name: "Robi Axiata Ltd.", group: "Telecom" },
    { name: "Banglalink Digital", group: "Telecom" },
    { name: "Teletalk Bangladesh", group: "Telecom" }
  ],
  Banking: [
    { name: "bKash Limited", group: "Banking" },
    { name: "BRAC Bank PLC", group: "Banking" },
    { name: "City Bank PLC", group: "Banking" },
    { name: "Eastern Bank Limited", group: "Banking" },
    { name: "Prime Bank Ltd.", group: "Banking" },
    { name: "Standard Chartered Bangladesh", group: "Banking" },
    { name: "Mutual Trust Bank", group: "Banking" },
    { name: "Dhaka Bank PLC", group: "Banking" },
    { name: "Pubali Bank PLC", group: "Banking" }
  ],
  Conglomerate: [
    { name: "Abul Khair Group", group: "Conglomerate" },
    { name: "PRAN-RFL Group", group: "Conglomerate" },
    { name: "Akij Group Ltd.", group: "Conglomerate" },
    { name: "Bashundhara Group", group: "Conglomerate" },
    { name: "BSRM Steels Ltd", group: "Conglomerate" },
    { name: "Square Group", group: "Conglomerate" },
    { name: "Beximco Group", group: "Conglomerate" }
  ],
  Government: [
    { name: "Bangladesh Election Commission", group: "Government" },
    { name: "NID Wing Bangladesh", group: "Government" },
    { name: "Bangladesh Bank", group: "Government" },
    { name: "Post & Telecommunication Ministry", group: "Government" },
    { name: "Rajshahi University of Engineering & Tech (RUET)", group: "Government" },
    { name: "Rajshahi City Corporation", group: "Government" }
  ],
  Retail: [
    { name: "Daraz Bangladesh", group: "Retail" },
    { name: "Aarong (BRAC)", group: "Retail" },
    { name: "Shwapno Superstores", group: "Retail" },
    { name: "Unimart Limited", group: "Retail" }
  ],
  Hospitality: [
    { name: "Grand Sylhet Resort", group: "Hospitality" },
    { name: "Radisson Blu Dhaka", group: "Hospitality" },
    { name: "InterContinental Dhaka", group: "Hospitality" }
  ]
};

const sampleProducts: { brand: string; group: string; name: string; price: number; manager: string }[] = [
  { brand: "Cisco Systems", group: "Networking", name: "Catalyst 9300 48-Port Switch", price: 420000, manager: "Naimur Reza" },
  { brand: "Cisco Systems", group: "Networking", name: "Meraki MR44 Access Point", price: 85000, manager: "Naimur Reza" },
  { brand: "Cisco Systems", group: "Networking", name: "NCS Series Core Transceiver", price: 95000, manager: "Naimur Reza" },
  
  { brand: "Palo Alto", group: "Security", name: "PA-3410 Next-Gen Firewall", price: 1850000, manager: "Farzana Ahmed" },
  { brand: "Palo Alto", group: "Security", name: "PA-1410 Next-Gen Firewall Cluster", price: 1400000, manager: "Farzana Ahmed" },
  
  { brand: "Fortinet", group: "Security", name: "FortiGate 200F Firewall", price: 380000, manager: "Farzana Ahmed" },
  { brand: "Fortinet", group: "Security", name: "FortiGate 100F Dual Security Gateway", price: 270000, manager: "Farzana Ahmed" },
  { brand: "Fortinet", group: "Security", name: "FortiManager Enterprise Virtual VM", price: 1250000, manager: "Farzana Ahmed" },
  
  { brand: "Dell Technologies", group: "Compute", name: "PowerEdge R760 Server Rack", price: 1150000, manager: "Mehedi Hasan" },
  { brand: "Dell Technologies", group: "Compute", name: "Dell PowerEdge T360 Server", price: 340000, manager: "Mehedi Hasan" },
  { brand: "Dell Technologies", group: "Storage", name: "PowerStore 500T Storage Suite", price: 2450000, manager: "Mehedi Hasan" },
  
  { brand: "Lenovo Enterprise", group: "Compute", name: "ThinkSystem SR650 Server", price: 980000, manager: "Mehedi Hasan" },
  { brand: "Lenovo Enterprise", group: "Storage", name: "ThinkSystem DE4000H SAN Storage", price: 1650000, manager: "Mehedi Hasan" },
  
  { brand: "Microsoft", group: "Software", name: "SQL Server Enterprise Core", price: 650000, manager: "Sajid Mahmood" },
  { brand: "Microsoft", group: "Software", name: "Windows Server CAL 100-Pack", price: 120000, manager: "Sajid Mahmood" },
  { brand: "Microsoft", group: "Software", name: "Office 365 E5 Enterprise License", price: 45000, manager: "Sajid Mahmood" }
];

const buyGroups = Object.keys(sampleBuyers);

// Helper to pad zero
const pad = (n: number) => (n < 10 ? "0" : "") + n;

// Generate supplementary elements to reach 125 total elements
export const generateDemoRecords = (): SalesRecord[] => {
  const merged: SalesRecord[] = [...INITIAL_SALES_DATA];
  
  let currentNo = merged.length + 1;
  const startYear = 2025;
  const endYear = 2026;
  
  // Create about 100 random events
  for (let i = 0; i < 98; i++) {
    const is2026 = Math.random() > 0.35; // 65% in 2026, 35% in 2025
    const year = is2026 ? 2026 : 2025;
    const month = year === 2026 ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 12) + 1; // Jan-May for 2026, Jan-Dec for 2025
    const day = Math.floor(Math.random() * 28) + 1;
    
    const salesDateStr = `${year}-${pad(month)}-${pad(day)}`;
    
    // invoice date is sales date + random 1 to 10 days, or sometimes empty (pending invoice, 8% of the time)
    const isInvoicePending = is2026 && year === 2026 && month >= 4 && Math.random() < 0.12; 
    let invoiceDateStr = "";
    if (!isInvoicePending) {
      const invDay = day + Math.floor(Math.random() * 6);
      if (invDay <= 28) {
        invoiceDateStr = `${year}-${pad(month)}-${pad(invDay)}`;
      } else {
        const nextMonth = month === 12 ? 12 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        invoiceDateStr = `${nextYear}-${pad(nextMonth)}-${pad(invDay - 28)}`;
      }
    }
    
    const branch = sampleBranches[Math.floor(Math.random() * sampleBranches.length)];
    const branchPeople = sampleSalesPersons[branch];
    const salesPerson = branchPeople[Math.floor(Math.random() * branchPeople.length)];
    
    const buyerGroup = buyGroups[Math.floor(Math.random() * buyGroups.length)];
    const groupBuyers = sampleBuyers[buyerGroup];
    const buyerObj = groupBuyers[Math.floor(Math.random() * groupBuyers.length)];
    
    const productObj = sampleProducts[Math.floor(Math.random() * sampleProducts.length)];
    const quantity = Math.floor(Math.random() * 15) + 1;
    const excludeVatTax = quantity * productObj.price;
    const vat = Math.round(excludeVatTax * 0.10); // 10% Standard VAT
    const tax = Math.round(excludeVatTax * 0.05);  // 5% Standard AIT Tax
    const vatAndTax = vat + tax;
    const totalPrice = excludeVatTax + vatAndTax;
    
    const orderNo = `SO-${year}-${100 + currentNo}`;
    const invoiceNo = isInvoicePending ? "" : `INV-${year}-${1000 + currentNo}`;
    
    const remarksOptions = [
      "Standard cyclical purchase",
      "Upgrade of regional capacity",
      "High priority system integration",
      "Disaster recovery migration pool",
      "End of quarter procurement cycle",
      "Special enterprise volume price applied",
      "CCTV expansion backup nodes",
      "Compliance audits recommended setup"
    ];
    const remarks = remarksOptions[Math.floor(Math.random() * remarksOptions.length)];
    
    merged.push({
      No: currentNo,
      Branch: branch,
      "Sales Person": salesPerson,
      "Buyer Group": buyerGroup,
      "Sales Order": orderNo,
      Invoice: invoiceNo,
      Remarks: remarks,
      Buyer: buyerObj.name,
      Brand: productObj.brand,
      Group: productObj.group,
      Product: productObj.name,
      Quantity: quantity,
      "Unit Price": productObj.price,
      "Exclude Vat Tax": excludeVatTax,
      Vat: vat,
      Tax: tax,
      "Vat & Tax": vatAndTax,
      "Total Price": totalPrice,
      "Invoice Date": invoiceDateStr,
      "Sales Date": salesDateStr,
      "Product Manager": productObj.manager
    });
    
    currentNo++;
  }
  
  return merged.sort((a, b) => b.No - a.No); // Descending by transaction number
};

export const generateCollectionRecords = (sales: SalesRecord[]): CollectionRecord[] => {
  const collections: CollectionRecord[] = [];
  
  sales.filter(s => s.Invoice).forEach(s => {
    // 85% of invoices are paid
    if (Math.random() < 0.85) {
      const salesDate = new Date(s["Sales Date"]);
      // Payment happens 15-90 days after sale
      const delayDays = Math.floor(Math.random() * 75) + 15;
      const paymentDate = new Date(salesDate.getTime() + delayDays * 24 * 60 * 60 * 1000);
      
      const paymentDateStr = paymentDate.toISOString().split('T')[0];
      
      // Payment might be partial, but mostly full
      const isPartial = Math.random() < 0.1;
      const amount = isPartial ? Math.round(s["Total Price"] * 0.7) : s["Total Price"];

      collections.push({
        id: `coll-${s.Invoice}-${Date.now()}-${Math.random()}`,
        paymentDate: paymentDateStr,
        buyerName: s.Buyer,
        invoiceNo: s.Invoice,
        amountCollected: amount,
        paymentMethod: ["Bank Transfer", "Cheque", "LC", "EFT"][Math.floor(Math.random() * 4)],
        remarks: isPartial ? "Partial payment received" : "Full payment received"
      });
    }
  });

  return collections;
};

// Targets targets structure matching the branches in Bangladesh
export const DIRECT_BRANCH_TARGETS = [];

export const DIRECT_PEOPLE_TARGETS = [];

export const PIPELINE_FUNNEL: PipelineItem[] = [
  { stage: "Lead Generated", count: 48, value: 164000000 },
  { stage: "Qualified Pitch", count: 32, value: 112000000 },
  { stage: "POC / Demo Stage", count: 19, value: 78000000 },
  { stage: "Financial Negotiation", count: 11, value: 45000000 },
  { stage: "Commit Call (Final)", count: 7, value: 29500000 }
];
