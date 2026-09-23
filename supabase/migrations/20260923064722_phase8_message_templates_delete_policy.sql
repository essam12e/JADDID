-- Phase 8: renewals + reminders + WhatsApp templates.
--
-- The renew_subscription RPC and the renewals audit trail already exist
-- (Phase 7). What's missing for message_templates is a delete policy --
-- the baseline schema only granted select/insert/update, so a merchant
-- could create and edit templates but never remove one they no longer
-- want. There is nothing else in the schema that references
-- message_templates.id (no foreign keys point at it), so deleting one
-- is safe and doesn't orphan anything.
create policy message_templates_delete on public.message_templates
  for delete using (private.is_org_member(organization_id));
