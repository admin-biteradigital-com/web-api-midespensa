export interface DBUser {
  id: string;
  email: string; // SHA-256 hash
  email_encrypted: string; // AES-GCM encrypted
  created_at: string;
}

export interface DBHogar {
  id: string;
  name: string;
  owner_id: string;
}

export interface DBInventario {
  id: string;
  hogar_id: string;
  product_name: string;
  quantity: number;
  min_stock?: number;
  category?: string;
  updated_at: string;
}

export interface DBHistorialPrecio {
  id: string;
  hogar_id: string;
  product_name: string;
  price: number;
  currency: string;
  timestamp: string;
  actor_user_id: string;
}

export interface DBEventStock {
  id: string;
  hogar_id: string;
  product_id: string;
  event_type: "ADD" | "REMOVE" | "ADJUST";
  quantity_delta: number;
  timestamp: string;
  actor_user_id: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  hogarId: string | null;
  exp: number;
}
