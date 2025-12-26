const knex = require('knex');
const logger = require('./logger');
const dotenv = require('dotenv');

dotenv.config();

const requiredEnvVars = ['APP_DB_HOST', 'APP_DB_PORT', 'APP_DB_NAME', 'APP_DB_USER', 'APP_DB_PASSWORD'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const appDb = knex({
  client: 'pg',
  connection: {
    host: process.env.APP_DB_HOST,
    port: parseInt(process.env.APP_DB_PORT, 10),
    database: process.env.APP_DB_NAME,
    user: process.env.APP_DB_USER,
    password: String(process.env.APP_DB_PASSWORD)
  },
  pool: { min: 2, max: 10 }
});

async function initializeDatabase() {
  try {

    // Create connections table
    const hasConnectionsTable = await appDb.schema.hasTable('connections');

        if (!hasConnectionsTable) {
      await appDb.schema.createTable('connections', (table) => {
        table.uuid('id').primary();
        table.string('name').notNullable();
        table.string('host').notNullable();
        table.integer('port').notNullable();
        table.string('database').notNullable();
        table.string('username').notNullable();
        table.string('password').notNullable();
        table.boolean('ssl').defaultTo(false);
        table.string('ssl_mode').defaultTo('prefer'); // disable, require, prefer
        table.boolean('reject_unauthorized').defaultTo(false); // Para self-signed certs
        table.string('status').defaultTo('active');
        table.timestamps(true, true);
      });
      logger.info('Created connections table');
    } else {
      const hasSSL = await appDb.schema.hasColumn('connections', 'ssl');
      if (!hasSSL) {
        await appDb.schema.alterTable('connections', (table) => {
          table.boolean('ssl').defaultTo(false);
          table.string('ssl_mode').defaultTo('prefer');
          table.boolean('reject_unauthorized').defaultTo(false);
        });
        logger.info('Added SSL columns to connections table');
      }
    }

    if (!hasConnectionsTable) {
      await appDb.schema.createTable('connections', (table) => {
        table.uuid('id').primary();
        table.string('name').notNullable();
        table.string('host').notNullable();
        table.integer('port').notNullable();
        table.string('database').notNullable();
        table.string('username').notNullable();
        table.string('password').notNullable(); // In production, encrypt this
        table.string('status').defaultTo('active');
        table.timestamps(true, true);
      });
      logger.info('Created connections table');
    }

    // Create migrations table
    const hasMigrationsTable = await appDb.schema.hasTable('migrations');
    if (!hasMigrationsTable) {
      await appDb.schema.createTable('migrations', (table) => {
        table.uuid('id').primary();
        table.uuid('source_connection_id').references('id').inTable('connections');
        table.uuid('target_connection_id').references('id').inTable('connections');
        table.string('status').notNullable(); // pending, running, completed, failed
        table.text('global_rule').notNullable();
        table.jsonb('collections').notNullable();
        table.jsonb('result').nullable();
        table.integer('duration_ms').nullable();
        table.text('error_message').nullable();
        table.timestamps(true, true);
      });
      logger.info('Created migrations table');
    }

    // Create migration_logs table
    const hasLogsTable = await appDb.schema.hasTable('migration_logs');
    if (!hasLogsTable) {
      await appDb.schema.createTable('migration_logs', (table) => {
        table.uuid('id').primary();
        table.uuid('migration_id').references('id').inTable('migrations');
        table.string('collection_name').notNullable();
        table.string('level').notNullable(); // info, warning, error
        table.text('message').notNullable();
        table.jsonb('metadata').nullable();
        table.timestamp('created_at').defaultTo(appDb.fn.now());
      });
      logger.info('Created migration_logs table');
    }

    const hasRulePresetsTable = await appDb.schema.hasTable('rule_presets');
    if (!hasRulePresetsTable) {
      await appDb.schema.createTable('rule_presets', (table) => {
        table.uuid('id').primary();
        table.string('name').notNullable().unique();
        table.text('description');
        table.jsonb('rules').notNullable(); // { "tableName": "rule" }
        table.timestamps(true, true);
      });
      logger.info('Created rule_presets table');
    }

    const hasRuleItemsTable = await appDb.schema.hasTable('rule_items');
    if (!hasRuleItemsTable) {
      await appDb.schema.createTable('rule_items', (table) => {
        table.uuid('id').primary();
        table.string('table_name').notNullable();
        table.string('rule').notNullable(); // schema, overwrite, upsert, ignore
        table.text('description');
        table.timestamps(true, true);
        table.index(['table_name']);
      });
      logger.info('Created rule_items table');
    }

    logger.info('Database schema initialized');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

module.exports = { appDb, initializeDatabase };