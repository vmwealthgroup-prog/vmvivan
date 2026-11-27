-- Customer-care assistant conversations. Public visitors may create conversations;
-- only allowlisted admins can read them through the admin overview function.
create table if not exists customer_chat_messages (
  id text primary key,
  conversation_id text not null,
  sender_role text not null check (sender_role in ('user','assistant')),
  message text not null,
  model text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists customer_chat_conversation_idx on customer_chat_messages(conversation_id, created_at);
