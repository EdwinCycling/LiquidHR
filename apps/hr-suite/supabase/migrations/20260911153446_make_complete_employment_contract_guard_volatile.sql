-- The helper is evaluated by the contract INSERT RLS policy after the parent
-- employment is created inside the same publish RPC. STABLE functions retain
-- the RPC snapshot and cannot observe that parent row; VOLATILE obtains a
-- fresh snapshot for the helper query. Authorization predicates stay intact.
alter function internal_security.can_insert_complete_employment_contract(uuid, uuid, uuid, uuid, uuid, date)
  volatile;
