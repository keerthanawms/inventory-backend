/**
 * User Controller
 * Handles user management (admin only): view all, pending, deleted, approve, soft delete, restore, permanent delete.
 */

const db = require('../config/db');

/**
 * Get all active users (not soft‑deleted) – includes status (0 or 1).
 */
// Get all active users 
exports.getAllUsers = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT user_id, name, email, role, created_at, status 
            FROM users 
            WHERE deleted_at IS NULL
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Get only pending users (status=0, not soft‑deleted).
 */
// Get only pending users
exports.getPendingUsers = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT user_id, name, email, role, created_at 
            FROM users 
            WHERE status = 0 AND deleted_at IS NULL
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Get all soft‑deleted users (deleted_at IS NOT NULL).
 */
// Get all deleted users
exports.getDeletedUsers = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT user_id, name, email, role, created_at, deleted_at 
            FROM users 
            WHERE deleted_at IS NOT NULL
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Approve a pending user – set status=1.
 * Only admin.
 */
// Approve user 
exports.approveUser = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query(`
            UPDATE users 
            SET status = 1 
            WHERE user_id = ? AND status = 0 AND deleted_at IS NULL
        `, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found or already approved' });
        }
        res.json({ message: 'User approved successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Soft delete a user – set deleted_at = NOW() and status = 0.
 * User can be restored later.
 * Admin cannot delete themselves.
 */
// delete user
exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.user.user_id;

    if (parseInt(id) === currentUserId) {
        return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    try {
        const [result] = await db.query(`
            UPDATE users 
            SET deleted_at = NOW(), status = 0 
            WHERE user_id = ? AND deleted_at IS NULL
        `, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'User soft-deleted and set to pending' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Restore a soft‑deleted user – set deleted_at = NULL and status = 1.
 * Only admin.
 */
//restoring user
exports.restoreUser = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query(`
            UPDATE users 
            SET deleted_at = NULL, status = 1 
            WHERE user_id = ? AND deleted_at IS NOT NULL
        `, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found or already active' });
        }
        res.json({ message: 'User restored and set active' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Permanently delete a user (hard delete) – removes record completely.
 * Only admin. Cannot delete own account.
 * May fail if user has related records (foreign key constraint).
 */
// Permanent delete 
exports.permanentDeleteUser = async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.user.user_id;

    if (parseInt(id) === currentUserId) {
        return res.status(400).json({ message: 'You cannot permanently delete your own account' });
    }

    try {
        // Check if user exists
        const [user] = await db.query('SELECT * FROM users WHERE user_id = ?', [id]);
        if (user.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Hard delete – cascade depends on foreign key configuration
        await db.query('DELETE FROM users WHERE user_id = ?', [id]);
        res.json({ message: 'User permanently deleted' });
    } catch (err) {
        // Foreign key error handling
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ message: 'Cannot delete user because they have related records. Remove those first.' });
        }
        res.status(500).json({ message: err.message });
    }
};