/**
 * Main server file - Production ready
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const stockInRoutes = require('./routes/stockInRoutes');
const stockOutRoutes = require('./routes/stockOutRoutes');
const locationRoutes = require('./routes/locationRoutes');
const productLocationRoutes = require('./routes/productLocationRoutes');
const anomalyRoutes = require('./routes/anomalyRoutes');
const mlRoutes = require('./routes/mlRoutes');

const app = express();

// CORS - allow requests from your Netlify frontend (and localhost for dev)
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:5500'];

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        }
        // Also allow any netlify.app domain
        if (origin.endsWith('.netlify.app')) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => res.json({ status: 'ok', message: 'Inventory API running' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/stockin', stockInRoutes);
app.use('/api/stockout', stockOutRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/product-locations', productLocationRoutes);
app.use('/api/anomalies', anomalyRoutes);
app.use('/api/ml', mlRoutes);

const PORT = process.env.PORT || 5000;

db.getConnection()
    .then(connection => {
        console.log('Connected to database successfully');
        connection.release();
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch(err => {
        console.error('Database connection failed:', err.message);
        process.exit(1);
    });
