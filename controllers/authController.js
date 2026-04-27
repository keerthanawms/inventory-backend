/**
 * Authentication Controller
 * Handles user registration (public and admin) and login.
 */

const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// JWT secret key – fallback if not set in environment
const JWT_SECRET = process.env.JWT_SECRET || 'rolebaseinventorysys';

/**
 * Public registration – creates a user with status = 0 (pending approval)
 * Anyone can call this endpoint.
 */
exports.registerPublic = async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        // Hash the password before storing
        const hashed = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, 0)',
            [name, email, hashed, role]
        );
        res.status(201).json({ message: 'Registration request submitted. Wait for admin approval.' });
    } catch (err) {
        // Handle duplicate email error
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: err.message });
    }
};

/**
 * Admin registration – creates a user with status = 1 (active immediately)
 * Only accessible by admin users.
 */
exports.registerAdmin = async (req, res) => {
    const { name, email, password, role } = req.body;
    // Role check: only admin can create active users directly
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admin can create users directly' });
    }
    try {
        const hashed = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, 1)',
            [name, email, hashed, role]
        );
        res.status(201).json({ user_id: result.insertId, name, email, role });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: err.message });
    }
};

/**
 * Login – only active (status=1) and non-deleted users can log in.
 * Returns a JWT token and user info.
 */
exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        // Query only users with status=1 and not soft-deleted
        const [rows] = await db.query('SELECT * FROM users WHERE email = ? AND status = 1 AND deleted_at IS NULL', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password, or account not approved' });
        }
        const user = rows[0];
        // Verify password
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        // Generate JWT token valid for 1 day
        const token = jwt.sign(
            { user_id: user.user_id, role: user.role, name: user.name },
            JWT_SECRET,
            { expiresIn: '1d' }
        );
        res.json({ token, user: { user_id: user.user_id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};