// Dokploy supplies the database as separate parts; encoding them keeps passwords with @ or : intact.
if (!process.env.DATABASE_URL) {
  const { DB_HOST, DB_PORT = "3306", DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  const missing = Object.entries({ DB_HOST, DB_USER, DB_PASSWORD, DB_NAME })
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    console.error(`Set DATABASE_URL or ${missing.join(", ")}.`);
    process.exit(1);
  }
  const auth = `${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}`;
  process.env.DATABASE_URL = `mysql://${auth}@${DB_HOST}:${DB_PORT}/${encodeURIComponent(DB_NAME)}`;
}
