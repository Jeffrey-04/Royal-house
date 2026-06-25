-- Migration 20260617093128 revoked has_role() from authenticated without re-granting.
-- Every RLS policy that calls has_role() throws a permission error for authenticated users,
-- causing 403 on ALL queries against tables with such policies (orders, etc.).
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
