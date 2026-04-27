/**
 * Script to create the default admin user in the database.
 * Run this file once before starting the backend.
 * Usage: node create_admin.js
 */

// Import database connection and bcrypt for password hashing
const db = require('../config/db');
const bcrypt = require('bcryptjs');

// Define admin credentials
async function createAdmin() {
    const email = 'admin@gmail.com';
    const password = 'admin1234';
    const hashed = await bcrypt.hash(password, 10);

    try {
        // Check if admin already exists
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length > 0) {
            console.log(' Admin user already exists.');
            process.exit(0);
        }

        // Insert admin with status = 1 (active)
        await db.query(
            'INSERT INTO users (name, email, password, role, status, created_at) VALUES (?, ?, ?, ?, 1, NOW())',
            ['Admin', email, hashed, 'admin']
        );
        console.log(' Admin user created successfully!');
        console.log(` Email: ${email}`);
        console.log(` Password: ${password}`);
        process.exit(0);
    } catch (err) {
        console.error(' Database error:', err.message);
        process.exit(1);
    }
}

// Execute the function
createAdmin();