alter table public.products
  add column if not exists "categoryId" text,
  add column if not exists "categoryPath" text,
  add column if not exists "ebayCategoryId" text,
  add column if not exists "ebayCategoryBreadcrumb" text;
