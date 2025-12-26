import type {
  Connection,
  ConnectionFormData,
  Collection,
  Migration,
  MigrationDetails,
  MigrationExecuteRequest,
  MigrationExecuteResponse,
  Stats,
  TestConnectionResponse,
  RulePreset,
  RulePresetFormData
} from '../types';

// Get API URL from environment or use default
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Custom API Error class
 */
class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

/**
 * Handle API response and throw error if not ok
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = 'Request failed';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // If response is not JSON, use status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new ApiError(response.status, errorMessage);
  }
  return response.json();
}

/**
 * API Service object with all endpoints
 */
export const api = {
  // ==========================================
  // Connections
  // ==========================================

  /**
   * Get all database connections
   */
  async getConnections(): Promise<Connection[]> {
    const response = await fetch(`${API_BASE_URL}/connections`);
    return handleResponse<Connection[]>(response);
  },

  /**
   * Create a new database connection
   */
  async createConnection(data: ConnectionFormData): Promise<Connection> {
  const response = await fetch(`${API_BASE_URL}/connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      port: parseInt(data.port, 10),
      ssl: data.ssl || false,
      ssl_mode: data.ssl_mode || 'prefer',
      reject_unauthorized: data.reject_unauthorized || false
    })
  });
  return handleResponse<Connection>(response);
  },

  /**
   * Test a database connection without saving
   */
  async testConnection(data: ConnectionFormData): Promise<TestConnectionResponse> {
  const response = await fetch(`${API_BASE_URL}/connections/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      port: parseInt(data.port, 10),
      ssl: data.ssl || false,
      ssl_mode: data.ssl_mode || 'prefer',
      reject_unauthorized: data.reject_unauthorized || false
    })
  });
  return handleResponse<TestConnectionResponse>(response);
  },

  /**
   * Get collections (tables) from a database connection
   */
  async getCollections(connectionId: string): Promise<Collection[]> {
    const response = await fetch(`${API_BASE_URL}/connections/${connectionId}/collections`);
    return handleResponse<Collection[]>(response);
  },

  /**
   * Delete a database connection
   */
  async deleteConnection(id: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/connections/${id}`, {
      method: 'DELETE'
    });
    return handleResponse<{ message: string }>(response);
  },

  // ==========================================
  // Migrations
  // ==========================================

  /**
   * Get all migrations
   */
  async getMigrations(): Promise<Migration[]> {
    const response = await fetch(`${API_BASE_URL}/migrations`);
    return handleResponse<Migration[]>(response);
  },

  /**
   * Get a single migration by ID with logs
   */
  async getMigration(id: string): Promise<MigrationDetails> {
    const response = await fetch(`${API_BASE_URL}/migrations/${id}`);
    return handleResponse<MigrationDetails>(response);
  },

  /**
   * Execute a new migration
   */
  async executeMigration(data: MigrationExecuteRequest): Promise<MigrationExecuteResponse> {
    const response = await fetch(`${API_BASE_URL}/migrations/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse<MigrationExecuteResponse>(response);
  },

  /**
   * Rollback a completed migration
   */
  async rollbackMigration(id: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/migrations/${id}/rollback`, {
      method: 'POST'
    });
    return handleResponse<{ message: string }>(response);
  },

  // ==========================================
  // Reports
  // ==========================================

  /**
   * Get migration statistics
   */
  async getStats(): Promise<Stats> {
    const response = await fetch(`${API_BASE_URL}/reports/stats`);
    return handleResponse<Stats>(response);
  },

  /**
   * Export a migration report as JSON file
   */
  async exportReport(id: string): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/reports/${id}/export`);
    if (!response.ok) {
      throw new ApiError(response.status, 'Failed to export report');
    }
    return response.blob();
  },

  // Rule Presets
async getRulePresets(): Promise<RulePreset[]> {
  const response = await fetch(`${API_BASE_URL}/rule-presets`);
  return handleResponse<RulePreset[]>(response);
},

async getRulePreset(id: string): Promise<RulePreset> {
  const response = await fetch(`${API_BASE_URL}/rule-presets/${id}`);
  return handleResponse<RulePreset>(response);
},

async createRulePreset(data: RulePresetFormData): Promise<RulePreset> {
  const response = await fetch(`${API_BASE_URL}/rule-presets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return handleResponse<RulePreset>(response);
},

async updateRulePreset(id: string, data: Partial<RulePresetFormData>): Promise<RulePreset> {
  const response = await fetch(`${API_BASE_URL}/rule-presets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return handleResponse<RulePreset>(response);
},

async deleteRulePreset(id: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/rule-presets/${id}`, {
    method: 'DELETE'
  });
  return handleResponse<{ message: string }>(response);
},

async importRulePresetCSV(file: File, name: string, description?: string): Promise<unknown> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  if (description) formData.append('description', description);

  const response = await fetch(`${API_BASE_URL}/rule-presets/import/csv`, {
    method: 'POST',
    body: formData
  });
  return handleResponse<unknown>(response);
},

async exportRulePresetCSV(id: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/rule-presets/${id}/export/csv`);
  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to export CSV');
  }
  return response.blob();
},

async downloadRulePresetTemplate(): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/rule-presets/template/csv`);
  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to download template');
  }
  return response.blob();
},

  // ==========================================
  // Health Check
  // ==========================================

  /**
   * Check if API is healthy
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${API_BASE_URL}/health`);
    return handleResponse<{ status: string; timestamp: string }>(response);
  }
};

// Export types for use in other files
export type { ApiError };