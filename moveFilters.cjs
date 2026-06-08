const fs = require('fs');
const content = fs.readFileSync('src/pages/KamAnalyticsPage.tsx', 'utf-8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('KAM Analytics Filters positioned after the Benchmark'));
let endIdx = startIdx;
while (endIdx < lines.length && !lines[endIdx].includes('KAM List & Ranking')) {
  endIdx++;
}

// We extract the block 
const block = lines.splice(startIdx, endIdx - startIdx);

// Now, find the insertion point
const insertIdx = lines.findIndex(l => l.includes('KAM to KAM Comparison - Full Width Bar Chart'));
lines.splice(insertIdx - 1, 0, ...block); 

fs.writeFileSync('src/pages/KamAnalyticsPage.tsx', lines.join('\n'));
