import { pgTable, uuid, varchar, numeric, date, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * "users" table:
 * - You can store Clerk user data here if you wish (id, email, name, etc.).
 * - Or you can simply rely on Clerk for identity and only store user IDs that match Clerk's ID.
 */
export const users = pgTable("users", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  email: varchar("email", { length: 256 }).notNull(),
  name: varchar("name", { length: 256 }),
  // Additional user fields as needed
});

/**
 * "forms" table:
 * - References users.id with a foreign key constraint, cascading on delete.
 * - Stores the submitter's name/email (from Clerk) and the reimbursed person's info.
 * - We removed the "total" column to compute it dynamically by summing transactions.
 */
export const forms = pgTable("forms", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),

  // Link to the user who created/submitted this form
  // onDelete: "cascade" means if a user is deleted, their forms are automatically deleted too.
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),

  // The currently logged-in user's info at time of form creation:
  submitterEmail: varchar("submitter_email", { length: 256 }).notNull(),
  submitterName:  varchar("submitter_name", { length: 256 }).notNull(),

  // Person being reimbursed:
  reimbursedName:  varchar("reimbursed_name",  { length: 256 }).notNull(),
  reimbursedEmail: varchar("reimbursed_email", { length: 256 }).notNull(),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * "transactions" table:
 * - Each transaction belongs to a specific form (formId).
 * - date is stored as a DATE in the DB; user enters dd/mm/yyyy, but your code parses it.
 * - accountLine & department can be dropdowns in your UI, stored as strings here.
 * - amount is numeric(10,2) for currency.
 */
export const transactions = pgTable("transactions", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),

  // Link back to the parent form
  formId: uuid("form_id").notNull(),

  date: date("date").notNull(),
  accountLine: varchar("account_line", { length: 128 }).notNull(),
  department:  varchar("department",   { length: 128 }).notNull(),
  placeVendor: varchar("place_vendor", { length: 256 }).notNull(),
  description: text("description"),

  // US dollar amount
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
});

/**
 * "receipts" table:
 * - Up to 2 file uploads per transaction (enforce the "2 max" in your application logic).
 * - Each row references a transaction.
 * - fileType might be "image/png", "application/pdf", etc.
 */
export const receipts = pgTable("receipts", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),

  transactionId: uuid("transaction_id").notNull(),

  // The file is stored as base64 with a known MIME type
  base64Content: text("base64_content").notNull(),
  fileType:      varchar("file_type", { length: 50 }).notNull(),
});
