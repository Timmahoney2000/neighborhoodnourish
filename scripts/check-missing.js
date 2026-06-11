const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/data/nj_food_pantries.json', 'utf8'));

let failed = [];

Object.entries(data.pantries_by_county).forEach(([county, pantries]) => {
  pantries.forEach((p, idx) => {
    if (!p.lat || !p.lng) {
      failed.push({ county, idx, name: p.name, address: p.address, city: p.city, zip: p.zip });
    }
  });
});

console.log(JSON.stringify(failed, null, 2));
console.log('\nTotal missing coords:', failed.length);