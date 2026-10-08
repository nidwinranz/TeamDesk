-- AuditLog is append-only. The Prisma tenant guard blocks UPDATE/DELETE in the
-- app; this trigger enforces the same rule for anything that bypasses Prisma.
-- (TRUNCATE is still allowed so test/demo resets can wipe the table.)
CREATE OR REPLACE FUNCTION audit_log_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only (% rejected)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_reject_mutation();
