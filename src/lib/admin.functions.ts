import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';

export type AppRole = 'admin' | 'manager' | 'supervisor' | 'accountant' | 'dispatch_clerk' | 'viewer' | 'pending';

export interface AdminUserRecord {
  id: string;
  email: string;
  created_at: string;
  role: AppRole;
  last_sign_in_at?: string | null;
  display_name?: string | null;
}

const VALID_ROLES = new Set<AppRole>([
  'admin',
  'manager',
  'supervisor',
  'accountant',
  'dispatch_clerk',
  'viewer',
  'pending'
]);

export const adminListUsers = createServerFn({method: 'POST'})
  .middleware([requireSupabaseAuth])
  .handler(async ({context}) => {
    try {
      const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
      
      // Verify caller is admin
      const {data: callerRole} = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', context.userId)
        .maybeSingle();

      if (callerRole?.role !== 'admin') {
        throw new Error('Only administrators can access the user management panel');
      }

      // Fetch all users from Supabase Auth admin API
      const {data: authData, error: authError} = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 100,
      });

      if (authError) {
        console.warn('Could not list auth users via admin API:', authError.message);
      }

      // Fetch all assigned roles from user_roles table
      const {data: rolesData, error: rolesError} = await supabaseAdmin
        .from('user_roles')
        .select('*');

      if (rolesError) {
        console.warn('Could not list roles from user_roles:', rolesError.message);
      }

      const rolesMap = new Map<string, AppRole>();
      for (const r of rolesData ?? []) {
        if (VALID_ROLES.has(r.role as AppRole)) {
          rolesMap.set(r.user_id, r.role as AppRole);
        }
      }

      const users: AdminUserRecord[] = (authData?.users ?? []).map(u => {
        const assignedRole = rolesMap.get(u.id);
        const metadataRole = u.user_metadata?.['role'] as AppRole | undefined;
        const roleCandidate = assignedRole || metadataRole || 'pending';
        const role = VALID_ROLES.has(roleCandidate as AppRole) ? (roleCandidate as AppRole) : 'pending';

        return {
          id: u.id,
          email: u.email ?? 'no-email',
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          display_name: u.user_metadata?.['display_name'] || u.email?.split('@')[0],
          role,
        };
      });

      return {users, success: true};
    } catch (err: unknown) {
      console.error('adminListUsers server error:', err);
      return {users: [], success: false, error: err instanceof Error ? err.message : 'Failed to list users'};
    }
  });

export const adminHandoverRole = createServerFn({method: 'POST'})
  .middleware([requireSupabaseAuth])
  .validator((input: {targetUserId: string; role: AppRole}) => input)
  .handler(async ({data: {targetUserId, role}, context}) => {
    try {
      const {supabaseAdmin} = await import('@/integrations/supabase/client.server');

      // 1. Verify caller capability
      const {data: callerRole} = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', context.userId)
        .maybeSingle();

      if (callerRole?.role !== 'admin') {
        throw new Error('Only administrators can assign user roles');
      }

      if (!VALID_ROLES.has(role)) {
        throw new Error(`Invalid role: ${role}`);
      }

      // 2. Fetch old role for audit logging
      const {data: oldRoleRow} = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', targetUserId)
        .maybeSingle();

      const oldRole = oldRoleRow?.role || null;

      // 3. Prevent demoting the last admin
      if (oldRole === 'admin' && role !== 'admin') {
        const {count} = await supabaseAdmin
          .from('user_roles')
          .select('user_id', {count: 'exact', head: true})
          .eq('role', 'admin');

        if ((count ?? 0) <= 1) {
          throw new Error('Cannot demote the last remaining administrator.');
        }
      }

      // 4. Update user_roles
      const {error: roleError} = await supabaseAdmin
        .from('user_roles')
        .upsert(
          {user_id: targetUserId, role},
          {onConflict: 'user_id'}
        );

      if (roleError) {
        console.error('Failed to upsert user_roles:', roleError.message);
        throw new Error(roleError.message);
      }

      // 5. Audit log entry
      try {
        await supabaseAdmin.from('audit_logs').insert({
          table_name: 'user_roles',
          record_id: targetUserId,
          action: 'UPDATE',
          old_data: {role: oldRole},
          new_data: {role},
          changed_fields: {role: {old: oldRole, new: role}},
          user_id: context.userId
        });
      } catch (auditErr) {
        console.warn('Could not write audit log for role change:', auditErr);
      }

      // 6. Synchronize user metadata
      try {
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          user_metadata: {role},
        });
      } catch (updateErr) {
        console.warn('Could not update user metadata:', updateErr);
      }

      return {success: true, targetUserId, role};
    } catch (err: unknown) {
      console.error('adminHandoverRole error:', err);
      throw new Error(err instanceof Error ? err.message : 'Could not handover role');
    }
  });

export const adminRevokeRole = createServerFn({method: 'POST'})
  .middleware([requireSupabaseAuth])
  .validator((input: {targetUserId: string}) => input)
  .handler(async ({data: {targetUserId}, context}) => {
    try {
      const {supabaseAdmin} = await import('@/integrations/supabase/client.server');

      // Verify caller is admin
      const {data: callerRole} = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', context.userId)
        .maybeSingle();

      if (callerRole?.role !== 'admin') {
        throw new Error('Only administrators can revoke user roles');
      }

      // Prevent demoting last admin
      const {data: targetRoleRow} = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (targetRoleRow?.role === 'admin') {
        const {count} = await supabaseAdmin
          .from('user_roles')
          .select('user_id', {count: 'exact', head: true})
          .eq('role', 'admin');

        if ((count ?? 0) <= 1) {
          throw new Error('Cannot revoke or demote the last remaining administrator.');
        }
      }

      const {error: deleteError} = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', targetUserId);

      if (deleteError) {
        console.error('Failed to delete user role:', deleteError.message);
        throw new Error(deleteError.message);
      }

      try {
        await supabaseAdmin.from('audit_logs').insert({
          table_name: 'user_roles',
          record_id: targetUserId,
          action: 'DELETE',
          old_data: {role: targetRoleRow?.role},
          new_data: {role: 'pending'},
          changed_fields: {role: {old: targetRoleRow?.role, new: 'pending'}},
          user_id: context.userId
        });
      } catch (auditErr) {
        console.warn('Could not write audit log for role revocation:', auditErr);
      }

      try {
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          user_metadata: {role: 'pending'},
        });
      } catch (updateErr) {
        console.warn('Could not update user metadata:', updateErr);
      }

      return {success: true, targetUserId};
    } catch (err: unknown) {
      console.error('adminRevokeRole error:', err);
      throw new Error(err instanceof Error ? err.message : 'Could not revoke role');
    }
  });
