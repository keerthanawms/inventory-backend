/**
 * User Management Routes (Admin Only)
 * Handles viewing, approving, soft‑deleting, restoring, and permanently deleting users.
 * All routes require authentication and admin role (enforced in controller).
 */

const express = require('express');
const {
    getAllUsers,
    getPendingUsers,
    getDeletedUsers,
    approveUser,
    deleteUser,
    restoreUser,
    permanentDeleteUser
} = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Get all active users (not soft‑deleted)
router.get('/', authMiddleware, getAllUsers);

// Get all users with status = 0 (pending approval)
router.get('/pending', authMiddleware, getPendingUsers);

// Get all soft‑deleted users (deleted_at IS NOT NULL)
router.get('/deleted', authMiddleware, getDeletedUsers);

// Approve a pending user (set status = 1)
router.put('/approve/:id', authMiddleware, approveUser);

// Soft‑delete a user (set deleted_at and status = 0)
router.delete('/:id', authMiddleware, deleteUser);

// Restore a soft‑deleted user (clear deleted_at and set status = 1)
router.put('/restore/:id', authMiddleware, restoreUser);

// Permanently delete a user (hard delete – removes record)
router.delete('/permanent/:id', authMiddleware, permanentDeleteUser);

module.exports = router;