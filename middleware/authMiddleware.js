/**
 * Authentication Middleware
 * Verifies JWT token and checks that the user still exists and is not soft‑deleted.
 * Attaches user info to req.user if valid.
 */

const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

// JWT secret – must match the one used to sign tokens
const JWT_SECRET = process.env.JWT_SECRET || 'rolebaseinventorysys';

module.exports = async (req, res, next) => {
    // Extract Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }

    // Get the token part after "Bearer "
    const token = authHeader.split(' ')[1];

    try {
        // Verify token and decode payload
        const decoded = jwt.verify(token, JWT_SECRET);

        // Verify that the user still exists in the database and is not soft‑deleted
        const [rows] = await db.query('SELECT * FROM users WHERE user_id = ? AND deleted_at IS NULL', [decoded.user_id]);
        if (rows.length === 0) {
            return res.status(401).json({ message: 'User no longer exists or has been deactivated' });
        }

        // Attach decoded user info to request object
        req.user = decoded;
        next();
    } catch (err) {
        // Token invalid, expired, or signature mismatch
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};