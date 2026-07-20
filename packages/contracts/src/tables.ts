import { z } from "zod";

import { uuidSchema } from "./common.js";

export const tableStatusSchema = z.enum(["active", "inactive"]);

export const tableSchema = z.object({
  id: uuidSchema,
  restaurantId: uuidSchema,
  tableName: z.string(),
  seats: z.number().int().positive(),
  location: z.string(),
  status: tableStatusSchema,
  isTemporary: z.boolean(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TableDto = z.infer<typeof tableSchema>;

export const createTableSchema = z.object({
  tableName: z.string().min(1, "Table name is required.").max(50),
  seats: z.number().int().positive("Seats must be at least 1."),
  location: z.string().min(1).max(50).default("Main Hall"),
  status: tableStatusSchema.default("active"),
  isTemporary: z.boolean().default(false),
});
export type CreateTableRequest = z.infer<typeof createTableSchema>;

export const updateTableSchema = createTableSchema.partial();
export type UpdateTableRequest = z.infer<typeof updateTableSchema>;

export const tableListQuerySchema = z.object({
  status: tableStatusSchema.optional(),
  location: z.string().optional(),
});
export type TableListQuery = z.infer<typeof tableListQuerySchema>;
