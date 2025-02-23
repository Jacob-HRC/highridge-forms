import { text, singlestoreTable, bigint, timestamp, date, float, varchar, longtext } from "drizzle-orm/singlestore-core";

/**
 * "forms" table:
 * - References users.id with a foreign key constraint, cascading on delete.
 * - Stores the submitter's name/email (from Clerk) and the reimbursed person's info.
 * - We removed the "total" column to compute it dynamically by summing transactions.
 */
export const forms = singlestoreTable("highridgeforms_forms", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),

  // Link to the user who created/submitted this form
  userId: varchar("user_id", { length: 255 }).notNull(),

  formType: varchar("form_type", { length: 255 }).notNull(),

  // The currently logged-in user's info at time of form creation:
  submitterEmail: varchar("submitter_email", { length: 255 }).notNull(),
  submitterName: varchar("submitter_name", { length: 255 }).notNull(),

  // Person being reimbursed:
  reimbursedName: varchar("reimbursed_name", { length: 255 }).notNull(),
  reimbursedEmail: varchar("reimbursed_email", { length: 255 }).notNull(),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * "transactions" table:
 * - Each transaction belongs to a specific form (formId).
 * - date is stored as a DATE in the DB; user enters dd/mm/yyyy, but your code parses it.
 * - accountLine & department can be dropdowns in your UI, stored as strings here.
 * - amount is numeric(10,2) for currency.
 */
export const transactions = singlestoreTable("highridgeforms_transactions", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),

  // Link back to the parent form
  formId: bigint("form_id", { mode: "number" }).notNull(),

  date: date("date").notNull(),
  accountLine: text("account_line").notNull(),
  department: text("department").notNull(),
  placeVendor: text("place_vendor").notNull(),
  description: text("description").notNull(),

  // US dollar amount
  amount: float("amount", { precision: 10, scale: 2 }).notNull(),
});

/**
 * "receipts" table:
 * - Up to 2 file uploads per transaction (enforce the "2 max" in your application logic).
 * - Each row references a transaction.
 * - fileType might be "image/png", "application/pdf", etc.
 */
export const receipts = singlestoreTable("highridgeforms_receipts", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),

  transactionId: bigint("transaction_id", { mode: "number" }).notNull(),
  name: text("name").notNull(),

  // The file is stored as base64 with a known MIME type
  base64Content: longtext("base64_content").notNull(),
  fileType: text("file_type").notNull(),
});
