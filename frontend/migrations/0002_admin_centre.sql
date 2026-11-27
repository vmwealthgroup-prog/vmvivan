-- VMVIRA admin centre: access requests, contact inbox, site settings and audit log.
create table if not exists admin_access_requests (
  id text primary key,
  email text not null,
  book text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  unique (email)
);
create index if not exists admin_access_requests_status_idx on admin_access_requests(status, created_at desc);

create table if not exists admin_messages (
  id text primary key,
  sender_name text not null default '',
  sender_email text not null,
  subject text not null default 'Website enquiry',
  body text not null,
  status text not null default 'unread' check (status in ('unread','read','archived')),
  created_at timestamptz not null default now(),
  admin_note text not null default ''
);
create index if not exists admin_messages_status_idx on admin_messages(status, created_at desc);

create table if not exists site_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now(),
  updated_by text not null
);

create table if not exists admin_audit_log (
  id text primary key,
  admin_email text not null,
  action text not null,
  target_type text not null,
  target_id text not null default '',
  details text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on admin_audit_log(created_at desc);
