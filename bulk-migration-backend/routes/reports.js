const express = require('express');
const router = express.Router();
const { appDb } = require('../config/database');
const logger = require('../config/logger');

// Get migration statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await appDb('migrations')
      .select(
        appDb.raw('COUNT(*) as total'),
        appDb.raw("COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed"),
        appDb.raw("COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed"),
        appDb.raw("COUNT(CASE WHEN status = 'running' THEN 1 END) as running")
      )
      .first();

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Export migration report
router.get('/:id/export', async (req, res) => {
  try {
    const migration = await appDb('migrations')
      .where('id', req.params.id)
      .first();

    if (!migration) {
      return res.status(404).json({ error: 'Migration not found' });
    }

    const logs = await appDb('migration_logs')
      .where('migration_id', req.params.id)
      .orderBy('created_at', 'asc');

    const report = {
      migration,
      logs,
      exportedAt: new Date().toISOString()
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=migration-${req.params.id}.json`);
    res.json(report);
  } catch (error) {
    logger.error('Error exporting report:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

module.exports = router;