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
