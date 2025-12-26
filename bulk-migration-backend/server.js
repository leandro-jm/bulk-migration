const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const logger = require('./config/logger');
const connectionRoutes = require('./routes/connections');
const migrationRoutes = require('./routes/migrations');
const reportRoutes = require('./routes/reports');
const { initializeDatabase } = require('./config/database');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

console.log('DB Config:', {
  host: process.env.APP_DB_HOST,
  port: process.env.APP_DB_PORT,
  database: process.env.APP_DB_NAME,
  user: process.env.APP_DB_USER,
  password: process.env.APP_DB_PASSWORD ? '***' : 'MISSING!'
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    body: req.body,
    query: req.query
  });
  next();
});

// Routes
app.use('/api/connections', connectionRoutes);
app.use('/api/migrations', migrationRoutes);
app.use('/api/reports', reportRoutes);
const rulePresetRoutes = require('./routes/rulePresets');
app.use('/api/rule-presets', rulePresetRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Initialize and start server
async function startServer() {
  try {
    await initializeDatabase();
    logger.info('Database initialized successfully');

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();