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
  updated_at: string;
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
