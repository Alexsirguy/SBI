import { customType } from "drizzle-orm/mysql-core";

// MariaDB's JSON is a LONGTEXT alias, so the driver returns strings rather than objects.
export const jsonDocument = customType<{ data: unknown; driverData: string }>({
  dataType: () => "json",
  toDriver: (value) => JSON.stringify(value),
  fromDriver: (value) => (typeof value === "string" ? JSON.parse(value) : value),
});
