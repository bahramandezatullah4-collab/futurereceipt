import {
  jsonb,
  boolean,
  date,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profileRoleEnum = pgEnum("profile_role", ["customer", "merchant"]);

export const profilesTable = pgTable("ecobill_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  role: profileRoleEnum("role").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  monthlyBudget: numeric("monthly_budget", { precision: 12, scale: 2 }),
  weeklyEmailReport: boolean("weekly_email_report").notNull().default(false),
  treeHealthNotifications: boolean("tree_health_notifications").notNull().default(false),
  privacyMode: text("privacy_mode").notNull().default("private"),
  customerId: text("customer_id").unique(),
  inviteCode: text("invite_code").unique(),
  referredByInviteCode: text("referred_by_invite_code"),
  businessName: text("business_name"),
  storeNumber: text("store_number"),
  managerName: text("manager_name"),
  merchantCategory: text("merchant_category"),
  businessEin: text("business_ein"),
  businessAddress: text("business_address"),
  salesTaxId: text("sales_tax_id"),
  operatorNumber: text("operator_number"),
  terminalNumber: text("terminal_number"),
  transactionNumber: text("transaction_number"),
  tcCode: text("tc_code"),
  taxRate: numeric("tax_rate", { precision: 7, scale: 3 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ReceiptItem = {
  name: string;
  quantity: number;
  price: number;
  barcode?: string | null;
  taxClass?: string | null;
};

export const receiptsTable = pgTable("ecobill_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantUserId: text("merchant_user_id").notNull(),
  customerId: text("customer_id"),
  discoverySource: text("discovery_source"),
  merchantCategory: text("merchant_category"),
  merchantName: text("merchant_name").notNull(),
  merchantAddress: text("merchant_address").notNull(),
  items: jsonb("items").$type<ReceiptItem[]>().notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 12, scale: 2 }).notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  verificationCode: text("verification_code").notNull().unique(),
  paperSavedGrams: numeric("paper_saved_grams", {
    precision: 8,
    scale: 2,
  })
    .notNull()
    .default("2.50"),
  paperReceiptRequested: boolean("paper_receipt_requested").notNull().default(false),
  purchasedAt: timestamp("purchased_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  storeNumber: text("store_number"),
  managerName: text("manager_name"),
  merchantPhone: text("merchant_phone"),
  operatorNumber: text("operator_number"),
  terminalNumber: text("terminal_number"),
  transactionNumber: text("transaction_number"),
  tcCode: text("tc_code"),
  taxRate: numeric("tax_rate", { precision: 7, scale: 3 }),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }),
  changeDue: numeric("change_due", { precision: 12, scale: 2 }),
  paymentMethod: text("payment_method"),
  maskedCard: text("masked_card"),
  paymentReferenceNumber: text("payment_reference_number"),
  networkId: text("network_id"),
  approvalCode: text("approval_code"),
  aid: text("aid"),
  applicationCryptogram: text("application_cryptogram"),
  paymentTerminalId: text("payment_terminal_id"),
});

export const dailyActivityTable = pgTable(
  "ecobill_daily_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    activityDate: date("activity_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clerkUserDateUnique: unique("ecobill_daily_activity_user_date_unique").on(
      table.clerkUserId,
      table.activityDate,
    ),
  }),
);

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReceiptSchema = createInsertSchema(receiptsTable).omit({
  id: true,
  purchasedAt: true,
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receiptsTable.$inferSelect;
export const insertDailyActivitySchema = createInsertSchema(dailyActivityTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDailyActivity = z.infer<typeof insertDailyActivitySchema>;
export type DailyActivity = typeof dailyActivityTable.$inferSelect;