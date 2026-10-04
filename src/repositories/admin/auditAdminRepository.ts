import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  AdminAuditLog,
  mapAuditLogRowsToModels,
  AuditLogRow,
} from './auditAdminMapper';

export interface AuditLogFilters {
  entityType?: string;
  actionType?: string;
  adminId?: string;
  limit?: number;
  offset?: number;
}

export const auditAdminRepository = {
  /**
   * Retrieves paginated admin audit logs with filtering by entity or action type.
   */
  async getAuditLogs(filters?: AuditLogFilters): Promise<AdminAuditLog[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase.rpc('admin_audit_logs_for_admin', {
      p_entity_type: filters?.entityType ?? null,
      p_action_type: filters?.actionType ?? null,
      p_admin_id: filters?.adminId ?? null,
      p_limit: filters?.limit ?? null,
      p_offset: filters?.offset ?? 0,
    });
    if (error) {
      console.error('[auditAdminRepository.getAuditLogs] Error:', error);
      throw error;
    }

    return mapAuditLogRowsToModels((data || []) as AuditLogRow[]);
  },
};
