const knex = require('knex');
const logger = require('../config/logger');

async function testConnection(config) {
  let db;
  try {
    let sslConfig = false;
    
    if (config.ssl) {
      if (typeof config.ssl === 'object') {
        sslConfig = config.ssl;
      } else if (config.ssl === true) {
        sslConfig = {
          rejectUnauthorized: config.reject_unauthorized !== undefined 
            ? config.reject_unauthorized 
            : false
        };
      }
    }

    db = knex({
      client: 'pg',
      connection: {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: String(config.password),
        ssl: sslConfig
      },
      pool: { min: 0, max: 1 }
    });

    await db.raw('SELECT 1');
    
    const versionResult = await db.raw('SELECT version()');
    const version = versionResult.rows[0].version;
    
    return { 
      success: true, 
      message: 'Connection successful',
      info: {
        ssl: !!sslConfig,
        version: version.split(',')[0]
      }
    };
  } catch (error) {
    logger.error('Connection test failed:', error);
    
    let message = error.message;
    
    if (error.code === '28000' || error.message.includes('no pg_hba.conf')) {
      message = 'Connection rejected. Try enabling SSL for cloud databases (AWS RDS, Azure, etc.)';
    } else if (error.code === 'ENOTFOUND') {
      message = 'Host not found. Check the hostname/IP address';
    } else if (error.code === 'ECONNREFUSED') {
      message = 'Connection refused. Check if PostgreSQL is running and port is correct';
    } else if (error.code === '28P01') {
      message = 'Authentication failed. Check username and password';
    } else if (error.code === '3D000') {
      message = 'Database does not exist';
    }
    
    return { success: false, message };
  } finally {
    if (db) await db.destroy();
  }
}

async function getCollections(config) {
  let db;
  try {
    let sslConfig = false;
    
    if (config.ssl) {
      if (typeof config.ssl === 'object') {
        sslConfig = config.ssl;
      } else if (config.ssl === true) {
        sslConfig = {
          rejectUnauthorized: config.reject_unauthorized !== undefined 
            ? config.reject_unauthorized 
            : false
        };
      }
    }

    db = knex({
      client: 'pg',
      connection: {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: String(config.password),
        ssl: sslConfig
      }
    });

    const tables = await db.raw(`
      SELECT 
        tablename as name,
        schemaname,
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_name = tablename) as column_count
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const collections = await Promise.all(
      tables.rows.map(async (table) => {
        try {
          const countResult = await db(table.name).count('* as count').first();
          return {
            name: table.name,
            description: `Table with ${table.column_count} columns`,
            rowCount: parseInt(countResult.count)
          };
        } catch (error) {
          return {
            name: table.name,
            description: `Table with ${table.column_count} columns`,
            rowCount: 0
          };
        }
      })
    );

    return collections;
  } catch (error) {
    logger.error('Error fetching collections:', error);
    throw error;
  } finally {
    if (db) await db.destroy();
  }
}

module.exports = { testConnection, getCollections };
