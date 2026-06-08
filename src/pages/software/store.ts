import { SoftwareSubscription, RenewalActivity, SoftwareBrandOem } from "../../types";
import { safeLocalStorage } from "../../db/localDb";

const SUBS_KEY = "salespulse_sw_subscriptions_v1";
const ACTIVITIES_KEY = "salespulse_sw_activities_v1";
const BRANDS_KEY = "salespulse_sw_brands_v1";

// Raw TSV representation of SBM Google Sheet page
const RAW_SEED_DATA = `1\tRSGT BANGLADESH LIMITED (CTG)\tMicrosoft\tVisio Plan 2\tCFQ7TTC0HD32\t\tAnnual\t25-Feb-2025\t25-Feb-2026\t1\t23,920.00\t23,920.00\tDIGITAL EQUIPMENT\t
2\tGEEBEE (BANGLADESH) LTD ( CTG )\tMicrosoft\tMicrosoft 365 Apps for business\tCFQ7TTC0LH1G\t\tAnnual\t15-May-2025\t15-May-2026\t3\t11,300.00\t33,900.00\tDIGITAL EQUIPMENT\t
3\tKABIR STEEL RE- ROLLING MILLS LTD. (CTG)\tMicrosoft\tMicrosoft 365 Business Basic (no Teams)\tCFQ7TTC0LH18\t\tAnnual\t1-Jun-2025\t1-Jun-2026\t300\t3,310.00\t993,000.00\tLost\tAPPTRIANGLE LIMITED
4\tKABIR STEEL RE- ROLLING MILLS LTD. (CTG)\tMicrosoft\tMicrosoft 365 Business Basic\tCFQ7TTC0LH18\t\tAnnual\t1-Jun-2025\t1-Jun-2026\t200\t4,138.00\t827,600.00\tLost\tAPPTRIANGLE LIMITED
5\tKABIR STEEL RE- ROLLING MILLS LTD. (CTG)\tMicrosoft\tMicrosoft 365 Apps for Business\tCFQ7TTC0LH1G\t\tAnnual\t1-Jun-2025\t1-Jun-2026\t2\t11,448.00\t22,896.00\tLost\tAPPTRIANGLE LIMITED
6\tKABIR STEEL RE- ROLLING MILLS LTD. (CTG)\tMicrosoft\tExchange Online Archiving for Exchange Online\tCFQ7TTC0LH0J\t\tAnnual\t1-Jun-2025\t1-Jun-2026\t10\t4,138.00\t41,380.00\tLost\tAPPTRIANGLE LIMITED
7\tRSGT BANGLADESH LIMITED (CTG)\tMicrosoft\tVisio Plan 2\tCFQ7TTC0HD32\t\tAnnual\t4-Jun-2025\t4-Jun-2026\t1\t23,920.00\t23,920.00\tLost\tStar Tech
8\tKARNAPHULI FERTILIZER COMPANY LTD. (KAFCO). (CTG)\tAdobe\tAcrobat Standard DC for teams Multiple Platforms\t65297919BA01A12\t\tAnnual\t8-Jul-2025\t7-Jul-2026\t10\t22,105.00\t221,050.00\tSMART TECH\t
9\tRSGT BANGLADESH LIMITED (CTG)\tMicrosoft\tVisio Plan 2\tCFQ7TTC0HD32\t\tAnnual\t25-Mar-2025\t25-Mar-2026\t2\t24,150.00\t48,300.00\tDIGITAL EQUIPMENT\t
10\tTITAS SPORTSWEAR INDUSTRIES LTD. (CTG)\tVMware\tProduction Support Coverage VMware vSphere 7 Standard for 1 processor\tVS7-STD-3P-SSS-C\t490481599\tAnnual\t1-Oct-2022\t30-Sep-2025\t8\t103,880.00\t831,040.00\tExpired\tInstance No:186851648; Account Number: 780480616
11\tTITAS SPORTSWEAR INDUSTRIES LTD. (CTG)\tVMware\tProduction Support Coverage VMware vCenter Server 7 Standard for vSphere 7 (Per Instance)\tVCS7-STD-3P-SSS C\t490481599\tAnnual\t1-Oct-2022\t30-Sep-2025\t1\t451,849.00\t451,849.00\tExpired\tInstance No:188181396; Account Number: 780480616
12\tTITAS SPORTSWEAR INDUSTRIES LTD. (CTG)\tVMware\tProduction Support Coverage VMware vSAN 7 Standard for 1 processor\tST7-STD-3P-SSS-C\t490481599\tAnnual\t1-Oct-2022\t30-Sep-2025\t8\t206,317.00\t1,650,536.00\tExpired\tInstance No:188865805; Account Number: 780480616
13\tYOUNGONE (CEPZ) LTD. (CTG)\tSophos\tXG 550 Enhanced to Enhanced Plus Support Upgrade & XG 550 Xstream Protection\t(SKU: EP553CFUP) (SKU: XX553CTES)\tSN-C51028BDGHJWDD8 SN-C51028CH42TY321\t6 Months\t1-Nov-2024\t31-Mar-2025\t1\t1,336,843.00\t1,336,843.00\tExpired\t
14\tGEEBEE (BANGLADESH) LTD ( CTG )\tMicrosoft\tMicrosoft 365 Apps for business\tCFQ7TTC0LH1G\t\tAnnual\t10-Jul-2025\t10-Jul-2026\t2\t11,300.00\t22,600.00\tDIGITAL EQUIPMENT\t
15\tTHE CONSOLIDATED TEA AND LANDS COMPANY (BD) LTD. (CTG)\tZoom\tZoom Pro VC Software\t\t\tAnnual\t25-Jul-2024\t24-Jul-2025\t3\t22,857.00\t68,571.00\tLost\tWe do not offered due to host qty.
16\tKARNAPHULI FERTILIZER COMPANY LTD. (KAFCO). (CTG)\tESET\tESET Protect Entry Cloud (Server & Workstation Security)\t\t\tAnnual\t1-Sep-2024\t31-Aug-2025\t350\t\t0.00\tLost\t
17\tKABIR STEEL RE- ROLLING MILLS LTD. (CTG)\tIceWarp\tIcewarp Standard Plan-ME3(30 GB Mailbox)\t\t\tAnnual\t\t\t100\t2,763.00\t276,300.00\tLost\tAPPTRIANGLE LIMITED
18\tKARNAPHULI FERTILIZER COMPANY LTD. (KAFCO). (CTG)\tMicrosoft\tMicrosoft 365 Business Basic\t\t\tAnnual\t\t\t150\t3,294.00\t494,100.00\tLost\tELEVATE SOLUTIONS LIMITED
19\tKARNAPHULI FERTILIZER COMPANY LTD. (KAFCO). (CTG)\tMicrosoft\tDefender for Office 365 ATP Plan 1\t\t\tAnnual\t\t\t10\t2,227.00\t22,270.00\tLost\tELEVATE SOLUTIONS LIMITED
20\tKARNAPHULI FERTILIZER COMPANY LTD. (KAFCO). (CTG)\tMicrosoft\tAzure Active Directory Premium P1\t\t\tAnnual\t\t\t5\t7,200.00\t36,000.00\tLost\tELEVATE SOLUTIONS LIMITED
21\tKARNAPHULI FERTILIZER COMPANY LTD. (KAFCO). (CTG)\tMicrosoft\tExchange Online Archiving for Exchange Online\t\t\tAnnual\t\t\t50\t3,340.00\t167,000.00\tLost\tELEVATE SOLUTIONS LIMITED
22\tKARNAPHULI FERTILIZER COMPANY LTD. (KAFCO). (CTG)\tDigicert\tPublic SSL Wildcard Certificate (*.kafcobd.com) for On-Prem Exchange Server\t\t\tAnnual\t\t\t1\t143,790.00\t143,790.00\tLost\tELEVATE SOLUTIONS LIMITED
23\tKARNAPHULI FERTILIZER COMPANY LTD. (KAFCO). (CTG)\tMicrosoft\tMicrosoft 365 F1\t\t\tAnnual\t\t\t5\t2,561.00\t12,805.00\tLost\tELEVATE SOLUTIONS LIMITED
24\tRSGT BANGLADESH LIMITED (CTG)\tMicrosoft\tPower Automate Premium\tCFQ7TTC0LSGZ\t\tAnnual\t15-Jul-2025\t14-Jul-2026\t1\t23,288.00\t23,288.00\tSMART TECH\t
25\tGEEBEE (BANGLADESH) LTD ( CTG )\tMicrosoft\tMicrosoft 365 Apps for business\tCFQ7TTC0LH1G\t\tAnnual\t27-Jul-2025\t27-Jul-2026\t3\t11,300.00\t33,900.00\tDIGITAL EQUIPMENT\t
26\tMAS INTIMATES BANGLADESH (PVT) LTD (CTG)\tFortinet\tUnified Threat Protection (UTP) (IPS, Advanced Malware Protection, etc.)\tFC-10-0401F-950-02-12\tSN-FG4H1FT924900545 SN-FG4H1FT924900582\tAnnual\t7-Aug-2025\t6-Aug-2026\t2\t\t0.00\tLost\t
27\tRSGT BANGLADESH LIMITED (CTG)\tMicrosoft\tCopilot for Microsoft 365\tCFQ7TTC0MM8R\t\tAnnual\t14-Aug-2025\t14-Aug-2026\t8\t56,000.00\t448,000.00\tLost\tLost to other vendor
28\tRSGT BANGLADESH LIMITED (CTG)\tMicrosoft\tPower BI Pro\tCFQ7TTC0LHSF\t\tAnnual\t4-Jun-2025\t6-Apr-2026\t20\t22,670.00\t453,400.00\tLost\tStar Tech
29\tKABIR STEEL RE- ROLLING MILLS LTD. (CTG)\tOracle\tOracle Advanced Pricing, Financials, Order Management, BI Suite perpetual titles\t\tCSI No.-20159800 & 20160501\tAnnual\t18-Aug-2025\t17-Aug-2026\t1\t2,032,505.00\t2,032,505.00\tSMART TECH\t5% VAT Only, Tax Exemption Certificate
30\tIOM-COX’S BAZAR\tTeamViewer\tTeamViewer Business Subscription\t\t\tAnnual\t22-Aug-2025\t21-Aug-2026\t1\t96,025.00\t96,025.00\tSMART TECH\t
31\tGEEBEE (BANGLADESH) LTD ( CTG )\tMicrosoft\tMicrosoft 365 Apps for business\tCFQ7TTC0LH1G\t\tAnnual\t4-Sep-2025\t4-Sep-2026\t7\t11,300.00\t79,100.00\tDIGITAL EQUIPMENT\t
32\tASIAN UNIVERSITY FOR WOMEN (CTG)\tVMware\tAcademic VMware vSphere/vCenter support/subscription 3 years\tVS7-STD-A/VS6-STD-3P-SSS-A\t\t3 Years\t\t\t4\t211,764.00\t847,056.00\tProposal\t
33\tASIAN UNIVERSITY FOR WOMEN (CTG)\tVMware\tAcademic VMware vCenter Server 7 Standard 3 years\tVCS7-STD-A/VCS7-STD-3P-SSS-A\t\t3 Years\t\t\t1\t1,029,838.00\t1,029,838.00\tProposal\t
34\tRSGT BANGLADESH LIMITED (CTG)\tMicrosoft\tPower Apps Premium\tCFQ7TTC0LH2H\t\tAnnual\t4-Sep-2025\t4-Sep-2026\t1\t31,050.00\t31,050.00\tSMART TECH\t
35\tKARNAPHULI FERTILIZER COMPANY LTD. (KAFCO). (CTG)\tVMware\tVMware vSphere 7 Standard for 1 processor + Production Support 1 year\t4125433309\t\t3 Years\t16-Jun-2022\t15-Jun-2025\t4\t237,175.00\t948,700.00\tSMART TECH\t
36\tKARNAPHULI SHOES IND. LTD. (CTG)\tAdobe\tPhotoshop & Illustrator for teams\t65297618BA01B12/65297605BA01B12\tVIP: 8CADE461C47477DDOBAA\tAnnual\t18-Jan-2024\t14-Jan-2026\t2\t54,260.00\t108,520.00\tSMART TECH\t
37\tTITAS SPORTSWEAR INDUSTRIES LTD. (CTG)\tAdobe\tPhotoshop & Illustrator for teams\t65297618BA01B12/65297605BA01B12\tVIP: 4537D2DBD04529692B6A\tAnnual\t18-Jan-2024\t14-Jan-2026\t2\t54,260.00\t108,520.00\tSMART TECH\t
38\tKARNAPHULI SPORTSWEAR IND. LTD. (CTG)\tAdobe\tPhotoshop & Illustrator for teams\t65297618BA01B12/65297605BA01B12\tVIP: DDD2EE3E91B6C26F7B1A\tAnnual\t24-Dec-2025\t23-Dec-2026\t2\t58,950.00\t117,900.00\tSMART TECH\t
39\tYOUNGONE (CEPZ) LTD. (CTG)\tAdobe\tPhotoshop & Illustrator for teams\t65297618BA01B12/65297605BA01B12\tVIP: 26BD34714110B3D7556A\tAnnual\t24-Dec-2025\t23-Dec-2026\t2\t58,950.00\t117,900.00\tSMART TECH\t
40\tRSGT BANGLADESH LIMITED (CTG)\tMicrosoft\tVisio Plan 2\tCFQ7TTC0HD32\t\tAnnual\t7-Jan-2026\t6-Jan-2027\t1\t23,500.00\t23,500.00\tDIGITAL EQUIPMENT\t
41\tTITAS SPORTSWEAR INDUSTRIES LTD. (CTG)\tAdobe\tPhotoshop & Illustrator for teams\t65297618BA01B12/65297605BA01B12\tVIP: 4537D2DBD04529692B6A\tAnnual\t7-Jan-2026\t7-Jan-2027\t2\t58,950.00\t117,900.00\tSMART TECH\t
42\tSTS HOSPITAL CHITTAGONG LIMITED (CTG)\tAdobe\tCreative Cloud for teams All Apps\t65297756BA01B12\tVIP: D36CE364C7263AD1B54A\tAnnual\t6-Oct-2024\t1-Sep-2025\t1\t145,000.00\t145,000.00\tSMART TECH\t
43\tGEEBEE (BANGLADESH) LTD ( CTG )\tAdobe\tAcrobat Pro DC for teams\t65233394BA01A12\t\tAnnual\t19-Oct-2024\t18-Oct-2025\t11\t34,750.00\t382,250.00\tSMART TECH\t
44\tYOUNGONE (CEPZ) LTD. (CTG)\tAdobe\tPhotoshop & Illustrator for teams\t65297618BA01B12\tVIP: 26BD34714110B3D7556A\tAnnual\t26-Nov-2024\t25-Nov-2025\t2\t58,950.00\t117,900.00\tSMART TECH\t
45\tTITAS SPORTSWEAR INDUSTRIES LTD. (CTG)\tAdobe\tPhotoshop & Illustrator for teams\t65297618BA01B12\tVIP: 4537D2DBD04529692B6A\tAnnual\t26-Nov-2024\t25-Nov-2025\t2\t58,950.00\t117,900.00\tSMART TECH\t
46\tKARNAPHULI SPORTSWEAR IND. LTD. (CTG)\tAdobe\tPhotoshop & Illustrator for teams\t65297618BA01B12\tVIP: DDD2EE3E91B6C26F7B1A\tAnnual\t26-Nov-2024\t25-Nov-2025\t2\t58,950.00\t117,900.00\tSMART TECH\t
47\tKARNAPHULI SHOES IND. LTD. (CTG)\tAdobe\tPhotoshop & Illustrator for teams\t65297618BA01B12\tVIP: 8CADE461C47477DDOBAA\tAnnual\t26-Nov-2024\t25-Nov-2025\t2\t58,950.00\t117,900.00\tSMART TECH\t
48\tSUMMIT LNG TERMINAL CO. (PVT.) LTD. (CTG)\tAdobe\tAcrobat Pro DC for teams\t65233394BA01A12\tVIP-523BFD9AC4AB566252BA\tAnnual\t17-Dec-2024\t16-Dec-2025\t1\t36,315.00\t36,315.00\tSMART TECH\t
49\tKARNAPHULI FERTILIZER COMPANY LTD. (KAFCO). (CTG)\tOracle\tOracle Database Standard Edition – Named User Plus Perpetual\tCSI No-16022662\t\tAnnual\t16-Jan-2025\t15-Jan-2026\t1\t260,684.00\t260,684.00\tSMART TECH\t
50\tMAF SHOES LTD. (CTG)\tVeeam\tVeeam Data Cloud for Microsoft 365 Flex 1-50 users. Upfront Billing\tV-VDCFLX-0U-SU1YP-V1\t\tAnnual\t13-Feb-2025\t12-Feb-2026\t10\t6,125.00\t61,250.00\tSMART TECH\t
51\tRSGT BANGLADESH LIMITED (CTG)\tMicrosoft\tProject Plan 5\tCFQ7TTCOHDZ\t\tAnnual\t25-Mar-2025\t25-Mar-2026\t1\t0.00\t0.00\tSMART TECH\t
52\tGEEBEE (BANGLADESH) LTD ( CTG )\tAdobe\tAcrobat Pro DC for teams\t65324109BA01A12\tVIP-A6EF6172F763F3F37D4A\tAnnual\t5-May-2025\t5-Apr-2026\t1\t36,350.00\t36,350.00\tSMART TECH\t
53\tRSGT BANGLADESH LIMITED (CTG)\tMicrosoft\tMicrosoft 365 E3 Annual\tCFQ7TTC0LFLX\t\tAnnual\t11-Jan-2026\t10-Jan-2027\t115\t57,215.00\t6,579,712.89\tDIGITAL EQUIPMENT\t
54\tRSGT BANGLADESH LIMITED (CTG)\tAdobe\tAutoCAD LT Commercial Single-user Annual Subscription Renewal\t057I1-006845-L846\tCustomer # 5501785850\tAnnual\t15-May-2025\t14-May-2026\t1\t83,663.00\t83,663.00\tSMART TECH\t
55\tRSGT BANGLADESH LIMITED (CTG)\tMicrosoft\tMicrosoft 365 F3 (no Teams) Annual\tCFQ7TTC0MZJF\t\tAnnual\t11-Jan-2026\t10-Jan-2027\t20\t11,014.00\t220,287.11\tDIGITAL EQUIPMENT\t
56\tKARNAPHULI SHOES IND. LTD. (CTG)\tAdobe\tPhotoshop & Illustrator for teams\t65297618BA01B12/65297605BA01B12\tVIP: 8CADE461C47477DDOBAA\tAnnual\t28-Jan-2026\t27-Jan-2027\t2\t58,950.00\t117,900.00\tSMART TECH\t
57\tALPHA PRODUCT DEVELOPMENT COMPANY (BD) LTD. (CTG)\tAdobe\tIllustrator for teams\t65297605BA01B12\tVIP-FA18C75458B41EA710EA\tAnnual\t1-Mar-2026\t1-Mar-2027\t2\t58,950.00\t117,900.00\tSMART TECH\t
58\tYOUNGONE HI-TECH SPORTSWEAR IND. LTD. (CTG)\tAdobe\tPhotoshop & Illustrator for teams\t65297618BA01B12/65297605BA01B12\t\tAnnual\t3-Mar-2026\t3-Mar-2027\t6\t58,950.00\t353,700.00\tSMART TECH\t
59\tKABIR STEEL RE- ROLLING MILLS LTD. (CTG)\tMicrosoft\tMicrosoft 365 Business Basic (no Teams) Annual\tCFQ7TTC0LH18\tTenant ID: ac2e7e85-7cf1-443b-86d0-522b64d4ff43\tAnnual\t10-Mar-2026\t10-Mar-2027\t30\t3,039.00\t91,170.00\tSMART TECH\t
60\tKARNAPHULI SHOES IND. LTD. (CTG)\tAdobe\tPhotoshop & Illustrator for teams\t65297618BA01B12/65297605BA01B12\tVIP: 20CB33AC8395B216C13A\tAnnual\t20-Mar-2026\t20-Mar-2027\t6\t58,950.00\t353,700.00\tSMART TECH\t
61\tINTERCONTINENTAL TECHNOLOGY LIMITED (CTG)\tGoogle\tGoogle Workspace Business Starter\tGAPPS-STARTER-1USER-12MO\t\tAnnual\t30-Apr-2026\t30-Apr-2027\t11\t13,476.00\t148,236.00\tSMART TECH\t
62\tKARNAPHULI FERTILIZER COMPANY LTD. (KAFCO). (CTG)\tAutodesk\tAutoCAD LT 2024 Commercial New 3-Year Subscription\t057P1-WW9153-L317\t\t3 Years\t1-May-2024\t1-May-2027\t1\t180,412.00\t180,412.00\tLost\t
63\tKENPARK BANGLADESH APPAREL (PVT.) LTD.(CTG)\tCisco CON\tSNTC 8X5XNBD CON-SNT-3548PXL\tN3K-C3548P-XL\tContract Number: 206001258\t3 Years\t10-Jun-2024\t9-Jun-2027\t1\t2,500,000.00\t2,500,000.00\tSMART TECH\tDevice SN-FOC2729R3XT
64\tKARNAPHULI FERTILIZER COMPANY LTD. (KAFCO). (CTG)\tAutodesk\tAutoCAD - including specialized toolsets 3-Year Subscription\tC1RK1-WW3611-L802\t\t3 Years\t1-Jul-2024\t1-Jul-2027\t1\t654,000.00\t654,000.00\tSMART TECH\t
65\tKARNAPHULI FERTILIZER COMPANY LTD. (KAFCO). (CTG)\tVeeam\tVeeam Data Platform Foundation Universal Subscription License 3 Years\tV-FDNVUL-0I-SU3YP-00\t\t3 Years\t27-Sep-2024\t26-Sep-2027\t5\t380,032.00\t1,900,160.00\tSMART TECH\t
66\tKARNAPHULI FERTILIZER COMPANY LTD. (KAFCO). (CTG)\tVeeam\tVeeam Data Cloud for Microsoft 365 3 Years Upfront Billing\tV-VDC365-0U-SU3YP-00\t\t3 Years\t27-Sep-2024\t26-Sep-2027\t130\t11,320.00\t1,471,600.00\tSMART TECH\t
67\tSEWTECH FASHIONS LIMITED (CTG)\tFortinet\tFortiGate-60F Unified Protection\tFC-10-0060F-950-02-36\tContract: 4323SL317576\t3 Years\t7-May-2025\t6-May-2028\t1\t150,000.00\t150,000.00\tSMART TECH\t
68\tGenNet (CTG)\tMicrosoft\tMicrosoft 365 Business Basic (With Teams & No Teams) Annual Renewal\tCFQ7TTC0LH18\tTenant ID629cf4a1-cd57-4fdc-9160-2454429aa59b\tAnnual\t18-May-2026\t17-May-2027\t15\t3,467.00\t52,000.00\tSMART TECH\t
69\tGenNet (CTG)\tMicrosoft\tMicrosoft 365 Business Basic (With Teams & No Teams) Annual Renewal\tCFQ7TTC0LH18\tTenant ID: d589aeab-72c7-494e-b860-fc1f7428e08f\tAnnual\t20-May-2026\t19-May-2027\t15\t47,000.00\t47,000.00\tSMART TECH\t
70\tYOUNGONE HI-TECH SPORTSWEAR IND. LTD. (CTG)\tAdobe\tPhotoshop & Illustrator for teams\t65297618BA01B12/65297605BA01B12\t\tAnnual\t25-May-2026\t\t6\t56,000.00\t336,000.00\tSMART TECH\t
71\tRSGT BANGLADESH LIMITED (CTG)\tAdobe\tAutoCAD LT Commercial Single-user Annual Subscription Renewal\t057I1-006845-L846\tContract ID: 110004775139\tAnnual\t21-May-2026\t20-May-2027\t1\t84,908.00\t84,908.00\tSMART TECH\t
72\tGenNet (CTG)\tMicrosoft\tMicrosoft 365 Business Basic (No Teams) Annual Renewal\tCFQ7TTC0LH18\tTenant ID: dcefb7d4-5810-40e1-8dfe-1d76d97adeae\tAnnual\t21-May-2026\t20-May-2027\t23\t2,800.00\t64,400.00\tSMART TECH\t`;

function parseDateHelper(str: string): string {
  if (!str || str.trim() === "") return "";
  const monthsMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
  };
  const parts = str.trim().split("-");
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const monthName = parts[1].toLowerCase().substring(0, 3);
    const m = monthsMap[monthName] || "01";
    let year = parts[2];
    if (year.length === 2) year = "20" + year;
    return `${year}-${m}-${day}`;
  }
  return str;
}

function parseSeedSubscriptions(): SoftwareSubscription[] {
  const lines = RAW_SEED_DATA.trim().split("\n");
  const referenceDate = new Date("2026-06-04");

  return lines.map((line, idx) => {
    const cols = line.split("\t").map(s => s.trim().replace(/^"|"$/g, ''));
    if (cols.length < 13) return null;

    const sl = cols[0];
    const accountName = cols[1];
    const brand = cols[2] || "Other";
    const product = cols[3];
    const partNo = cols[4];
    const contractNo = cols[5];
    const tenure = cols[6];
    const activatedOnRaw = cols[7];
    const expiresOnRaw = cols[8];
    const qtyRaw = cols[9];
    const unitPriceRaw = cols[10];
    const totalRaw = cols[11];
    const vendorCol = cols[12];
    const otherInfo = cols[13] || "";

    const activatedOn = parseDateHelper(activatedOnRaw);
    const expiresOn = parseDateHelper(expiresOnRaw);

    const qty = parseInt(qtyRaw.replace(/,/g, '')) || 1;
    const unitPrice = parseFloat(unitPriceRaw.replace(/,/g, '')) || 0;
    const totalValue = parseFloat(totalRaw.replace(/,/g, '')) || (qty * unitPrice);

    const cleanVendorVal = vendorCol.trim().toLowerCase();
    
    let status = "Active";
    let renewalStage: SoftwareSubscription['renewal_stage'] = "Not Started";
    let prob = 100;

    const expiryDate = expiresOn ? new Date(expiresOn) : null;
    let daysRemaining = 999;
    if (expiryDate && !isNaN(expiryDate.getTime())) {
      const diffTime = expiryDate.getTime() - referenceDate.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    if (cleanVendorVal === "lost") {
      status = "Expired";
      renewalStage = "Lost";
      prob = 0;
    } else if (cleanVendorVal === "expired") {
      status = "Expired";
      renewalStage = "Lost";
      prob = 0;
    } else if (cleanVendorVal === "proposal") {
      status = "Active";
      renewalStage = "Quotation Sent";
      prob = 40;
    } else {
      if (expiryDate && daysRemaining < 0) {
        status = "Expired";
        renewalStage = "Customer Contacted";
        prob = 50;
      } else {
        status = "Active";
        if (daysRemaining <= 30) {
          renewalStage = "Negotiation";
          prob = 90;
        } else if (daysRemaining <= 60) {
          renewalStage = "Quotation Sent";
          prob = 80;
        } else if (daysRemaining <= 90) {
          renewalStage = "Customer Contacted";
          prob = 75;
        } else {
          renewalStage = "Not Started";
          prob = 100;
        }
      }
    }

    const remarksParts = [];
    if (otherInfo) {
      remarksParts.push(`Other Info: ${otherInfo}`);
    }

    return {
      id: `sub-seed-${sl || idx}`,
      account_name: accountName,
      customer_id: `CUST-SW-${100 + idx}`,
      brand_oem: brand || "Other",
      local_vendor: vendorCol || "SMART TECH", // Map Column 12 (Vendor) to local_vendor
      product_name: product,
      part_no: partNo,
      contract_no: contractNo,
      tenure: tenure || "Annual",
      activated_on: activatedOn || "2025-06-01",
      expires_on: expiresOn || "2026-06-01",
      quantity: qty,
      unit_price: unitPrice,
      total_value: totalValue,
      currency: "BDT",
      renewal_stage: renewalStage,
      renewal_probability: prob,
      status: status,
      sales_owner: "M. A. Rahman",
      competitor: "",
      remarks: remarksParts.join(" | ") || "Imported contract config details fully matched",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as SoftwareSubscription;
  }).filter(Boolean) as SoftwareSubscription[];
}

const INITIAL_SUBSCRIPTIONS: SoftwareSubscription[] = [];

const INITIAL_BRANDS: SoftwareBrandOem[] = [
  { id: "v-ms", brand_name: "Microsoft", annual_target: 12000000, achieved_value: 0, active_value: 0 },
  { id: "v-ad", brand_name: "Adobe", annual_target: 4500000, achieved_value: 0, active_value: 0 },
  { id: "v-vm", brand_name: "VMware", annual_target: 6000000, achieved_value: 0, active_value: 0 },
  { id: "v-so", brand_name: "Sophos", annual_target: 3000000, achieved_value: 0, active_value: 0 },
  { id: "v-ve", brand_name: "Veeam", annual_target: 5000000, achieved_value: 0, active_value: 0 },
  { id: "v-fn", brand_name: "Fortinet", annual_target: 2000000, achieved_value: 0, active_value: 0 },
  { id: "v-au", brand_name: "Autodesk", annual_target: 2500000, achieved_value: 0, active_value: 0 },
  { id: "v-or", brand_name: "Oracle", annual_target: 3000000, achieved_value: 0, active_value: 0 },
  { id: "v-ci", brand_name: "Cisco CON", annual_target: 4000000, achieved_value: 0, active_value: 0 },
  { id: "v-ot", brand_name: "Other", annual_target: 1000000, achieved_value: 0, active_value: 0 }
];

const INITIAL_ACTIVITIES: RenewalActivity[] = [];

export function getSubscriptions(): SoftwareSubscription[] {
  try {
    const raw = safeLocalStorage.getItem(SUBS_KEY);
    if (!raw) {
      const parsed = parseSeedSubscriptions();
      saveSubscriptions(parsed);
      return parsed;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_SUBSCRIPTIONS;
  }
}

export function saveSubscriptions(subs: SoftwareSubscription[]): void {
  try {
    safeLocalStorage.setItem(SUBS_KEY, JSON.stringify(subs));
  } catch (e) {
    console.error("Failed to save subscriptions", e);
  }
}

export function getActivities(): RenewalActivity[] {
  try {
    const raw = safeLocalStorage.getItem(ACTIVITIES_KEY);
    if (!raw) {
      saveActivities(INITIAL_ACTIVITIES);
      return INITIAL_ACTIVITIES;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_ACTIVITIES;
  }
}

export function saveActivities(acts: RenewalActivity[]): void {
  try {
    safeLocalStorage.setItem(ACTIVITIES_KEY, JSON.stringify(acts));
  } catch (e) {
    console.error("Failed to save activities", e);
  }
}

export function getBrands(): SoftwareBrandOem[] {
  try {
    const subs = getSubscriptions();
    
    // Get unique brand names from subscriptions
    const subscriptionBrands = Array.from(new Set(subs.map(s => s.brand_oem)));
    
    // Merge with initial brands to ensure we have targets for known ones
    const allBrandNames = Array.from(new Set([
      ...INITIAL_BRANDS.map(b => b.brand_name),
      ...subscriptionBrands
    ]));

    const savedBrandsRaw = safeLocalStorage.getItem(BRANDS_KEY);
    const savedBrands: SoftwareBrandOem[] = savedBrandsRaw ? JSON.parse(savedBrandsRaw) : [];

    const updatedBrands = allBrandNames.map(brandName => {
      const initial = INITIAL_BRANDS.find(b => b.brand_name === brandName);
      
      const brandSubs = subs.filter(s => {
        if (brandName === "Other") {
          return !allBrandNames.filter(n => n !== "Other").some(name => 
            s.brand_oem.toLowerCase().includes(name.toLowerCase())
          );
        }
        return s.brand_oem.toLowerCase().includes(brandName.toLowerCase());
      });

      const active_value = brandSubs.filter(s => s.status === "Active").reduce((sum, s) => sum + s.total_value, 0);
      
      // Default target: Total value of all concerned subscriptions for this brand in the SBM sheet
      const defaultTarget = brandSubs.reduce((sum, s) => sum + s.total_value, 0);

      // Achievement: Total sum of total_value for subscriptions with Activated On date in the running/current year (Jan-Dec)
      const currentYear = new Date().getFullYear();
      const achieved_value = brandSubs
        .filter(s => {
          if (!s.activated_on) return false;
          // Extract year safely from YYYY-MM-DD
          const parts = s.activated_on.split('-');
          if (parts.length > 0) {
            const yr = parseInt(parts[0]);
            if (yr === currentYear) return true;
          }
          const d = new Date(s.activated_on);
          return !isNaN(d.getTime()) && d.getFullYear() === currentYear;
        })
        .reduce((sum, s) => sum + s.total_value, 0);

      // Load manual overriding target if saved in local storage
      const savedBrand = savedBrands.find(sb => sb.brand_name.toLowerCase() === brandName.toLowerCase());
      const annual_target = (savedBrand && savedBrand.annual_target !== undefined) ? savedBrand.annual_target : defaultTarget;

      return {
        id: initial ? initial.id : `v-dyn-${brandName.toLowerCase().replace(/\s+/g, '-')}`,
        brand_name: brandName,
        annual_target,
        active_value,
        achieved_value
      };
    });

    return updatedBrands; 
  } catch (e) {
    return INITIAL_BRANDS;
  }
}

export function saveBrands(brands: SoftwareBrandOem[]): void {
  try {
    safeLocalStorage.setItem(BRANDS_KEY, JSON.stringify(brands));
  } catch (e) {
    console.error("Failed to save brands", e);
  }
}

export function resetSoftwareDb(): void {
  try {
    safeLocalStorage.setItem(SUBS_KEY, JSON.stringify(INITIAL_SUBSCRIPTIONS));
    safeLocalStorage.setItem(ACTIVITIES_KEY, JSON.stringify(INITIAL_ACTIVITIES));
    safeLocalStorage.setItem(BRANDS_KEY, JSON.stringify(INITIAL_BRANDS));
  } catch (e) {
    console.error("Failed to reset software Db", e);
  }
}
