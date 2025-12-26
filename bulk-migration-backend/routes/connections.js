const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { appDb } = require('../config/database');
const { testConnection, getCollections } = require('../services/connectionService');
const logger = require('../config/logger');

// Get all connections
router.get('/', async (req, res) => {
 try {
    const connections = await appDb('connections')
      .where('status', 'active')
      .select('id', 'name', 'host', 'port', 'database', 'username', 'ssl', 'ssl_mode', 'reject_unauthorized', 'created_at');
    
    const parsedConnections = connections.map(conn => ({
      ...conn,
      ssl: !!conn.ssl, 
      reject_unauthorized: !!conn.reject_unauthorized 
    }));
    
    res.json(parsedConnections);
  } catch (error) {
    logger.error('Error fetching connections:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

router.post('/', async (req, res) => {
   try {
    const { 
      name, 
      host, 
      port, 
      database, 
      username, 
      password,
      ssl,
      ssl_mode,
      reject_unauthorized
    } = req.body;

    if (!name || !host || !port || !database || !username || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const sslConfig = ssl ? {
      rejectUnauthorized: reject_unauthorized !== undefined ? reject_unauthorized : false,
      ...(ssl_mode === 'require' && { require: true })
    } : false;

    const connectionConfig = { 
      host, 
      port: parseInt(port, 10), 
      database, 
      username, 
      password,
      ssl: sslConfig
    };
    
    const testResult = await testConnection(connectionConfig);

    if (!testResult.success) {
      return res.status(400).json({ 
        error: 'Connection test failed', 
        message: testResult.message 
      });
    }

    const id = uuidv4();
    await appDb('connections').insert({
      id,
      name,
      host,
      port: parseInt(port, 10),
      database,
      username,
      password, 
      ssl: ssl || false,
      ssl_mode: ssl_mode || 'prefer',
      reject_unauthorized: reject_unauthorized || false
    });

    logger.info(`Connection created: ${name} (${id}) - SSL: ${ssl}`);

    res.status(201).json({
      id,
      name,
      host,
      port: parseInt(port, 10),
      database,
      username,
      ssl: ssl || false,
      ssl_mode: ssl_mode || 'prefer',
      message: 'Connection created successfully'
    });
  } catch (error) {
    logger.error('Error creating connection:', error);
    res.status(500).json({ error: 'Failed to create connection' });
  }
});

router.post('/test', async (req, res) => {
  try {
    const { host, port, database, username, password, ssl, ssl_mode, reject_unauthorized } = req.body;
    
    // Configurar SSL
    const sslConfig = ssl ? {
      rejectUnauthorized: reject_unauthorized || false
    } : false;
    
    const result = await testConnection({ 
      host, 
      port, 
      database, 
      username, 
      password,
      ssl: sslConfig 
    });
    
    res.json(result);
  } catch (error) {
    logger.error('Error testing connection:', error);
    res.status(500).json({ error: 'Connection test failed' });
  }
});

router.get('/:id/collections', async (req, res) => {
 try {
    const connection = await appDb('connections')
      .where('id', req.params.id)
      .first();

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    let sslConfig = false;
    if (connection.ssl) {
      sslConfig = {
        rejectUnauthorized: connection.reject_unauthorized || false
      };
    }

    const collections = await getCollections({
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      password: connection.password,
      ssl: sslConfig 
    });

    res.json(collections);
  } catch (error) {
    logger.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await appDb('connections')
      .where('id', req.params.id)
      .update({ status: 'deleted' });

    logger.info(`Connection deleted: ${req.params.id}`);
    res.json({ message: 'Connection deleted successfully' });
  } catch (error) {
    logger.error('Error deleting connection:', error);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

module.exports = router;