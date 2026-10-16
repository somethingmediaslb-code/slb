import { createServerFn } from '@tanstack/react-start';

export const autoConfirmUser = createServerFn({ method: 'POST' })
  .validator((input: { email?: string; userId?: string; fullName?: string }) => input)
  .handler(async ({ data: { email, userId, fullName } }) => {
    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      let targetId = userId;
      let targetEmail = email;

      if (userId) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          email_confirm: true,
        });
      }

      if (email) {
        const { data } = await supabaseAdmin.auth.admin.listUsers();
        const found = data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (found) {
          targetId = targetId || found.id;
          targetEmail = targetEmail || found.email;
          await supabaseAdmin.auth.admin.updateUserById(found.id, {
            email_confirm: true,
          });
        }
      }

      if (targetId) {
        const displayName = fullName || targetEmail?.split('@')[0] || 'User';

        // 1. Ensure public.profiles record
        try {
          await supabaseAdmin.from('profiles').upsert({
            id: targetId,
            email: targetEmail || '',
            full_name: displayName,
            display_name: displayName,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        } catch (profileErr) {
          console.warn('Could not upsert profile in autoConfirmUser:', profileErr);
        }

        // 2. Ensure user_roles record with pending verification
        try {
          const { data: existingRole } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', targetId)
            .maybeSingle();

          if (!existingRole) {
            // All new user registrations strictly start in 'pending' status awaiting administrator approval
            const initialRole = 'pending';
            await supabaseAdmin.from('user_roles').insert({
              user_id: targetId,
              role: initialRole,
              allowed_pages: []
            });

            await supabaseAdmin.auth.admin.updateUserById(targetId, {
              user_metadata: { role: initialRole, allowed_pages: [] }
            });
          } else if (existingRole.role === 'pending') {
            await supabaseAdmin.auth.admin.updateUserById(targetId, {
              user_metadata: { role: 'pending' }
            });
          }
        } catch (roleErr) {
          console.warn('Could not verify user_roles in autoConfirmUser:', roleErr);
        }

        // 3. Ping factory_data_pings to alert any logged-in admins
        try {
          await supabaseAdmin.from('factory_data_pings').insert({
            change_source: `new_user_registered:${targetId}`
          });
        } catch {}
      }

      return { success: true };
    } catch (err: unknown) {
      console.warn('Auto confirm server error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to auto-confirm' };
    }
  });

export const fetchUserRoleStatus = createServerFn({ method: 'POST' })
  .validator((input: { userId?: string }) => input)
  .handler(async ({ data: { userId } }) => {
    try {
      if (!userId) {
        return { role: 'pending', allowedPages: null, success: false };
      }
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { data: roleRow, error } = await supabaseAdmin
        .from('user_roles')
        .select('role, allowed_pages')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('fetchUserRoleStatus query warning:', error.message);
      }

      return {
        role: roleRow?.role || 'pending',
        allowedPages: (roleRow?.allowed_pages as string[] | undefined) || null,
        success: true
      };
    } catch (err: unknown) {
      console.warn('fetchUserRoleStatus error:', err);
      return { role: 'pending', allowedPages: null, success: false };
    }
  });

