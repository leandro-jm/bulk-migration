const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { appDb } = require('../config/database');
const logger = require('../config/logger');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');

const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// ==========================================
// GET - List all preserts
// ==========================================
router.get('/', async (req, res) => {
  try {
    const presets = await appDb('rule_presets')
      .select('*')
      .orderBy('created_at', 'desc');
    
    const parsedPresets = presets.map(preset => ({
      ...preset,
      rules: typeof preset.rules === 'string' ? JSON.parse(preset.rules) : preset.rules
    }));
    
    res.json(parsedPresets);
  } catch (error) {
    logger.error('Error fetching rule presets:', error);
    res.status(500).json({ error: 'Failed to fetch rule presets' });
  }
});

// ==========================================
// GET - Recover preset by ID
// ==========================================
router.get('/:id', async (req, res) => {
  try {
    const preset = await appDb('rule_presets')
      .where('id', req.params.id)
      .first();

    if (!preset) {
      return res.status(404).json({ error: 'Rule preset not found' });
    }

    // Parse rules
    preset.rules = typeof preset.rules === 'string' ? JSON.parse(preset.rules) : preset.rules;

    res.json(preset);
  } catch (error) {
    logger.error('Error fetching rule preset:', error);
    res.status(500).json({ error: 'Failed to fetch rule preset' });
  }
});

// ==========================================
// POST - create new preset
// ==========================================
router.post('/', async (req, res) => {
  try {
    const { name, description, rules } = req.body;

    if (!name || !rules) {
      return res.status(400).json({ error: 'Name and rules are required' });
    }

    if (typeof rules !== 'object' || Array.isArray(rules)) {
      return res.status(400).json({ error: 'Rules must be an object' });
    }

    const validRules = ['schema', 'overwrite', 'upsert', 'ignore'];
    for (const [table, rule] of Object.entries(rules)) {
      if (!validRules.includes(rule)) {
        return res.status(400).json({ 
          error: `Invalid rule '${rule}' for table '${table}'. Valid rules: ${validRules.join(', ')}`
        });
      }
    }

    const id = uuidv4();
    await appDb('rule_presets').insert({
      id,
      name,
      description: description || null,
      rules: JSON.stringify(rules)
    });

    const newPreset = await appDb('rule_presets')
      .where('id', id)
      .first();

    logger.info(`Rule preset created: ${name} (${id})`);
    res.status(201).json(newPreset);
  } catch (error) {
    logger.error('Error creating rule preset:', error);
    if (error.message.includes('unique')) {
      res.status(409).json({ error: 'A preset with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create rule preset' });
    }
  }
});

// ==========================================
// PUT - Update preset
// ==========================================
router.put('/:id', async (req, res) => {
  try {
    const { name, description, rules } = req.body;

    const preset = await appDb('rule_presets')
      .where('id', req.params.id)
      .first();

    if (!preset) {
      return res.status(404).json({ error: 'Rule preset not found' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (rules) {
      const validRules = ['schema', 'overwrite', 'upsert', 'ignore'];
      for (const [table, rule] of Object.entries(rules)) {
        if (!validRules.includes(rule)) {
          return res.status(400).json({ 
            error: `Invalid rule '${rule}' for table '${table}'`
          });
        }
      }
      updateData.rules = JSON.stringify(rules);
    }

    await appDb('rule_presets')
      .where('id', req.params.id)
      .update(updateData);

    const updated = await appDb('rule_presets')
      .where('id', req.params.id)
      .first();

    logger.info(`Rule preset updated: ${req.params.id}`);
    res.json(updated);
  } catch (error) {
    logger.error('Error updating rule preset:', error);
    res.status(500).json({ error: 'Failed to update rule preset' });
  }
});

// ==========================================
// DELETE - Delete preset
// ==========================================
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await appDb('rule_presets')
      .where('id', req.params.id)
      .del();

    if (deleted === 0) {
      return res.status(404).json({ error: 'Rule preset not found' });
    }

    logger.info(`Rule preset deleted: ${req.params.id}`);
    res.json({ message: 'Rule preset deleted successfully' });
  } catch (error) {
    logger.error('Error deleting rule preset:', error);
    res.status(500).json({ error: 'Failed to delete rule preset' });
  }
});

// ==========================================
// POST - Import preset from CSV
// ==========================================
router.post('/import/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Preset name is required' });
    }

    const rules = {};
    const errors = [];
    let lineNumber = 0;

    const stream = Readable.from(req.file.buffer);

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          lineNumber++;
          
          const tableName = row.table_name || row.tableName || row.table || row.Table;
          const rule = row.rule || row.Rule || row.migration_rule;

          if (!tableName || !rule) {
            errors.push(`Line ${lineNumber}: Missing table_name or rule`);
            return;
          }

          const validRules = ['schema', 'overwrite', 'upsert', 'ignore'];
          if (!validRules.includes(rule.toLowerCase())) {
            errors.push(`Line ${lineNumber}: Invalid rule '${rule}' for table '${tableName}'`);
            return;
          }

          rules[tableName] = rule.toLowerCase();
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (Object.keys(rules).length === 0) {
      return res.status(400).json({ 
        error: 'No valid rules found in CSV',
        details: errors
      });
    }

    const id = uuidv4();
    await appDb('rule_presets').insert({
      id,
      name,
      description: description || `Imported from CSV with ${Object.keys(rules).length} tables`,
      rules: JSON.stringify(rules)
    });

    const newPreset = await appDb('rule_presets')
      .where('id', id)
      .first();

    logger.info(`Rule preset imported from CSV: ${name} (${Object.keys(rules).length} tables)`);
    
    res.status(201).json({
      preset: newPreset,
      imported: Object.keys(rules).length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    logger.error('Error importing CSV:', error);
    res.status(500).json({ error: 'Failed to import CSV', message: error.message });
  }
});

// ==========================================
// GET - Export preset to CSV
// ==========================================
router.get('/:id/export/csv', async (req, res) => {
  try {
    const preset = await appDb('rule_presets')
      .where('id', req.params.id)
      .first();

    if (!preset) {
      return res.status(404).json({ error: 'Rule preset not found' });
    }

    const rules = JSON.parse(preset.rules);
    
    let csv = 'table_name,rule\n';
    for (const [table, rule] of Object.entries(rules)) {
      csv += `${table},${rule}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${preset.name.replace(/\s+/g, '_')}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// ==========================================
// GET - Template CSV
// ==========================================
router.get('/template/csv', (req, res) => {
  const template = `table_name,rule
users,overwrite
products,upsert
orders,ignore
settings,schema`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="rule_preset_template.csv"');
  res.send(template);
});

module.exports = router;