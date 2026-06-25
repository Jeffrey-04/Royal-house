
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;
CREATE POLICY "Profiles readable by owner" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users insert own roles" ON public.user_roles;

CREATE OR REPLACE FUNCTION public.assign_signup_role(_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid) THEN
    RAISE EXCEPTION 'Role already assigned';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, _role);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_signup_role(app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_signup_role(app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
