export function getTemporaryProductionDatabaseUrl(variableName: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const connectionString = env[variableName];
  if (!connectionString) return undefined;

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL URL for a temporary database on 127.0.0.1`);
  }

  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (
    !["postgres:", "postgresql:"].includes(url.protocol)
    || url.hostname !== "127.0.0.1"
    || !/_(?:test|temp)$/i.test(databaseName)
    || url.search !== ""
  ) {
    throw new Error(`${variableName} must point directly to a temporary PostgreSQL database on 127.0.0.1 whose name ends in _test or _temp, without query parameters`);
  }

  const developmentConnectionString = env.WINTER_DATABASE_URL;
  if (developmentConnectionString) {
    let developmentUrl: URL | undefined;
    try {
      developmentUrl = new URL(developmentConnectionString);
    } catch {
      // An unrelated malformed development URL must not prevent use of a valid temporary database.
    }
    if (developmentUrl && identifiesSameDatabase(url, developmentUrl)) {
      throw new Error(`${variableName} must not identify the same database as WINTER_DATABASE_URL`);
    }
  }

  return connectionString;
}

export function createTemporaryProductionDatabaseResource<T>(
  variableName: string,
  factory: (connectionString: string) => T,
  env: NodeJS.ProcessEnv = process.env,
): T | undefined {
  const connectionString = getTemporaryProductionDatabaseUrl(variableName, env);
  return connectionString ? factory(connectionString) : undefined;
}

function identifiesSameDatabase(left: URL, right: URL): boolean {
  const port = (url: URL) => url.port || "5432";
  return left.hostname === right.hostname
    && port(left) === port(right)
    && decodeURIComponent(left.pathname) === decodeURIComponent(right.pathname);
}