import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Upload, 
  Download, 
  FileText,
  XCircle,
  Save,
  X
} from 'lucide-react';
import { api } from '../../services/api';
import type { RulePreset, MigrationRule } from '../../types';

const MIGRATION_RULES: { value: MigrationRule; label: string }[] = [
  { value: 'schema', label: 'Schema only' },
  { value: 'overwrite', label: 'Overwrite' },
  { value: 'upsert', label: 'Upsert' },
  { value: 'ignore', label: 'Insert Ignore' }
];

export const RulePresetsView: React.FC = () => {
  const [presets, setPresets] = useState<RulePreset[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [rules, setRules] = useState<Record<string, MigrationRule>>({});
  const [newTableName, setNewTableName] = useState('');
  const [newTableRule, setNewTableRule] = useState<MigrationRule>('overwrite');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvName, setCsvName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPresets();
  }, []);

const loadPresets = async () => {
  setLoading(true);
  setError(null);
  try {
    const data = await api.getRulePresets();
    console.log('Presets loaded:', data); // Debug
    
    const parsedData = data.map(p => {
      let rules = p.rules;
      
      if (typeof rules === 'string') {
        try {
          rules = JSON.parse(rules);
        } catch (e) {
          console.error('Failed to parse rules for preset:', p.id, e);
          rules = {};
        }
      }
      
      if (typeof rules !== 'object' || rules === null) {
        rules = {};
      }
      
      return { ...p, rules };
    });
    
    console.log('Parsed presets:', parsedData); // Debug
    setPresets(parsedData);
  } catch (err) {
    console.error('Load presets error:', err); // Debug
    const errorMessage = err instanceof Error ? err.message : 'Failed to load presets';
    setError(errorMessage);
  } finally {
    setLoading(false);
  }
};

  const handleAddRule = () => {
    if (newTableName.trim()) {
      setRules({ ...rules, [newTableName]: newTableRule });
      setNewTableName('');
      setNewTableRule('overwrite');
    }
  };

  const handleRemoveRule = (tableName: string) => {
    const newRules = { ...rules };
    delete newRules[tableName];
    setRules(newRules);
  };

  const handleSave = async () => {
    if (!formData.name || Object.keys(rules).length === 0) {
      setError('Name and at least one rule are required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (editingId) {
        await api.updateRulePreset(editingId, { ...formData, rules });
      } else {
        await api.createRulePreset({ ...formData, rules });
      }
      await loadPresets();
      handleCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preset');
    } finally {
      setLoading(false);
    }
  };

const handleEdit = (preset: RulePreset) => {
  setEditingId(preset.id);
  setFormData({ 
    name: preset.name, 
    description: preset.description || '' 
  });
  
  const rules = typeof preset.rules === 'object' && preset.rules !== null 
    ? preset.rules 
    : {};
    
  setRules(rules);
  setShowForm(true);
};

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this preset?')) return;

    try {
      await api.deleteRulePreset(id);
      await loadPresets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete preset');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setShowImport(false);
    setEditingId(null);
    setFormData({ name: '', description: '' });
    setRules({});
    setNewTableName('');
    setCsvFile(null);
    setCsvName('');
    setError(null);
  };

  const handleImportCSV = async () => {
    if (!csvFile || !csvName) {
      setError('CSV file and preset name are required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.importRulePresetCSV(csvFile, csvName);
      await loadPresets();
      handleCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import CSV');
    } finally {
      setLoading(false);
    }
  };

  /**
  const handleExportCSV = async (id: string, name: string) => {
    try {
      const blob = await api.exportRulePresetCSV(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/\s+/g, '_')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV');
    }
  };
  */

  const handleDownloadTemplate = async () => {
    try {
      const blob = await api.downloadRulePresetTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rule_preset_template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download template');
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Rule Presets</h2>
          <p className="text-slate-600">Manage pre-defined migration rules for collections</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            CSV Template
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2"
          >
            <Upload className="w-5 h-5" />
            Import CSV
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Preset
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-700">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Lista de Presets */}
      {!showForm && !showImport && (
        <div className="grid grid-cols-1 gap-4">
          {presets.length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-slate-200">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-800 mb-2">No rule presets</h3>
              <p className="text-slate-600 mb-6">Create your first preset to get started</p>
            </div>
          ) : (
            presets.map((preset) => (
              <div key={preset.id} className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{preset.name}</h3>
                    {preset.description && (
                      <p className="text-sm text-slate-600 mt-1">{preset.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(preset)}
                      className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(preset.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-4">
                  <p className="text-sm font-medium text-slate-700 mb-3">
                    Rules ({Object.keys(preset.rules).length} tables)
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {Object.entries(preset.rules).map(([table, rule]) => (
                      <div key={table} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded text-sm">
                        <span className="font-medium text-slate-800">{table}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          rule === 'schema' ? 'bg-purple-100 text-purple-700' :
                          rule === 'overwrite' ? 'bg-red-100 text-red-700' :
                          rule === 'upsert' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {rule}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Form de Criação/Edição */}
      {showForm && (
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-xl font-bold text-slate-800 mb-4">
            {editingId ? 'Edit Preset' : 'New Preset'}
          </h3>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Preset Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Migration Rules"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Rules for production migration"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 mb-6">
            <h4 className="font-semibold text-slate-800 mb-4">Rules</h4>
            
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="Table name"
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={newTableRule}
                onChange={(e) => setNewTableRule(e.target.value as MigrationRule)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MIGRATION_RULES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <button
                onClick={handleAddRule}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {Object.keys(rules).length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {Object.entries(rules).map(([table, rule]) => (
                  <div key={table} className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-slate-800">{table}</span>
                      <span className="text-slate-600">→</span>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                        {rule}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveRule(table)}
                      className="text-red-600 hover:bg-red-50 p-1 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Saving...' : 'Save Preset'}
            </button>
            <button
              onClick={handleCancel}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Form de Import CSV */}
      {showImport && (
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Import from CSV</h3>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Preset Name *</label>
              <input
                type="text"
                value={csvName}
                onChange={(e) => setCsvName(e.target.value)}
                placeholder="Imported Rules"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">CSV File *</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-2">
                CSV format: table_name,rule (one rule per line)
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleImportCSV}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              {loading ? 'Importing...' : 'Import CSV'}
            </button>
            <button
              onClick={handleCancel}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RulePresetsView;