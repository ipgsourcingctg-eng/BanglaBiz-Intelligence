
const fs = require('fs');
const filePath = 'src/data/mockData.ts';
const content = fs.readFileSync(filePath, 'utf8');
const updated = content.replace(/Dhaka HQ/g, 'Unassigned');
fs.writeFileSync(filePath, updated);
console.log('Updated Dhaka HQ to Unassigned');
