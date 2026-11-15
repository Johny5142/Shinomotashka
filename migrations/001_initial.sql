CREATE TABLE IF NOT EXISTS admins (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS services (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  category text NOT NULL CHECK (category IN ('package', 'extra')),
  position integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name text NOT NULL,
  city text NOT NULL,
  address text NOT NULL,
  phone text NOT NULL,
  hours text NOT NULL,
  included text NOT NULL,
  reset_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL,
  service_id integer REFERENCES services(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  comment text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'progress', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  notification_status text NOT NULL DEFAULT 'pending',
  notification_error text,
  notification_attempt_at timestamptz
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  admin_id integer NOT NULL REFERENCES admins(id),
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_created_idx ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS rate_limits_expiry_idx ON rate_limits(expires_at);
