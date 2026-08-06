begin;

-- Keep the repository pgTAP contract tests runnable on the linked test project.
create extension if not exists pgtap with schema extensions;

commit;
