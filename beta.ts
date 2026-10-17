import { createHash } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import type { BetaFeedbackUnavailableResponse } from "@workspace/api-zod";
import {
  GetBetaStatusResponse,
  RecordBetaSessionBody,
  RecordBetaSessionResponse,
} from "@workspace/api-zod";
import {
  betaSessionsTable,
  betaSurveyTable,
  db,
  profilesTable,
  receiptsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

const disabledFeedbackPaths = new Set([
  "/beta/feedback",
  "/beta/screenshot-upload-url",
  "/beta/survey",
]);
const feedbackUnavailableResponse: BetaFeedbackUnavailableResponse = {
  error:
    "Feedback submissions are disabled. For questions, email futurereceiptfeedback@gmail.com.",
};

router.use((req, res, next): void => {
  if (req.method === "POST" && disabledFeedbackPaths.has(req.path)) {
    res.status(410).json(feedbackUnavailableResponse);
    return;
  }
  next();
});

function requireUserId(req: Request, res: Response): string | null {
  const auth = getAuth(req);
  const userId =
    (auth.sessionClaims?.userId as string | undefined) ?? auth.userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

async function betaStatus(userId: string) {
  const [profile] = await db
    .select({
      role: profilesTable.role,
      customerId: profilesTable.customerId,
    })
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, userId))
    .limit(1);

  if (!profile) return null;

  const receiptPredicate =
    profile.role === "merchant"
      ? eq(receiptsTable.merchantUserId, userId)
      : profile.customerId
        ? eq(receiptsTable.customerId, profile.customerId)
        : null;
  const [receipt] = receiptPredicate
    ? await db
        .select({ id: receiptsTable.id })
        .from(receiptsTable)
        .where(receiptPredicate)
        .limit(1)
    : [];
  const [sessionTotal] = await db
    .select({ total: sql<number>`count(*)` })
    .from(betaSessionsTable)
    .where(eq(betaSessionsTable.clerkUserId, userId));
  const [existingSurvey] = await db
    .select({ id: betaSurveyTable.id })
    .from(betaSurveyTable)
    .where(eq(betaSurveyTable.clerkUserId, userId))
    .limit(1);

  const sessionCount = Number(sessionTotal?.total ?? 0);
  const hasReceipts = Boolean(receipt);
  return GetBetaStatusResponse.parse({
    eligible: !existingSurvey && (hasReceipts || sessionCount >= 3),
    sessionCount,
    hasReceipts,
  });
}

router.post("/beta/session", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const parsed = RecordBetaSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid app session" });
    return;
  }

  const sessionFingerprint = createHash("sha256")
    .update(parsed.data.sessionId)
    .digest("hex");
  await db
    .insert(betaSessionsTable)
    .values({ clerkUserId: userId, sessionFingerprint })
    .onConflictDoNothing({
      target: [
        betaSessionsTable.clerkUserId,
        betaSessionsTable.sessionFingerprint,
      ],
    });

  const status = await betaStatus(userId);
  if (!status) {
    res.status(404).json({ error: "Profile not completed" });
    return;
  }
  res.json(RecordBetaSessionResponse.parse(status));
});

router.get("/beta/status", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const status = await betaStatus(userId);
  if (!status) {
    res.status(404).json({ error: "Profile not completed" });
    return;
  }
  res.json(GetBetaStatusResponse.parse(status));
});

export default router;
