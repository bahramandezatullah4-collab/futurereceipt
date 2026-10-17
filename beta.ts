import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const betaFeedbackCategoryEnum = pgEnum("ecobill_beta_feedback_category", [
  "bug",
  "design",
  "suggestion",
]);

export const betaFeedbackTable = pgTable(
  "ecobill_beta_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    category: betaFeedbackCategoryEnum("category").notNull(),
    message: text("message").notNull(),
    screenshotConsent: boolean("screenshot_consent").notNull().default(false),
    screenshotPath: text("screenshot_path"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userCreatedIndex: index("ecobill_beta_feedback_user_created_idx").on(
      table.clerkUserId,
      table.createdAt,
    ),
  }),
);

export const betaSessionsTable = pgTable(
  "ecobill_beta_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    sessionFingerprint: text("session_fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userSessionUnique: unique("ecobill_beta_sessions_user_session_unique").on(
      table.clerkUserId,
      table.sessionFingerprint,
    ),
  }),
);

export const betaSurveyTable = pgTable(
  "ecobill_beta_survey_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    rating: integer("rating"),
    comment: text("comment"),
    dismissed: boolean("dismissed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const insertBetaFeedbackSchema = createInsertSchema(betaFeedbackTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBetaFeedback = z.infer<typeof insertBetaFeedbackSchema>;
export type BetaFeedback = typeof betaFeedbackTable.$inferSelect;

export const insertBetaSessionSchema = createInsertSchema(betaSessionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBetaSession = z.infer<typeof insertBetaSessionSchema>;
export type BetaSession = typeof betaSessionsTable.$inferSelect;

export const insertBetaSurveySchema = createInsertSchema(betaSurveyTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBetaSurvey = z.infer<typeof insertBetaSurveySchema>;
export type BetaSurvey = typeof betaSurveyTable.$inferSelect;
