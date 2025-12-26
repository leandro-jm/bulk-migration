const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { appDb } = require('../config/database');
const { executeMigration } = require('../services/migrationService');
const logger = require('../config/logger');

// Get all migrations
router.get('/', async (req, res) => {
  try {
    const migrations = await appDb('migrations')
      .select('*')
      .orderBy('created_at', 'desc');
    
    res.json(migrations);
  } catch (error) {
    logger.error('Error fetching migrations:', error);
    res.status(500).json({ error: 'Failed to fetch migrations' });
  }
});

// Get migration by ID
router.get('/:id', async (req, res) => {
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

    res.json({ ...migration, logs });
  } catch (error) {
    logger.error('Error fetching migration:', error);
    res.status(500).json({ error: 'Failed to fetch migration' });
  }
});

// Execute migration
router.post('/execute', async (req, res) => {
  try {
    const { sourceConnectionId, targetConnectionId, globalRule, collections } = req.body;

    if (!sourceConnectionId || !targetConnectionId || !collections || collections.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create migration record
    const migrationId = uuidv4();
    await appDb('migrations').insert({
      id: migrationId,
      source_connection_id: sourceConnectionId,
      target_connection_id: targetConnectionId,
      status: 'running',
      global_rule: globalRule,
      collections: JSON.stringify(collections)
    });

    logger.info(`Migration started: ${migrationId}`);

    // Execute migration asynchronously
    executeMigration(migrationId, sourceConnectionId, targetConnectionId, globalRule, collections)
      .catch(error => logger.error(`Migration ${migrationId} failed:`, error));

    res.status(202).json({
      migrationId,
      message: 'Migration started',
      status: 'running'
    });
  } catch (error) {
    logger.error('Error starting migration:', error);
    res.status(500).json({ error: 'Failed to start migration' });
  }
});

// Rollback migration
router.post('/:id/rollback', async (req, res) => {
  try {
    const migration = await appDb('migrations')
      .where('id', req.params.id)
      .first();

    if (!migration) {
      return res.status(404).json({ error: 'Migration not found' });
    }

    if (migration.status !== 'completed') {
      return res.status(400).json({ error: 'Can only rollback completed migrations' });
    }

    // TODO: Implement rollback logic
    logger.warn(`Rollback requested for migration ${req.params.id} - not yet implemented`);

    res.json({ message: 'Rollback initiated (implementation pending)' });
  } catch (error) {
    logger.error('Error rolling back migration:', error);
    res.status(500).json({ error: 'Failed to rollback migration' });
  }
});

module.exports = router;