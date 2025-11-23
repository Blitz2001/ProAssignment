// Quick test script to verify password hashing
import bcrypt from 'bcryptjs';

const testPassword = 'testpassword123';
const salt = await bcrypt.genSalt(10);
const hashed = await bcrypt.hash(testPassword, salt);

console.log('Original password:', testPassword);
console.log('Hashed password:', hashed);
console.log('Hash starts with $2b$:', hashed.startsWith('$2b$'));

// Test comparison
const match = await bcrypt.compare(testPassword, hashed);
console.log('Comparison test:', match ? 'PASS' : 'FAIL');

process.exit(0);

