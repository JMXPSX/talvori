-- ============================================================================
-- Phase 5 slice 5c — link grocery items to catalog products
-- ============================================================================
-- Adds a nullable product_id to grocery_items so a list item can be priced
-- against the retail catalog. The enforce-list trigger now also verifies the
-- linked product belongs to the same household. No RLS change.
-- ============================================================================

alter table public.grocery_items
  add column if not exists product_id uuid references public.products (id) on delete set null;
create index if not exists idx_grocery_items_product on public.grocery_items (product_id);

create or replace function public.grocery_items_enforce_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _h  uuid;
  _ph uuid;
begin
  select household_id into _h from public.grocery_lists where id = new.list_id;
  if _h is null then
    raise exception 'grocery list not found';
  end if;
  new.household_id := _h; -- household always follows the parent list

  if new.product_id is not null then
    select household_id into _ph from public.products where id = new.product_id;
    if _ph is null or _ph <> _h then
      raise exception 'product does not belong to this household';
    end if;
  end if;
  return new;
end;
$$;
