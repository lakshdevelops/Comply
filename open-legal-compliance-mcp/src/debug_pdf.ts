
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

console.log('Type:', typeof pdf);
console.log('Value:', pdf);
if (typeof pdf === 'object') {
    console.log('Keys:', Object.keys(pdf));
    console.log('Default:', pdf.default);
}
