import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';

export type AppRole = 'admin' | 'manager' | 'supervisor' | 'accountant' | 'dispatch_clerk' | 'viewer' | 'user' | 'pending';

export interface AdminUserRecord {
  id: string;
  email: string;
  created_at: string;
  role: AppRole;
  allowed_pages?: string[] | null;
  last_sign_in_at?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  department?: string | null;
}

const VALID_ROLES = new Set<AppRole>([
  'admin',
  'user',
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

      // 1. Fetch all profiles from public.profiles table
      const {data: profilesData} = await supabaseAdmin
        .from('profiles')
        .select('*');

      const profilesMap = new Map<string, any>();
      for (const p of profilesData ?? []) {
        profilesMap.set(p.id, p);
      }

      // 2. Fetch all assigned roles from user_roles table
      const {data: rolesData, error: rolesError} = await supabaseAdmin
        .from('user_roles')
        .select('*');

      if (rolesError) {
        console.warn('Could not list roles from user_roles:', rolesError.message);
      }

      const rolesMap = new Map<string, { role: AppRole; allowed_pages?: string[] | null }>();
      for (const r of rolesData ?? []) {
        if (VALID_ROLES.has(r.role as AppRole)) {
          rolesMap.set(r.user_id, {
            role: r.role as AppRole,
            allowed_pages: r.allowed_pages ?? null,
          });
        }
      }

      // 3. Fetch all users from Supabase Auth admin API if available
      const {data: authData, error: authError} = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 100,
      });

      if (authError) {
        console.warn('Could not list auth users via admin API:', authError.message);
      }

      const userMap = new Map<string, AdminUserRecord>();

      // First add from auth.admin.listUsers
      for (const u of authData?.users ?? []) {
        const profile = profilesMap.get(u.id);
        const roleInfo = rolesMap.get(u.id);
        const metadataRole = u.user_metadata?.['role'] as AppRole | undefined;
        const roleCandidate = roleInfo?.role || metadataRole || 'pending';
        const role = VALID_ROLES.has(roleCandidate as AppRole) ? (roleCandidate as AppRole) : 'pending';

        userMap.set(u.id, {
          id: u.id,
          email: profile?.email || u.email || 'no-email',
          created_at: profile?.created_at || u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          display_name: profile?.display_name || profile?.full_name || u.user_metadata?.['display_name'] || u.email?.split('@')[0] || null,
          full_name: profile?.full_name || null,
          phone: profile?.phone || null,
          department: profile?.department || null,
          role,
          allowed_pages: roleInfo?.allowed_pages ?? null,
        });
      }

      // Also merge any profiles from profiles table that might not be in auth page (or if auth listing was partial)
      for (const p of profilesData ?? []) {
        if (!userMap.has(p.id)) {
          const roleInfo = rolesMap.get(p.id);
          const assignedRole = roleInfo?.role || 'pending';
          const role = VALID_ROLES.has(assignedRole as AppRole) ? (assignedRole as AppRole) : 'pending';
          userMap.set(p.id, {
            id: p.id,
            email: p.email,
            created_at: p.created_at,
            last_sign_in_at: null,
            display_name: p.display_name || p.full_name || p.email.split('@')[0] || null,
            full_name: p.full_name || null,
            phone: p.phone || null,
            department: p.department || null,
            role,
            allowed_pages: roleInfo?.allowed_pages ?? null,
          });
        }
      }

      const users: AdminUserRecord[] = Array.from(userMap.values());
      return {users, success: true};
    } catch (err: unknown) {
      console.error('adminListUsers server error:', err);
      return {users: [], success: false, error: err instanceof Error ? err.message : 'Failed to list users'};
    }
  });

export const adminHandoverRole = createServerFn({method: 'POST'})
  .middleware([requireSupabaseAuth])
  .validator((input: {targetUserId: string; role: AppRole; allowedPages?: string[]}) => input)
  .handler(async ({data: {targetUserId, role, allowedPages}, context}) => {
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
        .select('role, allowed_pages')
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
      const updatePayload: Record<string, any> = {
        user_id: targetUserId,
        role,
      };
      if (allowedPages !== undefined) {
        updatePayload['allowed_pages'] = allowedPages;
      }

      const {error: roleError} = await supabaseAdmin
        .from('user_roles')
        .upsert(
          updatePayload,
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
          new_data: {role, allowed_pages: allowedPages},
          changed_fields: {role: {old: oldRole, new: role}},
          user_id: context.userId
        });
      } catch (auditErr) {
        console.warn('Could not write audit log for role change:', auditErr);
      }

      // 6. Synchronize user metadata
      try {
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          user_metadata: {role, allowed_pages: allowedPages},
        });
      } catch (updateErr) {
        console.warn('Could not update user metadata:', updateErr);
      }

      // 7. Emit realtime ping so pending screen transitions immediately
      try {
        await supabaseAdmin.from('factory_data_pings').insert({
          change_source: `role_change:${targetUserId}:${role}`
        });
      } catch {}

      return {success: true, targetUserId, role};
    } catch (err: unknown) {
      console.error('adminHandoverRole error:', err);
      throw new Error(err instanceof Error ? err.message : 'Could not handover role');
    }
  });

export const adminUpdateUserPageAccess = createServerFn({method: 'POST'})
  .middleware([requireSupabaseAuth])
  .validator((input: {targetUserId: string; allowedPages: string[]}) => input)
  .handler(async ({data: {targetUserId, allowedPages}, context}) => {
    try {
      const {supabaseAdmin} = await import('@/integrations/supabase/client.server');

      // Verify caller is admin
      const {data: callerRole} = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', context.userId)
        .maybeSingle();

      if (callerRole?.role !== 'admin') {
        throw new Error('Only administrators can update page permissions');
      }

      const {error} = await supabaseAdmin
        .from('user_roles')
        .update({allowed_pages: allowedPages})
        .eq('user_id', targetUserId);

      if (error) throw error;

      try {
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          user_metadata: { allowed_pages: allowedPages }
        });
      } catch (metaErr) {
        console.warn('Could not sync user_metadata allowed_pages:', metaErr);
      }

      try {
        await supabaseAdmin.from('factory_data_pings').insert({
          change_source: `page_access:${targetUserId}`
        });
      } catch {}

      return {success: true, targetUserId, allowedPages};
    } catch (err: unknown) {
      console.error('adminUpdateUserPageAccess error:', err);
      throw new Error(err instanceof Error ? err.message : 'Could not update page access');
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

      // Set role back to pending in user_roles table so data persists
      const {error: updateError} = await supabaseAdmin
        .from('user_roles')
        .upsert(
          {user_id: targetUserId, role: 'pending'},
          {onConflict: 'user_id'}
        );

      if (updateError) {
        console.error('Failed to set user role to pending:', updateError.message);
        throw new Error(updateError.message);
      }

      try {
        await supabaseAdmin.from('audit_logs').insert({
          table_name: 'user_roles',
          record_id: targetUserId,
          action: 'UPDATE',
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

      // Emit realtime ping
      try {
        await supabaseAdmin.from('factory_data_pings').insert({
          change_source: `role_revoked:${targetUserId}`
        });
      } catch {}

      return {success: true, targetUserId};
    } catch (err: unknown) {
      console.error('adminRevokeRole error:', err);
      throw new Error(err instanceof Error ? err.message : 'Could not revoke role');
    }
  });

export const adminDeleteOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((input: { orderId: string; force?: boolean }) => input)
  .handler(async ({ data, context }) => {
    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

      // Verify caller is admin
      const { data: callerRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', context.userId)
        .maybeSingle();

      if (callerRole?.role !== 'admin') {
        throw new Error('Only administrators can delete orders');
      }

      const { data: ord } = await supabaseAdmin
        .from('orders')
        .select('id, order_no, status')
        .eq('id', data.orderId)
        .maybeSingle();

      if (!ord) {
        throw new Error('Order not found');
      }

      // Check for dispatched challans
      const { data: dispatchedChallans } = await supabaseAdmin
        .from('delivery_challans')
        .select('id, challan_number')
        .eq('order_id', data.orderId)
        .eq('status', 'Dispatched');

      if (dispatchedChallans && dispatchedChallans.length > 0) {
        throw new Error(
          `Cannot delete order ${ord.order_no}: ${dispatchedChallans.length} delivery challan(s) have already been dispatched. Close the order short instead.`
        );
      }

      // Check for logged allocations if not force
      if (!data.force) {
        const { data: orderItems } = await supabaseAdmin
          .from('order_items')
          .select('id')
          .eq('order_id', data.orderId);

        const itemIds = (orderItems ?? []).map(i => i.id);
        if (itemIds.length > 0) {
          const { data: loggedAllocations } = await supabaseAdmin
            .from('production_allocations')
            .select('id, completed_qty')
            .in('order_item_id', itemIds)
            .gt('completed_qty', 0);

          if (loggedAllocations && loggedAllocations.length > 0) {
            throw new Error(
              `Cannot delete order ${ord.order_no}: manufacturing work has already been logged. Please close the order short.`
            );
          }
        }
      }

      // Clean up draft challans and items
      const { data: challans } = await supabaseAdmin
        .from('delivery_challans')
        .select('id')
        .eq('order_id', data.orderId);

      const challanIds = (challans ?? []).map(c => c.id);
      if (challanIds.length > 0) {
        await supabaseAdmin.from('challan_items').delete().in('challan_id', challanIds);
        await supabaseAdmin.from('delivery_challans').delete().eq('order_id', data.orderId);
      }

      // Clean up allocations
      const { data: items } = await supabaseAdmin
        .from('order_items')
        .select('id')
        .eq('order_id', data.orderId);

      const itemIds = (items ?? []).map(i => i.id);
      if (itemIds.length > 0) {
        await supabaseAdmin.from('production_allocations').delete().in('order_item_id', itemIds);
      }

      // Delete order items
      await supabaseAdmin.from('order_items').delete().eq('order_id', data.orderId);

      // Delete order
      const { error: delErr } = await supabaseAdmin.from('orders').delete().eq('id', data.orderId);
      if (delErr) throw delErr;

      // Realtime ping
      try {
        await (supabaseAdmin.from as any)('factory_data_pings').insert({
          table_name: 'orders',
          change_source: `order_deleted:${data.orderId}`
        });
      } catch {}

      return { success: true, orderNo: ord.order_no };
    } catch (err: unknown) {
      console.error('adminDeleteOrder error:', err);
      throw new Error(err instanceof Error ? err.message : 'Could not delete order');
    }
  });

export const adminUpdateOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((input: {
    orderId: string;
    partyId?: string | null;
    isSelfStock?: boolean;
    orderDate?: string;
    expectedDate?: string;
    medium?: string;
    remarks?: string;
    items?: Array<{
      id?: string;
      box_type: string;
      code_remarks?: string;
      size_dimensions: string;
      specification?: string;
      ordered_qty: number;
      unit_rate: number;
      priority_signal?: string;
    }>;
  }) => input)
  .handler(async ({ data, context }) => {
    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

      // Verify caller is admin or manager
      const { data: callerRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', context.userId)
        .maybeSingle();

      if (callerRole?.role !== 'admin' && callerRole?.role !== 'manager') {
        throw new Error('Only administrators and managers can edit orders');
      }

      const { data: existingOrder } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', data.orderId)
        .maybeSingle();

      if (!existingOrder) {
        throw new Error('Order not found');
      }

      // Update orders table
      const orderUpdate: Record<string, unknown> = {};
      if (data.partyId !== undefined) orderUpdate['party_id'] = data.isSelfStock ? null : data.partyId;
      if (data.isSelfStock !== undefined) orderUpdate['is_self_stock'] = data.isSelfStock;
      if (data.orderDate) orderUpdate['order_date'] = data.orderDate;
      if (data.expectedDate) orderUpdate['expected_date'] = data.expectedDate;
      if (data.medium) orderUpdate['medium'] = data.medium;
      if (data.remarks !== undefined) orderUpdate['remarks'] = data.remarks;

      if (Object.keys(orderUpdate).length > 0) {
        const { error: ordErr } = await (supabaseAdmin.from as any)('orders')
          .update(orderUpdate)
          .eq('id', data.orderId);
        if (ordErr) throw ordErr;
      }

      // Update or insert items if provided
      if (data.items && data.items.length > 0) {
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          if (!item) continue;
          if (item.id) {
            await (supabaseAdmin.from as any)('order_items')
              .update({
                sr_no: i + 1,
                box_type: item.box_type,
                code_remarks: item.code_remarks ?? '',
                size_dimensions: item.size_dimensions,
                specification: item.specification ?? '',
                ordered_qty: item.ordered_qty,
                unit_rate: item.unit_rate,
                priority_signal: item.priority_signal ?? 'Yellow'
              })
              .eq('id', item.id);
          } else {
            await (supabaseAdmin.from as any)('order_items')
              .insert({
                order_id: data.orderId,
                sr_no: i + 1,
                box_type: item.box_type,
                code_remarks: item.code_remarks ?? '',
                size_dimensions: item.size_dimensions,
                specification: item.specification ?? '',
                ordered_qty: item.ordered_qty,
                unit_rate: item.unit_rate,
                priority_signal: item.priority_signal ?? 'Yellow'
              });
          }
        }
      }

      // Realtime ping
      try {
        await (supabaseAdmin.from as any)('factory_data_pings').insert({
          table_name: 'orders',
          change_source: `order_updated:${data.orderId}`
        });
      } catch {}

      return { success: true, orderId: data.orderId };
    } catch (err: unknown) {
      console.error('adminUpdateOrder error:', err);
      throw new Error(err instanceof Error ? err.message : 'Could not update order');
    }
  });

