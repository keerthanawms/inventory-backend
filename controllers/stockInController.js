/**
 * Stock-In Request Controller
 * Handles creation, approval, rejection, and resubmission of stock‑in requests.
 * Only inventory managers can create/resubmit; only warehouse managers can approve/reject.
 */

const db = require('../config/db');

/**
 * Get all stock‑in requests with product name and creator/reviewer details (name + role).
 * Sorted newest first.
 */
// Get all stock-in requests
exports.getAll = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT r.*, 
                   p.name as product_name,
                   creator.name as creator_name,
                   creator.role as creator_role,
                   reviewer.name as reviewer_name,
                   reviewer.role as reviewer_role
            FROM stock_in_requests r
            JOIN products p ON r.product_id = p.product_id
            LEFT JOIN users creator ON r.created_by = creator.user_id
            LEFT JOIN users reviewer ON r.reviewed_by = reviewer.user_id
            ORDER BY r.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Create a new stock‑in request (pending).
 * Only accessible by inventory manager or admin.
 */
// Create stock-in request (by inventory manager)
exports.create = async (req, res) => {
    const { product_id, requested_quantity } = req.body;
    const created_by = req.user.user_id;
    try {
        const [result] = await db.query(
            'INSERT INTO stock_in_requests (product_id, requested_quantity, created_by) VALUES (?, ?, ?)',
            [product_id, requested_quantity, created_by]
        );
        res.status(201).json({ request_id: result.insertId, message: 'Request created' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Approve a pending stock‑in request.
 * Updates inventory (creates or adds quantity).
 * Only warehouse manager or admin.
 * Uses a transaction to ensure data consistency.
 */
// Approve request (warehouse manager)
exports.approve = async (req, res) => {
    const { id } = req.params;
    const reviewed_by = req.user.user_id;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        // Get request details
        const [reqRows] = await connection.query('SELECT * FROM stock_in_requests WHERE request_id = ?', [id]);
        if (reqRows.length === 0) throw new Error('Request not found');
        const request = reqRows[0];
        if (request.status !== 'pending') throw new Error('Request already processed');

        // Update request status
        await connection.query(
            'UPDATE stock_in_requests SET status = "approved", reviewed_by = ? WHERE request_id = ?',
            [reviewed_by, id]
        );

        // Update inventory (create if not exists, else add quantity)
        const [invRows] = await connection.query('SELECT * FROM inventory WHERE product_id = ?', [request.product_id]);
        if (invRows.length > 0) {
            await connection.query(
                'UPDATE inventory SET quantity = quantity + ? WHERE product_id = ?',
                [request.requested_quantity, request.product_id]
            );
        } else {
            await connection.query(
                'INSERT INTO inventory (product_id, quantity) VALUES (?, ?)',
                [request.product_id, request.requested_quantity]
            );
        }
        await connection.commit();
        res.json({ message: 'Request approved, inventory updated' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
};

/**
 * Reject a pending stock‑in request with a reason.
 * Only warehouse manager or admin.
 */
// Reject request
exports.reject = async (req, res) => {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const reviewed_by = req.user.user_id;
    try {
        await db.query(
            'UPDATE stock_in_requests SET status = "rejected", reviewed_by = ?, rejection_reason = ? WHERE request_id = ?',
            [reviewed_by, rejection_reason, id]
        );
        res.json({ message: 'Request rejected' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Resubmit a rejected stock‑in request (update quantity and set back to pending).
 * Only the original creator (inventory manager) or admin.
 */
// Resubmit (update rejected request)
exports.resubmit = async (req, res) => {
    const { id } = req.params;
    const { requested_quantity } = req.body;
    try {
        await db.query(
            'UPDATE stock_in_requests SET requested_quantity = ?, status = "pending", reviewed_by = NULL, rejection_reason = NULL WHERE request_id = ?',
            [requested_quantity, id]
        );
        res.json({ message: 'Request resubmitted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};