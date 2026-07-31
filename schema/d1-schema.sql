CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL, -- Contiene normalize(SHA-256(email)) para búsquedas únicas y rápidas
  email_encrypted TEXT NOT NULL, -- Contiene AES-GCM(email) para envíos de correos y exportación
  created_at TEXT NOT NULL
);

CREATE TABLE hogares (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL
);

CREATE TABLE inventario (
  id TEXT PRIMARY KEY,
  hogar_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  min_stock INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'Almacén',
  updated_at TEXT NOT NULL
);

CREATE TABLE events_stock (
  id TEXT PRIMARY KEY,
  hogar_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  quantity_delta INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  actor_user_id TEXT NOT NULL
);

CREATE TABLE historial_precios (
  id TEXT PRIMARY KEY,
  hogar_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UYU',
  timestamp TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  FOREIGN KEY (hogar_id) REFERENCES hogares(id)
);

CREATE INDEX idx_historial_precios_hogar ON historial_precios(hogar_id, product_name);

CREATE TABLE auditoria_legal (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  hogar_id TEXT,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  hash TEXT NOT NULL,
  signature TEXT NOT NULL
);

CREATE TABLE consumed_tokens (
  token_hash TEXT PRIMARY KEY,
  consumed_at TEXT NOT NULL
);

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  hogar_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_hogar ON push_subscriptions(hogar_id);
