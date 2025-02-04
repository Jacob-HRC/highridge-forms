import { int, text, singlestoreTable, bigint, timestamp, date, float } from "drizzle-orm/singlestore-core";
import { sql } from "drizzle-orm";

/**
 * "users" table:
 * - You can store Clerk user data here if you wish (id, email, name, etc.).
 * - Or you can simply rely on Clerk for identity and only store user IDs that match Clerk's ID.
 */
export const users = singlestoreTable("users", {
  id: int("id").primaryKey().autoincrement(),
  email: text("email").notNull(),
  name: text("name"),
  // Additional user fields as needed
});

/**
 * "forms" table:
 * - References users.id with a foreign key constraint, cascading on delete.
 * - Stores the submitter's name/email (from Clerk) and the reimbursed person's info.
 * - We removed the "total" column to compute it dynamically by summing transactions.
 */
export const forms = singlestoreTable("forms", {
  id: int("id").primaryKey().autoincrement(),

  // Link to the user who created/submitted this form
  // onDelete: "cascade" means if a user is deleted, their forms are automatically deleted too.
  userId: int("user_id")
    .notNull(),

  // The currently logged-in user's info at time of form creation:
  submitterEmail: text("submitter_email").notNull(),
  submitterName:  text("submitter_name").notNull(),

  // Person being reimbursed:
  reimbursedName:  text("reimbursed_name").notNull(),
  reimbursedEmail: text("reimbursed_email").notNull(),

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
export const transactions = singlestoreTable("transactions", {
  id: int("id").primaryKey().autoincrement(),

  // Link back to the parent form
  formId: int("form_id").notNull(),

  date: date("date").notNull(),
  accountLine: text("account_line").notNull(),
  department:  text("department").notNull(),
  placeVendor: text("place_vendor").notNull(),
  description: text("description"),

  // US dollar amount
  amount: float("amount", { precision: 10, scale: 2 }).notNull(),
});

/**
 * "receipts" table:
 * - Up to 2 file uploads per transaction (enforce the "2 max" in your application logic).
 * - Each row references a transaction.
 * - fileType might be "image/png", "application/pdf", etc.
 */
export const receipts = singlestoreTable("receipts", {
  id: int("id").primaryKey().autoincrement(),

  transactionId: int("transaction_id").notNull(),

  // The file is stored as base64 with a known MIME type
  base64Content: text("base64_content").notNull(),
  fileType:      text("file_type").notNull(),
});
