begin;

alter type public.audit_action_enum add value if not exists 'document_downloaded';
alter type public.audit_action_enum add value if not exists 'document_superseded';
alter type public.audit_action_enum add value if not exists 'notification_created';
alter type public.audit_action_enum add value if not exists 'notification_sent_push';
alter type public.audit_action_enum add value if not exists 'notification_read';

commit;
