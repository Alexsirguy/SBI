import { customType } from "drizzle-orm/mysql-core";

// MariaDB's native UUID type stores 16 bytes and keeps UUIDv7 values in time order.
export const uuid = customType<{ data: string; driverData: string }>({
  dataType: () => "uuid",
});
