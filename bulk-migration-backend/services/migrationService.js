// ============================================
// services/migrationService.js - CORRIGIDO
// ============================================

const knex = require("knex");
const { appDb } = require("../config/database");
const logger = require("../config/logger");
const { v4: uuidv4 } = require("uuid");

/**
 * Serializa campos JSON/JSONB para inserção no PostgreSQL
 */
function serializeJsonFields(row, jsonColumns) {
  const serialized = { ...row };

  for (const [key, value] of Object.entries(serialized)) {
    // Se o valor é um objeto ou array, serializar para JSON string
    if (value !== null && typeof value === "object") {
      serialized[key] = JSON.stringify(value);
    }
  }

  return serialized;
}

/**
 * Obtém informações sobre as colunas de uma tabela
 */
async function getTableColumns(db, tableName) {
  const columns = await db.raw(
    `
    SELECT 
      column_name,
      data_type,
      udt_name,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = ?
    AND table_schema = 'public'
    ORDER BY ordinal_position
  `,
    [tableName]
  );

  return columns.rows;
}

/**
 * Identifica colunas do tipo JSON/JSONB
 */
function getJsonColumns(columns) {
  return columns
    .filter(
      (col) =>
        col.data_type === "json" ||
        col.data_type === "jsonb" ||
        col.udt_name === "json" ||
        col.udt_name === "jsonb"
    )
    .map((col) => col.column_name);
}

/**
 * Identifica colunas do tipo ARRAY
 */
function getArrayColumns(columns) {
  return columns
    .filter((col) => col.data_type === "ARRAY" || col.udt_name.startsWith("_"))
    .map((col) => col.column_name);
}

/**
 * Reseta sequences após inserção
 */
async function resetSequences(db, tableName) {
  try {
    const sequences = await db.raw(`
      SELECT 
        column_name,
        pg_get_serial_sequence(?, column_name) as sequence_name
      FROM information_schema.columns
      WHERE table_name = ?
      AND table_schema = 'public'
      AND column_default LIKE 'nextval%'
    `, [tableName, tableName]);

    for (const seq of sequences.rows) {
      if (seq.sequence_name) {
        try {
          // Pegar o maior valor atual da coluna
          const maxResult = await db(tableName)
            .max(seq.column_name)
            .first();
          
          const maxValue = maxResult[`max`] || 0;
          
          // Resetar sequence para max + 1
          await db.raw(`SELECT setval(?, ?, false)`, [
            seq.sequence_name,
            maxValue + 1
          ]);
          
          logger.info(`Sequence ${seq.sequence_name} reset to ${maxValue + 1}`);
        } catch (seqError) {
          logger.warn(`Could not reset sequence ${seq.sequence_name}: ${seqError.message}`);
        }
      }
    }
  } catch (error) {
    logger.warn(`Sequence reset skipped for ${tableName}: ${error.message}`);
  }
}

/**
 * Verifica se tabela tem dados
 */
async function tableHasData(db, tableName) {
  try {
    const result = await db(tableName).count('* as count').first();
    return parseInt(result.count) > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Copia constraints e indexes após dados
 */
async function copyConstraints(sourceDb, targetDb, tableName) {
  try {
    // Copiar UNIQUE constraints
    const uniqueConstraints = await sourceDb.raw(`
      SELECT
        tc.constraint_name,
        string_agg(kcu.column_name, ', ') as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = ?
      AND tc.constraint_type = 'UNIQUE'
      AND tc.table_schema = 'public'
      GROUP BY tc.constraint_name
    `, [tableName]);

    for (const constraint of uniqueConstraints.rows) {
      try {
        await targetDb.raw(`
          ALTER TABLE "${tableName}"
          ADD CONSTRAINT "${constraint.constraint_name}"
          UNIQUE (${constraint.columns})
        `);
        logger.info(`Unique constraint ${constraint.constraint_name} created`);
      } catch (err) {
        // Constraint pode já existir
        if (!err.message.includes('already exists')) {
          logger.warn(`Could not create constraint ${constraint.constraint_name}: ${err.message}`);
        }
      }
    }
  } catch (error) {
    logger.warn(`Constraint copy skipped for ${tableName}: ${error.message}`);
  }
}

/**
 * Prepara uma linha para inserção COM VALIDAÇÃO
 */
function prepareRowForInsert(row, jsonColumns, arrayColumns) {
  const prepared = {};
  
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      prepared[key] = null;
    } else if (jsonColumns.includes(key)) {
      // Campos JSON: serializar se for objeto
      if (typeof value === 'object') {
        try {
          prepared[key] = JSON.stringify(value);
        } catch (e) {
          logger.error(`Failed to stringify JSON column ${key}:`, e);
          prepared[key] = '{}';
        }
      } else if (typeof value === 'string') {
        // Validar se já é JSON válido
        try {
          JSON.parse(value);
          prepared[key] = value;
        } catch {
          prepared[key] = JSON.stringify(value);
        }
      } else {
        prepared[key] = value;
      }
    } else if (arrayColumns.includes(key)) {
      // Campos ARRAY
      if (Array.isArray(value)) {
        // Converter array JS para formato PostgreSQL
        prepared[key] = `{${value.map(v => 
          typeof v === 'string' ? `"${v.replace(/"/g, '\\"')}"` : v
        ).join(',')}}`;
      } else if (typeof value === 'string' && value.startsWith('{')) {
        prepared[key] = value;
      } else {
        prepared[key] = value;
      }
    } else if (typeof value === 'object' && !(value instanceof Date)) {
      // Outros objetos
      try {
        prepared[key] = JSON.stringify(value);
      } catch (e) {
        logger.error(`Failed to stringify object in column ${key}:`, e);
        prepared[key] = null;
      }
    } else {
      prepared[key] = value;
    }
  }
  
  return prepared;
}

/**
 * Valida se a migração pode prosseguir
 */
async function validateMigration(sourceDb, targetDb, collectionName) {
  const errors = [];
  
  try {
    // Verificar se tabela existe na origem
    const sourceExists = await sourceDb.schema.hasTable(collectionName);
    if (!sourceExists) {
      errors.push(`Table ${collectionName} does not exist in source database`);
    }
    
    // Verificar se há dados na origem
    if (sourceExists) {
      const sourceCount = await sourceDb(collectionName).count('* as count').first();
      if (parseInt(sourceCount.count) === 0) {
        errors.push(`Table ${collectionName} is empty in source database`);
      }
    }
    
  } catch (error) {
    errors.push(`Validation failed: ${error.message}`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Executa a migração completa
 */
async function executeMigration(
  migrationId,
  sourceConnId,
  targetConnId,
  globalRule,
  collections
) {
  const startTime = Date.now();
  let sourceDb, targetDb;

  try {
  // Get connection details
    const sourceConn = await appDb('connections').where('id', sourceConnId).first();
    const targetConn = await appDb('connections').where('id', targetConnId).first();

    if (!sourceConn || !targetConn) {
      throw new Error('Source or target connection not found');
    }

    // Configurar SSL para source
    let sourceSslConfig = false;
    if (sourceConn.ssl) {
      sourceSslConfig = {
        rejectUnauthorized: sourceConn.reject_unauthorized || false
      };
    }

    // Configurar SSL para target
    let targetSslConfig = false;
    if (targetConn.ssl) {
      targetSslConfig = {
        rejectUnauthorized: targetConn.reject_unauthorized || false
      };
    }

    // Create database connections
    sourceDb = knex({
      client: 'pg',
      connection: {
        host: sourceConn.host,
        port: sourceConn.port,
        database: sourceConn.database,
        user: sourceConn.username,
        password: String(sourceConn.password),
        ssl: sourceSslConfig
      }
    });

    targetDb = knex({
      client: 'pg',
      connection: {
        host: targetConn.host,
        port: targetConn.port,
        database: targetConn.database,
        user: targetConn.username,
        password: String(targetConn.password),
        ssl: targetSslConfig
      }
    });

    const results = [];

    // Processar cada coleção
    for (const collection of collections) {
      const collectionName = collection.name;
      const rule = collection.rule || globalRule;

      logger.info(
        `Processing collection: ${collectionName} with rule: ${rule}`
      );

      try {
        await logMigration(
          migrationId,
          collectionName,
          "info",
          `Starting migration with rule: ${rule}`
        );

        // Obter informações das colunas
        const columns = await getTableColumns(sourceDb, collectionName);
        const jsonColumns = getJsonColumns(columns);
        const arrayColumns = getArrayColumns(columns);

        logger.info(
          `Table ${collectionName} - JSON columns: ${
            jsonColumns.join(", ") || "none"
          }`
        );
        logger.info(
          `Table ${collectionName} - Array columns: ${
            arrayColumns.join(", ") || "none"
          }`
        );

        let rowsMigrated = 0;

        switch (rule) {
          case "schema":
            const schemaChanges = await migrateSchema(
              sourceDb,
              targetDb,
              collectionName,
              (msg) => logMigration(migrationId, collectionName, "info", msg)
            );

            if (schemaChanges.tableCreated) {
              await logMigration(
                migrationId,
                collectionName,
                "info",
                "Table created successfully"
              );
            }
            if (schemaChanges.columnsAdded.length > 0) {
              await logMigration(
                migrationId,
                collectionName,
                "info",
                `Added columns: ${schemaChanges.columnsAdded.join(", ")}`
              );
            }
            if (schemaChanges.errors.length > 0) {
              await logMigration(
                migrationId,
                collectionName,
                "warning",
                `Errors: ${schemaChanges.errors.map((e) => e.error).join("; ")}`
              );
            }

            rowsMigrated = schemaChanges.columnsAdded.length;
            break;

        case 'overwrite':
          // Verificar se tabela existe no destino
          const targetTableExists = await targetDb.schema.hasTable(collectionName);
          
          if (!targetTableExists) {
            // Se não existe, criar primeiro
            await logMigration(migrationId, collectionName, 'info', 'Target table does not exist, creating...');
            await migrateSchema(sourceDb, targetDb, collectionName, 
              async (msg) => await logMigration(migrationId, collectionName, 'info', msg)
            );
          }
          
          // Verificar se tem dados no destino
          const hasData = await tableHasData(targetDb, collectionName);
          
          if (hasData) {
            // Desabilitar foreign key checks temporariamente
            await targetDb.raw('SET session_replication_role = replica');
            
            try {
              // Truncar tabela de destino
              await targetDb.raw(`TRUNCATE TABLE "${collectionName}" CASCADE`);
              await logMigration(migrationId, collectionName, 'info', 'Table truncated');
              
              // Resetar sequences
              await resetSequences(targetDb, collectionName);
              await logMigration(migrationId, collectionName, 'info', 'Sequences reset');
              
            } finally {
              // Reabilitar foreign key checks
              await targetDb.raw('SET session_replication_role = DEFAULT');
            }
          } else {
            await logMigration(migrationId, collectionName, 'info', 'Table is empty, skipping truncate');
          }
          
          // Migrar dados
          rowsMigrated = await migrateData(sourceDb, targetDb, collectionName, jsonColumns, arrayColumns);
          
          // Resetar sequences após inserção
          await resetSequences(targetDb, collectionName);
          
          // Copiar constraints
          await copyConstraints(sourceDb, targetDb, collectionName);
          
          await logMigration(migrationId, collectionName, 'info', 
            `Overwrite complete: ${rowsMigrated} rows migrated`);
          break;

          case "upsert":
            rowsMigrated = await upsertData(
              sourceDb,
              targetDb,
              collectionName,
              jsonColumns,
              arrayColumns
            );
            await logMigration(
              migrationId,
              collectionName,
              "info",
              `Upsert complete: ${rowsMigrated} rows`
            );
            break;

          case "ignore":
            rowsMigrated = await insertIgnoreData(
              sourceDb,
              targetDb,
              collectionName,
              jsonColumns,
              arrayColumns
            );
            await logMigration(
              migrationId,
              collectionName,
              "info",
              `Insert ignore complete: ${rowsMigrated} rows`
            );
            break;
        }

        results.push({
          collection: collectionName,
          rule,
          rowsMigrated,
          status: "success",
        });
      } catch (error) {
        logger.error(`Error migrating ${collectionName}:`, error);
        await logMigration(
          migrationId,
          collectionName,
          "error",
          `Migration failed: ${error.message}`
        );
        results.push({
          collection: collectionName,
          rule,
          status: "failed",
          error: error.message,
        });
      }
    }

    const duration = Date.now() - startTime;

    // Atualizar registro de migração
    await appDb("migrations")
      .where("id", migrationId)
      .update({
        status: "completed",
        result: JSON.stringify(results),
        duration_ms: duration,
      });

    logger.info(`Migration ${migrationId} completed in ${duration}ms`);
  } catch (error) {
    logger.error(`Migration ${migrationId} failed:`, error);

    await appDb("migrations")
      .where("id", migrationId)
      .update({
        status: "failed",
        error_message: error.message,
        duration_ms: Date.now() - startTime,
      });
  } finally {
    if (sourceDb) await sourceDb.destroy();
    if (targetDb) await targetDb.destroy();
  }
}

/**
 * Obtém informações detalhadas das colunas de uma tabela
 */
async function getTableColumnsDetailed(db, tableName) {
  const result = await db.raw(`
    SELECT 
      column_name,
      data_type,
      udt_name,
      is_nullable,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      column_default
    FROM information_schema.columns
    WHERE table_name = ?
    AND table_schema = 'public'
    ORDER BY ordinal_position
  `, [tableName]);
  
  return result.rows;
}

/**
 * Converte informações da coluna para tipo SQL
 */
function columnToSqlType(col) {
  let sqlType = '';
  
  switch (col.data_type) {
    case 'character varying':
      sqlType = col.character_maximum_length 
        ? `varchar(${col.character_maximum_length})` 
        : 'varchar(255)';
      break;
    case 'character':
      sqlType = col.character_maximum_length 
        ? `char(${col.character_maximum_length})` 
        : 'char(1)';
      break;
    case 'numeric':
      sqlType = `numeric(${col.numeric_precision || 10},${col.numeric_scale || 2})`;
      break;
    case 'integer':
      sqlType = 'integer';
      break;
    case 'bigint':
      sqlType = 'bigint';
      break;
    case 'smallint':
      sqlType = 'smallint';
      break;
    case 'boolean':
      sqlType = 'boolean';
      break;
    case 'text':
      sqlType = 'text';
      break;
    case 'json':
      sqlType = 'json';
      break;
    case 'jsonb':
      sqlType = 'jsonb';
      break;
    case 'uuid':
      sqlType = 'uuid';
      break;
    case 'timestamp without time zone':
      sqlType = 'timestamp';
      break;
    case 'timestamp with time zone':
      sqlType = 'timestamptz';
      break;
    case 'date':
      sqlType = 'date';
      break;
    case 'time without time zone':
      sqlType = 'time';
      break;
    case 'double precision':
      sqlType = 'double precision';
      break;
    case 'real':
      sqlType = 'real';
      break;
    case 'bytea':
      sqlType = 'bytea';
      break;
    case 'ARRAY':
      // Para arrays, usar o tipo base
      sqlType = col.udt_name.replace('_', '') + '[]';
      break;
    default:
      // Para tipos customizados ou não mapeados
      sqlType = col.udt_name || col.data_type;
  }
  
  return sqlType;
}

/**
 * Obtém sequences usadas por uma tabela
 */
async function getTableSequences(db, tableName) {
  try {
    const result = await db.raw(`
      SELECT 
        s.sequence_name,
        s.data_type,
        s.start_value,
        s.minimum_value,
        s.maximum_value,
        s.increment,
        pg_get_serial_sequence(?, c.column_name) as sequence_full_name
      FROM information_schema.sequences s
      JOIN information_schema.columns c 
        ON pg_get_serial_sequence(?, c.column_name) = quote_ident(s.sequence_schema) || '.' || quote_ident(s.sequence_name)
      WHERE c.table_name = ?
      AND c.table_schema = 'public'
    `, [tableName, tableName, tableName]);
    
    return result.rows;
  } catch (error) {
    // Se não encontrar sequences, retornar array vazio
    return [];
  }
}

/**
 * Cria sequences no banco de destino
 */
async function createSequences(sourceDb, targetDb, tableName, log) {
  try {
    // Buscar sequences da origem
    const sequences = await getTableSequences(sourceDb, tableName);
    
    for (const seq of sequences) {
      try {
        // Verificar se sequence já existe
        const seqExists = await targetDb.raw(`
          SELECT EXISTS (
            SELECT 1 
            FROM information_schema.sequences 
            WHERE sequence_name = ?
            AND sequence_schema = 'public'
          ) as exists
        `, [seq.sequence_name]);
        
        if (!seqExists.rows[0].exists) {
          // Criar sequence
          const createSeqSQL = `
            CREATE SEQUENCE IF NOT EXISTS "${seq.sequence_name}"
            INCREMENT BY ${seq.increment || 1}
            MINVALUE ${seq.minimum_value || 1}
            START WITH ${seq.start_value || 1}
          `;
          
          await targetDb.raw(createSeqSQL);
          log(`✅ Sequence ${seq.sequence_name} created`);
        } else {
          log(`Sequence ${seq.sequence_name} already exists`);
        }
      } catch (seqError) {
        log(`⚠️ Could not create sequence ${seq.sequence_name}: ${seqError.message}`);
      }
    }
  } catch (error) {
    log(`⚠️ Sequence creation skipped: ${error.message}`);
  }
}

/**
 * Obtém foreign keys de uma tabela
 */
async function getTableForeignKeys(db, tableName) {
  try {
    const result = await db.raw(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = ?
        AND tc.table_schema = 'public'
    `, [tableName]);
    
    return result.rows;
  } catch (error) {
    return [];
  }
}

/**
 * Migra o schema (estrutura) da tabela - VERSÃO COMPLETA
 */
async function migrateSchema(sourceDb, targetDb, tableName, logCallback) {
  const log = logCallback || console.log;
  const changes = {
    tableCreated: false,
    sequencesCreated: 0,
    columnsAdded: [],
    columnsModified: [],
    errors: []
  };

  try {
    // Obter colunas da origem
    const sourceColumns = await getTableColumnsDetailed(sourceDb, tableName);
    
    if (sourceColumns.length === 0) {
      log(`Table ${tableName} not found in source database`);
      return changes;
    }

    // Verificar se tabela existe no destino
    const tableExistsResult = await targetDb.raw(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ?
      ) as exists
    `, [tableName]);
    
    const tableExists = tableExistsResult.rows[0]?.exists;

    if (!tableExists) {
      // CRIAR SEQUENCES PRIMEIRO
      log(`Creating sequences for ${tableName}...`);
      await createSequences(sourceDb, targetDb, tableName, log);

      // CRIAR TABELA
      log(`Creating table ${tableName}...`);
      
      const columnDefs = sourceColumns.map(col => {
        let def = `"${col.column_name}" ${columnToSqlType(col)}`;
        
        // Remover DEFAULT com nextval se for sequence (será adicionado depois)
        if (col.column_default && col.column_default.includes('nextval')) {
          // Não adicionar default aqui, será configurado depois
        } else if (col.column_default) {
          def += ` DEFAULT ${col.column_default}`;
        }
        
        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }
        
        return def;
      });

      const createTableSQL = `CREATE TABLE "${tableName}" (${columnDefs.join(', ')})`;
      
      try {
        await targetDb.raw(createTableSQL);
        changes.tableCreated = true;
        log(`✅ Table ${tableName} created with ${sourceColumns.length} columns`);
      } catch (createError) {
        log(`❌ Failed to create table: ${createError.message}`);
        changes.errors.push({ table: tableName, error: createError.message });
        return changes;
      }

      // CONFIGURAR SEQUENCES NAS COLUNAS
      for (const col of sourceColumns) {
        if (col.column_default && col.column_default.includes('nextval')) {
          try {
            // Extrair nome da sequence
            const seqMatch = col.column_default.match(/'([^']+)'/);
            if (seqMatch) {
              const seqName = seqMatch[1].split('.').pop().replace(/'/g, '');
              
              // Configurar sequence na coluna
              await targetDb.raw(`
                ALTER TABLE "${tableName}" 
                ALTER COLUMN "${col.column_name}" 
                SET DEFAULT nextval('${seqName}'::regclass)
              `);
              
              // Configurar ownership da sequence
              await targetDb.raw(`
                ALTER SEQUENCE "${seqName}" 
                OWNED BY "${tableName}"."${col.column_name}"
              `);
              
              log(`✅ Sequence ${seqName} configured for column ${col.column_name}`);
              changes.sequencesCreated++;
            }
          } catch (seqError) {
            log(`⚠️ Could not configure sequence for ${col.column_name}: ${seqError.message}`);
          }
        }
      }

      // CRIAR PRIMARY KEY
      const pkColumns = sourceColumns.filter(c => 
        c.column_default && c.column_default.includes('nextval')
      );
      
      if (pkColumns.length > 0) {
        try {
          const pkName = `${tableName}_pkey`;
          const pkColNames = pkColumns.map(c => `"${c.column_name}"`).join(', ');
          
          await targetDb.raw(`
            ALTER TABLE "${tableName}" 
            ADD CONSTRAINT "${pkName}" 
            PRIMARY KEY (${pkColNames})
          `);
          
          log(`✅ Primary key created`);
        } catch (pkError) {
          log(`⚠️ Could not create primary key: ${pkError.message}`);
        }
      }

    } else {
      // TABELA EXISTE - ADICIONAR COLUNAS FALTANTES
      log(`Table ${tableName} exists, checking for new columns...`);
      
      const targetColumns = await getTableColumnsDetailed(targetDb, tableName);
      const targetColumnNames = targetColumns.map(c => c.column_name);
      
      const missingColumns = sourceColumns.filter(
        srcCol => !targetColumnNames.includes(srcCol.column_name)
      );

      if (missingColumns.length === 0) {
        log(`Table ${tableName} is up to date`);
      } else {
        log(`Found ${missingColumns.length} new column(s) to add`);
        
        for (const col of missingColumns) {
          try {
            // Criar sequence se necessário
            if (col.column_default && col.column_default.includes('nextval')) {
              const seqMatch = col.column_default.match(/'([^']+)'/);
              if (seqMatch) {
                const seqName = seqMatch[1].split('.').pop().replace(/'/g, '');
                
                // Verificar se sequence existe
                const seqExists = await targetDb.raw(`
                  SELECT EXISTS (
                    SELECT 1 FROM information_schema.sequences 
                    WHERE sequence_name = ?
                  ) as exists
                `, [seqName]);
                
                if (!seqExists.rows[0].exists) {
                  await targetDb.raw(`CREATE SEQUENCE "${seqName}"`);
                  log(`✅ Sequence ${seqName} created`);
                }
              }
            }

            const sqlType = columnToSqlType(col);
            let alterSQL = `ALTER TABLE "${tableName}" ADD COLUMN "${col.column_name}" ${sqlType}`;
            
            if (col.column_default && col.column_default.includes('nextval')) {
              alterSQL += ` DEFAULT ${col.column_default}`;
            } else if (col.column_default) {
              alterSQL += ` DEFAULT ${col.column_default}`;
            } else if (col.is_nullable === 'NO') {
              const defaultValue = getDefaultValueForType(col.data_type);
              if (defaultValue !== null) {
                alterSQL += ` DEFAULT ${defaultValue}`;
              }
            }

            log(`Adding column: ${col.column_name}`);
            await targetDb.raw(alterSQL);
            
            changes.columnsAdded.push(col.column_name);
            log(`✅ Column ${col.column_name} added`);
            
          } catch (colError) {
            changes.errors.push({
              column: col.column_name,
              error: colError.message
            });
            log(`❌ Failed to add column ${col.column_name}: ${colError.message}`);
          }
        }
      }
    }

    // Sincronizar índices
    await syncIndexes(sourceDb, targetDb, tableName, log);

  } catch (error) {
    log(`❌ Schema migration failed for ${tableName}: ${error.message}`);
    changes.errors.push({ table: tableName, error: error.message });
  }

  return changes;
}

/**
 * Retorna valor default para tipo de dados
 */
function getDefaultValueForType(dataType) {
  switch (dataType) {
    case 'integer':
    case 'bigint':
    case 'smallint':
    case 'numeric':
    case 'double precision':
    case 'real':
      return '0';
    case 'boolean':
      return 'false';
    case 'character varying':
    case 'character':
    case 'text':
      return "''";
    case 'json':
    case 'jsonb':
      return "'{}'";
    case 'timestamp without time zone':
    case 'timestamp with time zone':
      return 'NOW()';
    case 'date':
      return 'CURRENT_DATE';
    case 'uuid':
      return 'gen_random_uuid()';
    default:
      return null;
  }
}

/**
 * Sincroniza índices entre origem e destino
 */
async function syncIndexes(sourceDb, targetDb, tableName, log) {
  try {
    // Obter índices da origem (exceto primary key)
    const sourceIndexes = await sourceDb.raw(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = ?
      AND schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
    `, [tableName]);

    // Obter índices do destino
    const targetIndexes = await targetDb.raw(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = ?
      AND schemaname = 'public'
    `, [tableName]);

    const targetIndexNames = targetIndexes.rows.map(i => i.indexname);

    // Criar índices faltantes
    for (const idx of sourceIndexes.rows) {
      if (!targetIndexNames.includes(idx.indexname)) {
        try {
          log(`Creating index: ${idx.indexname}`);
          await targetDb.raw(idx.indexdef);
          log(`✅ Index ${idx.indexname} created`);
        } catch (idxError) {
          log(`⚠️ Could not create index ${idx.indexname}: ${idxError.message}`);
        }
      }
    }
  } catch (error) {
    log(`⚠️ Index sync skipped: ${error.message}`);
  }
}

/**
 * Migra dados com tratamento completo
 */
async function migrateData(sourceDb, targetDb, tableName, jsonColumns, arrayColumns) {
  const batchSize = 500;
  let offset = 0;
  let totalMigrated = 0;

  // Obter total de linhas
  const countResult = await sourceDb(tableName).count('* as count').first();
  const totalRows = parseInt(countResult.count);
  
  logger.info(`Starting data migration for ${tableName}: ${totalRows} rows`);

  while (true) {
    // Buscar dados em lotes
    const data = await sourceDb(tableName)
      .select('*')
      .limit(batchSize)
      .offset(offset);
    
    if (data.length === 0) break;

    // Preparar dados para inserção
    const preparedData = data.map(row => 
      prepareRowForInsert(row, jsonColumns, arrayColumns)
    );

    // Tentar inserir em lote
    try {
      // Desabilitar triggers temporariamente para evitar problemas
      await targetDb.raw('SET session_replication_role = replica');
      
      await targetDb(tableName).insert(preparedData);
      
      await targetDb.raw('SET session_replication_role = DEFAULT');
      
      totalMigrated += data.length;
      
      // Log de progresso
      const progress = ((totalMigrated / totalRows) * 100).toFixed(1);
      logger.info(`${tableName}: ${totalMigrated}/${totalRows} rows (${progress}%)`);
      
    } catch (insertError) {
      // Se falhar em lote, tentar linha por linha
      logger.warn(`Batch insert failed for ${tableName}, trying row by row: ${insertError.message}`);
      
      await targetDb.raw('SET session_replication_role = replica');
      
      for (const row of preparedData) {
        try {
          await targetDb(tableName).insert(row);
          totalMigrated++;
        } catch (rowError) {
          logger.error(`Failed to insert row in ${tableName}:`, {
            error: rowError.message,
            row: JSON.stringify(row).substring(0, 200) // Primeiros 200 chars
          });
        }
      }
      
      await targetDb.raw('SET session_replication_role = DEFAULT');
    }

    offset += batchSize;

    if (data.length < batchSize) break;
  }

  logger.info(`Completed data migration for ${tableName}: ${totalMigrated}/${totalRows} rows`);
  return totalMigrated;
}


/**
 * Upsert: Insere ou atualiza baseado na chave primária
 */
async function upsertData(
  sourceDb,
  targetDb,
  tableName,
  jsonColumns,
  arrayColumns
) {
  // Obter chave primária
  const pkQuery = await sourceDb.raw(`
    SELECT a.attname as column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = '"${tableName}"'::regclass 
    AND i.indisprimary
  `);

  const primaryKey = pkQuery.rows[0]?.column_name || "id";

  const data = await sourceDb(tableName).select("*");
  let count = 0;

  for (const row of data) {
    const preparedRow = prepareRowForInsert(row, jsonColumns, arrayColumns);

    try {
      await targetDb(tableName)
        .insert(preparedRow)
        .onConflict(primaryKey)
        .merge();
      count++;
    } catch (error) {
      logger.error(`Upsert failed for row in ${tableName}: ${error.message}`);
    }
  }

  return count;
}

/**
 * Insert Ignore: Insere apenas se não existir
 */
async function insertIgnoreData(
  sourceDb,
  targetDb,
  tableName,
  jsonColumns,
  arrayColumns
) {
  const data = await sourceDb(tableName).select("*");
  let inserted = 0;

  for (const row of data) {
    const preparedRow = prepareRowForInsert(row, jsonColumns, arrayColumns);

    try {
      await targetDb(tableName).insert(preparedRow);
      inserted++;
    } catch (error) {
      // Ignorar erros de duplicidade
      if (
        !error.message.includes("duplicate key") &&
        !error.message.includes("unique constraint")
      ) {
        logger.error(`Insert failed for row in ${tableName}: ${error.message}`);
      }
    }
  }

  return inserted;
}

/**
 * Registra log da migração
 */
async function logMigration(
  migrationId,
  collectionName,
  level,
  message,
  metadata = null
) {
  try {
    await appDb("migration_logs").insert({
      id: uuidv4(),
      migration_id: migrationId,
      collection_name: collectionName,
      level,
      message,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (error) {
    logger.error("Failed to log migration:", error);
  }
}

module.exports = { 
  executeMigration,
  migrateData,
  resetSequences,
  tableHasData,
  validateMigration,
  copyConstraints,
  prepareRowForInsert
};