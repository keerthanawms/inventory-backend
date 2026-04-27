/**
 * Authentication Routes
 * Handles public login, public registration request, and admin‑only user creation.
 */

const express = require('express');
const { login, registerPublic, registerAdmin } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Public login – any user can attempt to log in
router.post('/login', login);

// Admin‑only registration – creates an active user immediately (requires admin token)
router.post('/register', authMiddleware, registerAdmin);

// Public registration request – creates a user with status=0 (pending approval)
router.post('/request', registerPublic);

module.exports = router;