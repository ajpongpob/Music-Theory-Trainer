-- Allow authenticated learners to update the new structured profile fields.
-- Year level and section are deprecated and no longer editable by clients.

grant update (first_name, last_name, nickname)
on public.profiles
to authenticated;

revoke update (year_level, section)
on public.profiles
from authenticated;
