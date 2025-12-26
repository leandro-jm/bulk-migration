export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  status?: 'active' | 'deleted';
  created_at?: string;
  updated_at?: string;
}

export interface ConnectionFormData {
  name: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

export interface Collection {
  name: string;
  description: string;
  rowCount: number;
}

export interface CollectionConfig {
  name: string;
  rule: MigrationRule;
}

export type MigrationRule = 'schema' | 'overwrite' | 'upsert' | 'ignore';

export type MigrationStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Migration {
  id: string;
  source_connection_id: string;
  target_connection_id: string;
  status: MigrationStatus;
  global_rule: MigrationRule;
  collections: string; // JSON string
  result?: string; // JSON string
  duration_ms?: number;
  error_message?: string;
  created_at: string;
  updated_at?: string;
}

export interface MigrationResult {
  collection: string;
  rule: MigrationRule;
  rowsMigrated?: number;
  status: 'success' | 'failed';
  error?: string;
}

export interface MigrationLog {
  id: string;
  migration_id: string;
  collection_name: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  metadata?: string;
  created_at: string;
}

export interface MigrationDetails extends Migration {
  logs?: MigrationLog[];
}

export interface MigrationExecuteRequest {
  sourceConnectionId: string;
  targetConnectionId: string;
  globalRule: MigrationRule;
  collections: CollectionConfig[];
}

export interface MigrationExecuteResponse {
  migrationId: string;
  message: string;
  status: MigrationStatus;
}

export interface Stats {
  total: number;
  completed: number;
  failed: number;
  running: number;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
}

export interface ApiError {
  error: string;
  message?: string;
  status?: number;
}

export interface RulePreset {
  id: string;
  name: string;
  description?: string;
  rules: Record<string, MigrationRule>;
  created_at: string;
  updated_at?: string;
}

export interface RulePresetFormData {
  name: string;
  description?: string;
  rules: Record<string, MigrationRule>;
}

export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  ssl?: boolean;
  ssl_mode?: 'disable' | 'require' | 'prefer';
  reject_unauthorized?: boolean;
  status?: 'active' | 'deleted';
  created_at?: string;
  updated_at?: string;
}

export interface ConnectionFormData {
  name: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  ssl_mode?: 'disable' | 'require' | 'prefer';
  reject_unauthorized?: boolean;
}

export type ViewType = 'dashboard' | 'connections' | 'migrations' | 'reports' | 'rule-presets';
