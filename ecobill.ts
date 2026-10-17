import { randomBytes } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import {
  ClaimReceiptBody,
  ClaimReceiptResponse,
  CheckInEcoStreakResponse,
  CreateReceiptBody,
  CreateReceiptResponse,
  DeleteAccountResponse,
  DeleteReceiptResponse,
  GetAnalyticsSummaryResponse,
  GetImpactSummaryResponse,
  GetMerchantOverviewResponse,
  GetProfileResponse,
  GetReceiptParams,
  GetReceiptResponse,
  ListReceiptsResponse,
  SaveProfileBody,
  SaveProfileResponse,
} from "@workspace/api-zod";
import {
  betaFeedbackTable,
  betaSessionsTable,
  betaSurveyTable,
  db,
  dailyActivityTable,
  profilesTable,
  receiptsTable,
  type ReceiptItem,
} from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { deleteBetaScreenshot } from "../lib/beta-screenshots";

const router: IRouter = Router();

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

function toNumber(value: string | null | undefined): number {
  return Number(value ?? 0);
}

function isCardPaymentRecord(
  receipt: Pick<
    typeof receiptsTable.$inferSelect,
    | "paymentMethod"
    | "maskedCard"
    | "paymentReferenceNumber"
    | "networkId"
    | "approvalCode"
    | "aid"
    | "applicationCryptogram"
    | "paymentTerminalId"
  >,
): boolean {
  return Boolean(
    receipt.maskedCard ||
      receipt.paymentReferenceNumber ||
      receipt.networkId ||
      receipt.approvalCode ||
      receipt.aid ||
      receipt.applicationCryptogram ||
      receipt.paymentTerminalId ||
      /card|debit|credit|visa|mastercard|amex|discover/i.test(
        receipt.paymentMethod ?? "",
      ),
  );
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function ecobillId(profile: typeof profilesTable.$inferSelect): string {
  return profile.role === "customer" && profile.customerId
    ? profile.customerId
    : profile.storeNumber
      ? `MER-USA-${profile.storeNumber.toUpperCase()}`
      : `MER-${profile.id.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}`;
}

function presentReceipt(receipt: typeof receiptsTable.$inferSelect) {
  return {
    id: receipt.id,
    customerId: receipt.customerId,
    discoverySource: receipt.discoverySource,
    merchantName: receipt.merchantName,
    merchantCategory: receipt.merchantCategory,
    merchantAddress: receipt.merchantAddress,
    purchasedAt: receipt.purchasedAt.toISOString(),
    subtotal: toNumber(receipt.subtotal),
    tax: toNumber(receipt.tax),
    total: toNumber(receipt.total),
    items: receipt.items,
    verificationCode: receipt.verificationCode,
    paperSavedGrams: toNumber(receipt.paperSavedGrams),
    paperReceiptRequested: receipt.paperReceiptRequested,
    storeNumber: receipt.storeNumber,
    managerName: receipt.managerName,
    merchantPhone: receipt.merchantPhone,
    operatorNumber: receipt.operatorNumber,
    terminalNumber: receipt.terminalNumber,
    transactionNumber: receipt.transactionNumber,
    tcCode: receipt.tcCode,
    taxRate: receipt.taxRate == null ? null : toNumber(receipt.taxRate),
    amountPaid: receipt.amountPaid == null ? null : toNumber(receipt.amountPaid),
    changeDue: receipt.changeDue == null ? null : toNumber(receipt.changeDue),
    paymentMethod: receipt.paymentMethod,
    maskedCard: receipt.maskedCard,
    paymentReferenceNumber: receipt.paymentReferenceNumber,
    networkId: receipt.networkId,
    approvalCode: receipt.approvalCode,
    aid: receipt.aid,
    applicationCryptogram: receipt.applicationCryptogram,
    paymentTerminalId: receipt.paymentTerminalId,
  };
}

function createVerificationCode(): string {
  return `ECO-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function createInviteCode(): string {
  return `ECB-${randomBytes(4).toString("hex").toUpperCase()}`;
}

type EcoStreakStatus = {
  currentStreak: number;
  longestStreak: number;
  checkedInToday: boolean;
  ecoBoostActive: boolean;
  growthMultiplier: number;
  nextRewardAt: number;
};

function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function previousUtcDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return utcDate(value);
}

function streakStatus(
  activeDates: Set<string>,
  checkedInToday: boolean,
  today: string,
): EcoStreakStatus {
  const dates = [...activeDates].sort();
  let longestStreak = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of dates) {
    if (
      previous &&
      date ===
        utcDate(
          new Date(
            new Date(`${previous}T00:00:00.000Z`).getTime() + 86_400_000,
          ),
        )
    ) {
      run += 1;
    } else {
      run = 1;
    }
    longestStreak = Math.max(longestStreak, run);
    previous = date;
  }

  let currentStreak = 0;
  let cursor = activeDates.has(today) ? today : previousUtcDate(today);
  if (activeDates.has(cursor)) {
    while (activeDates.has(cursor)) {
      currentStreak += 1;
      cursor = previousUtcDate(cursor);
    }
  }
  const ecoBoostActive = currentStreak >= 7;
  return {
    currentStreak,
    longestStreak,
    checkedInToday,
    ecoBoostActive,
    growthMultiplier: ecoBoostActive ? 2 : 1,
    nextRewardAt: ecoBoostActive ? Math.ceil((currentStreak + 1) / 7) * 7 : 7,
  };
}

async function getCustomerStreak(userId: string, profile: typeof profilesTable.$inferSelect | undefined) {
  const today = utcDate(new Date());
  if (!profile?.customerId) {
    return streakStatus(new Set(), false, today);
  }
  const [receipts, activities] = await Promise.all([
    db
      .select({ purchasedAt: receiptsTable.purchasedAt })
      .from(receiptsTable)
      .where(
        and(
          eq(receiptsTable.customerId, profile.customerId),
          eq(receiptsTable.paperReceiptRequested, false),
        ),
      ),
    db.select().from(dailyActivityTable).where(eq(dailyActivityTable.clerkUserId, userId)),
  ]);
  const activeDates = new Set(receipts.map((row) => utcDate(row.purchasedAt)));
  for (const activity of activities) activeDates.add(activity.activityDate);
  return streakStatus(activeDates, activities.some((row) => row.activityDate === today), today);
}

function categorizeReceiptItem(item: ReceiptItem): string {
  const text = `${item.name} ${item.taxClass ?? ""}`.toLowerCase();
  const matches = (terms: string[]) => terms.some((term) => text.includes(term));

  if (matches(["coffee", "cafe", "latte", "espresso", "tea", "sandwich", "salad", "burger", "pizza", "restaurant", "deli"])) {
    return "Dining & Cafe";
  }
  if (matches(["candy", "chocolate", "cookie", "snack", "chips", "soda", "coke", "pepsi", "corn dog", "sweet", "dessert", "ice cream"])) {
    return "Snacks & Sweets";
  }
  if (matches(["phone", "charger", "cable", "headphone", "electronics", "gadget", "computer", "tablet", "case", "clothing", "shirt", "shoe", "home"])) {
    return "Shopping & Gadgets";
  }
  if (matches(["grocery", "groceries", "milk", "bread", "egg", "fruit", "vegetable", "produce", "meat", "chicken", "rice", "pasta", "water", "market"])) {
    return "Groceries";
  }
  return "Other";
}

router.get("/profile", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  let [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, userId))
    .limit(1);

  if (!profile) {
    const requestedRole = req.get("x-ecobill-account-role");
    if (requestedRole !== "customer" && requestedRole !== "merchant") {
      return res.status(404).json({ error: "Profile not completed" });
    }
    const clerkUser = await clerkClient.users.getUser(userId);
    const email =
      clerkUser.emailAddresses.find(
        (address) => address.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      "";
    if (!email) {
      return res.status(400).json({ error: "A verified email address is required" });
    }
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      email.split("@")[0] ||
      "ECOBILL User";
    const inviteCode = createInviteCode();
    const requestedReferral = req.get("x-ecobill-referral-code")?.toUpperCase();
    let referredByInviteCode: string | null = null;
    if (
      requestedRole === "customer" &&
      requestedReferral &&
      /^ECB-[A-F0-9]{8}$/.test(requestedReferral)
    ) {
      const [referrer] = await db
        .select({ clerkUserId: profilesTable.clerkUserId })
        .from(profilesTable)
        .where(eq(profilesTable.inviteCode, requestedReferral))
        .limit(1);
      if (referrer?.clerkUserId !== userId) {
        referredByInviteCode = referrer ? requestedReferral : null;
      }
    }
    [profile] = await db
      .insert(profilesTable)
      .values({
        clerkUserId: userId,
        role: requestedRole,
        name,
        email,
        customerId:
          requestedRole === "customer"
            ? `CUS-${randomBytes(4).toString("hex").toUpperCase()}`
            : null,
        inviteCode,
        referredByInviteCode,
      })
      .onConflictDoNothing({ target: profilesTable.clerkUserId })
      .returning();
    if (!profile) {
      [profile] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.clerkUserId, userId))
        .limit(1);
    }
    if (!profile) {
      return res.status(500).json({ error: "Profile could not be created" });
    }
  }
  const inviteCode = profile.inviteCode ?? createInviteCode();
  if (!profile.inviteCode) {
    await db
      .update(profilesTable)
      .set({ inviteCode })
      .where(eq(profilesTable.id, profile.id));
  }
  const [referralSummary] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(profilesTable)
    .where(eq(profilesTable.referredByInviteCode, inviteCode));

  return res.json(
    GetProfileResponse.parse({
      id: profile.id,
      role: profile.role,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      monthlyBudget: profile.monthlyBudget == null ? null : toNumber(profile.monthlyBudget),
      weeklyEmailReport: profile.weeklyEmailReport,
      treeHealthNotifications: profile.treeHealthNotifications,
      privacyMode: profile.privacyMode,
      customerId: profile.customerId,
      ecobillId: ecobillId(profile),
      inviteCode,
      referralCount: referralSummary?.count ?? 0,
      businessName: profile.businessName,
      storeNumber: profile.storeNumber,
      managerName: profile.managerName,
      merchantCategory: profile.merchantCategory,
      businessEin: profile.businessEin,
      businessAddress: profile.businessAddress,
      salesTaxId: profile.salesTaxId,
      operatorNumber: profile.operatorNumber,
      terminalNumber: profile.terminalNumber,
      transactionNumber: profile.transactionNumber,
      tcCode: profile.tcCode,
      taxRate: profile.taxRate == null ? null : toNumber(profile.taxRate),
      createdAt: profile.createdAt.toISOString(),
    }),
  );
});

router.post("/profile", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const input = SaveProfileBody.parse(req.body);
  const [existingProfile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, userId))
    .limit(1);
  let profileName = input.name?.trim() || existingProfile?.name || "";
  let profileEmail = input.email?.trim() || existingProfile?.email || "";
  if (!profileName || !profileEmail) {
    const clerkUser = await clerkClient.users.getUser(userId);
    profileEmail =
      profileEmail ||
      clerkUser.emailAddresses.find(
        (address) => address.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ||
      clerkUser.emailAddresses[0]?.emailAddress ||
      "";
    profileName =
      profileName ||
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      profileEmail.split("@")[0] ||
      "ECOBILL User";
  }
  if (!profileEmail) {
    res.status(400).json({ error: "A verified email address is required" });
    return;
  }
  const customerId =
    input.role === "customer"
      ? (existingProfile?.customerId ??
        `CUS-${randomBytes(4).toString("hex").toUpperCase()}`)
      : null;
  const inviteCode = existingProfile?.inviteCode ?? createInviteCode();
  let referredByInviteCode = existingProfile?.referredByInviteCode ?? null;
  if (
    !existingProfile &&
    input.role === "customer" &&
    input.referredByInviteCode
  ) {
    const normalizedCode = input.referredByInviteCode.trim().toUpperCase();
    const [referrer] = await db
      .select({ clerkUserId: profilesTable.clerkUserId })
      .from(profilesTable)
      .where(eq(profilesTable.inviteCode, normalizedCode))
      .limit(1);
    if (referrer && referrer.clerkUserId !== userId) {
      referredByInviteCode = normalizedCode;
    }
  }

  const [profile] = await db
    .insert(profilesTable)
    .values({
      clerkUserId: userId,
      role: input.role,
      name: profileName,
      email: profileEmail,
      phone: input.phone ?? null,
      monthlyBudget: input.monthlyBudget == null ? null : String(input.monthlyBudget),
      weeklyEmailReport: input.weeklyEmailReport ?? false,
      treeHealthNotifications: input.treeHealthNotifications ?? false,
      privacyMode: input.privacyMode ?? "private",
      customerId,
      inviteCode,
      referredByInviteCode,
      businessName: input.businessName ?? null,
      storeNumber: input.storeNumber ?? null,
      managerName: input.managerName ?? null,
      merchantCategory: input.merchantCategory ?? null,
      businessEin: input.businessEin ?? null,
      businessAddress: input.businessAddress ?? null,
      salesTaxId: input.salesTaxId ?? null,
      operatorNumber: input.operatorNumber ?? null,
      terminalNumber: input.terminalNumber ?? null,
      transactionNumber: input.transactionNumber ?? null,
      tcCode: input.tcCode ?? null,
      taxRate: input.taxRate == null ? null : input.taxRate.toFixed(3),
    })
    .onConflictDoUpdate({
      target: profilesTable.clerkUserId,
      set: {
        role: input.role,
        name: profileName,
        email: profileEmail,
        phone: input.phone ?? null,
        monthlyBudget: input.monthlyBudget == null ? null : String(input.monthlyBudget),
        weeklyEmailReport: input.weeklyEmailReport ?? false,
        treeHealthNotifications: input.treeHealthNotifications ?? false,
        privacyMode: input.privacyMode ?? "private",
        customerId,
        inviteCode,
        businessName: input.businessName ?? null,
        storeNumber: input.storeNumber ?? null,
        managerName: input.managerName ?? null,
        merchantCategory: input.merchantCategory ?? null,
        businessEin: input.businessEin ?? null,
        businessAddress: input.businessAddress ?? null,
        salesTaxId: input.salesTaxId ?? null,
        operatorNumber: input.operatorNumber ?? null,
        terminalNumber: input.terminalNumber ?? null,
        transactionNumber: input.transactionNumber ?? null,
        tcCode: input.tcCode ?? null,
        taxRate: input.taxRate == null ? null : input.taxRate.toFixed(3),
      },
    })
    .returning();

  if (profile.role === "customer" && profile.customerId) {
    const [receiptCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(receiptsTable)
      .where(eq(receiptsTable.customerId, profile.customerId));

    if ((receiptCount?.count ?? 0) === 0) {
      await db.insert(receiptsTable).values([
        {
          merchantUserId: "ecobill-demo-merchant",
          customerId: profile.customerId,
          merchantName: "Harbor Coffee",
          merchantAddress: "88 Atlantic Ave, Brooklyn, NY",
          items: [{ name: "Organic green tea", quantity: 1, price: 4.75 }],
          subtotal: "4.75",
          tax: "0.42",
          total: "5.17",
          verificationCode: createVerificationCode(),
       paperSavedGrams: "2.50",
          purchasedAt: new Date(),
        },
        {
          merchantUserId: "ecobill-demo-merchant",
          customerId: profile.customerId,
          merchantName: "Fresh Corner Market",
          merchantAddress: "214 Bedford Ave, Brooklyn, NY",
          items: [
            { name: "Groceries", quantity: 1, price: 27.4 },
            { name: "Reusable bag", quantity: 1, price: 1.5 },
          ],
          subtotal: "28.90",
          tax: "2.57",
          total: "31.47",
          verificationCode: createVerificationCode(),
          paperSavedGrams: "2.50",
          purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 28),
        },
      ]);
    }
  }
  const [referralSummary] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(profilesTable)
    .where(eq(profilesTable.referredByInviteCode, inviteCode));

  res.json(
    SaveProfileResponse.parse({
      id: profile.id,
      role: profile.role,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      monthlyBudget: profile.monthlyBudget == null ? null : toNumber(profile.monthlyBudget),
      weeklyEmailReport: profile.weeklyEmailReport,
      treeHealthNotifications: profile.treeHealthNotifications,
      privacyMode: profile.privacyMode,
      customerId: profile.customerId,
      ecobillId: ecobillId(profile),
      inviteCode,
      referralCount: referralSummary?.count ?? 0,
      businessName: profile.businessName,
      storeNumber: profile.storeNumber,
      managerName: profile.managerName,
      merchantCategory: profile.merchantCategory,
      businessEin: profile.businessEin,
      businessAddress: profile.businessAddress,
      salesTaxId: profile.salesTaxId,
      operatorNumber: profile.operatorNumber,
      terminalNumber: profile.terminalNumber,
      transactionNumber: profile.transactionNumber,
      tcCode: profile.tcCode,
      taxRate: profile.taxRate == null ? null : toNumber(profile.taxRate),
      createdAt: profile.createdAt.toISOString(),
    }),
  );
});

router.delete("/account", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, userId))
    .limit(1);

  const feedbackScreenshots = await db
    .select({ screenshotPath: betaFeedbackTable.screenshotPath })
    .from(betaFeedbackTable)
    .where(eq(betaFeedbackTable.clerkUserId, userId));
  for (const { screenshotPath } of feedbackScreenshots) {
    if (!screenshotPath) continue;
    try {
      await deleteBetaScreenshot(userId, screenshotPath);
    } catch (error) {
      req.log.error({ err: error }, "Could not remove beta screenshot during account deletion");
      res.status(503).json({ error: "Account data could not be fully removed. Please try again." });
      return;
    }
  }

  await db.transaction(async (tx) => {
    if (profile?.customerId) {
      await tx
        .update(receiptsTable)
        .set({ customerId: null })
        .where(eq(receiptsTable.customerId, profile.customerId));
    }
    if (profile?.role === "merchant") {
      await tx
        .update(receiptsTable)
        .set({ merchantUserId: `deleted-${profile.id}` })
        .where(eq(receiptsTable.merchantUserId, userId));
    }
    await tx
      .delete(dailyActivityTable)
      .where(eq(dailyActivityTable.clerkUserId, userId));
    await tx
      .delete(betaFeedbackTable)
      .where(eq(betaFeedbackTable.clerkUserId, userId));
    await tx
      .delete(betaSessionsTable)
      .where(eq(betaSessionsTable.clerkUserId, userId));
    await tx
      .delete(betaSurveyTable)
      .where(eq(betaSurveyTable.clerkUserId, userId));
    await tx.delete(profilesTable).where(eq(profilesTable.clerkUserId, userId));
  });

  await clerkClient.users.deleteUser(userId);
  res.json(DeleteAccountResponse.parse({ deleted: true }));
});

router.post("/activity/check-in", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, userId))
    .limit(1);
  if (!profile?.customerId) {
    res.status(400).json({ error: "Customer profile required" });
    return;
  }

  const today = utcDate(new Date());
  await db
    .insert(dailyActivityTable)
    .values({ clerkUserId: userId, activityDate: today })
    .onConflictDoNothing({
      target: [dailyActivityTable.clerkUserId, dailyActivityTable.activityDate],
    });
  const status = await getCustomerStreak(userId, profile);
  res.json(CheckInEcoStreakResponse.parse(status));
});

router.get("/receipts", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, userId))
    .limit(1);

  if (!profile) {
    return res.status(404).json({ error: "Profile not completed" });
  }

  const rows =
    profile.role === "merchant"
      ? await db
          .select()
          .from(receiptsTable)
          .where(eq(receiptsTable.merchantUserId, userId))
          .orderBy(desc(receiptsTable.purchasedAt))
      : profile.customerId
        ? await db
            .select()
            .from(receiptsTable)
            .where(eq(receiptsTable.customerId, profile.customerId))
            .orderBy(desc(receiptsTable.purchasedAt))
        : [];

  return res.json(ListReceiptsResponse.parse(rows.map(presentReceipt)));
});

router.post("/receipts", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const input = CreateReceiptBody.parse(req.body);
  const [merchantProfile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, userId))
    .limit(1);
  const configuredTaxRate =
    merchantProfile?.taxRate == null ? undefined : toNumber(merchantProfile.taxRate);
  const effectiveTaxRate = input.taxRate ?? configuredTaxRate;
  const isManualCardPayment = input.paymentMethod === "card-manual";
  const calculatedTax =
    effectiveTaxRate == null
      ? input.tax
      : roundCurrency((input.subtotal * effectiveTaxRate) / 100);
  const calculatedTotal =
    effectiveTaxRate == null
      ? input.total
      : roundCurrency(input.subtotal + calculatedTax);
  const calculatedChangeDue =
    input.changeDue ??
    (input.amountPaid != null && input.amountPaid >= calculatedTotal
      ? roundCurrency(input.amountPaid - calculatedTotal)
      : undefined);
  const [receipt] = await db
    .insert(receiptsTable)
    .values({
      merchantUserId: userId,
      customerId: null,
      merchantName: merchantProfile?.businessName || input.merchantName,
      merchantCategory: merchantProfile?.merchantCategory ?? null,
      merchantAddress: merchantProfile?.businessAddress || input.merchantAddress,
      items: input.items as ReceiptItem[],
      subtotal: input.subtotal.toFixed(2),
       tax: calculatedTax.toFixed(2),
       total: calculatedTotal.toFixed(2),
       storeNumber: input.storeNumber ?? merchantProfile?.storeNumber ?? null,
       managerName: input.managerName ?? merchantProfile?.managerName ?? null,
       merchantPhone: input.merchantPhone ?? merchantProfile?.phone ?? null,
       operatorNumber: input.operatorNumber ?? merchantProfile?.operatorNumber ?? null,
       terminalNumber: input.terminalNumber ?? merchantProfile?.terminalNumber ?? null,
       transactionNumber: input.transactionNumber ?? merchantProfile?.transactionNumber ?? null,
       tcCode: input.tcCode ?? merchantProfile?.tcCode ?? null,
        taxRate: effectiveTaxRate?.toFixed(3) ?? null,
       amountPaid: input.amountPaid?.toFixed(2) ?? null,
       changeDue: calculatedChangeDue?.toFixed(2) ?? null,
       paymentMethod: input.paymentMethod ?? null,
        maskedCard: isManualCardPayment ? null : input.maskedCard ?? null,
        paymentReferenceNumber: isManualCardPayment ? null : input.paymentReferenceNumber ?? null,
        networkId: isManualCardPayment ? null : input.networkId ?? null,
       approvalCode: input.approvalCode ?? null,
        aid: isManualCardPayment ? null : input.aid ?? null,
        applicationCryptogram: isManualCardPayment ? null : input.applicationCryptogram ?? null,
        paymentTerminalId: isManualCardPayment ? null : input.paymentTerminalId ?? null,
      verificationCode: createVerificationCode(),
      paperReceiptRequested: input.paperReceiptRequested ?? false,
      paperSavedGrams: input.paperReceiptRequested ? "0" : "2.50",
    })
    .returning();

  res.status(201).json(CreateReceiptResponse.parse(presentReceipt(receipt)));
});

router.post("/receipts/claim", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const input = ClaimReceiptBody.parse(req.body);
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, userId))
    .limit(1);

  if (!profile?.customerId) {
    return res.status(400).json({ error: "Customer profile required" });
  }

  const [receipt] = await db
    .update(receiptsTable)
    .set({
      customerId: profile.customerId,
      discoverySource: input.discoverySource ?? "direct",
    })
    .where(eq(receiptsTable.verificationCode, input.verificationCode))
    .returning();

  if (!receipt) {
    return res.status(404).json({ error: "Receipt code not found" });
  }

  return res.json(ClaimReceiptResponse.parse(presentReceipt(receipt)));
});

router.get("/receipts/:id", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { id } = GetReceiptParams.parse(req.params);
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, userId))
    .limit(1);

  if (!profile) {
    return res.status(404).json({ error: "Receipt not found" });
  }

  const ownership =
    profile.role === "merchant"
      ? eq(receiptsTable.merchantUserId, userId)
      : profile.customerId
        ? eq(receiptsTable.customerId, profile.customerId)
        : eq(receiptsTable.customerId, "__no_customer__");
  const [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(and(eq(receiptsTable.id, id), ownership))
    .limit(1);

  if (!receipt) {
    return res.status(404).json({ error: "Receipt not found" });
  }

  return res.json(GetReceiptResponse.parse(presentReceipt(receipt)));
});

router.delete("/receipts/:id", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { id } = GetReceiptParams.parse(req.params);
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, userId))
    .limit(1);

  if (!profile) {
    res.status(404).json({ error: "Receipt not found" });
    return;
  }

  const [deletedReceipt] =
    profile.role === "merchant"
      ? await db
          .delete(receiptsTable)
          .where(and(eq(receiptsTable.id, id), eq(receiptsTable.merchantUserId, userId)))
          .returning({ id: receiptsTable.id })
      : profile.customerId
        ? await db
            .update(receiptsTable)
            .set({ customerId: null, discoverySource: null })
            .where(and(eq(receiptsTable.id, id), eq(receiptsTable.customerId, profile.customerId)))
            .returning({ id: receiptsTable.id })
        : [];

  if (!deletedReceipt) {
    res.status(404).json({ error: "Receipt not found" });
    return;
  }

  res.json(DeleteReceiptResponse.parse({ deleted: true }));
});

router.get("/analytics/summary", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, userId))
    .limit(1);

  const rows = profile?.customerId
    ? await db
        .select()
        .from(receiptsTable)
        .where(eq(receiptsTable.customerId, profile.customerId))
    : [];

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const dailySpend = rows
    .filter((row) => row.purchasedAt >= today)
    .reduce((sum, row) => sum + toNumber(row.total), 0);
  const monthlyRows = rows.filter((row) => row.purchasedAt >= month);
  const monthlySpend = monthlyRows.reduce(
    (sum, row) => sum + toNumber(row.total),
    0,
  );

  const categoryTotals = new Map<string, number>();
  for (const row of monthlyRows) {
    for (const item of row.items) {
      const category = categorizeReceiptItem(item);
      categoryTotals.set(
        category,
        (categoryTotals.get(category) ?? 0) + item.price * item.quantity,
      );
    }
  }

  const categorizedSpend = [...categoryTotals.values()].reduce(
    (sum, amount) => sum + amount,
    0,
  );
  const categories = [...categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: categorizedSpend ? (amount / categorizedSpend) * 100 : 0,
    }));

  const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const amount = rows
      .filter((row) => row.purchasedAt >= date && row.purchasedAt < nextMonth)
      .reduce((sum, row) => sum + toNumber(row.total), 0);

    return {
      month: date.toLocaleDateString("en-US", { month: "short" }),
      amount,
    };
  });

  res.json(
    GetAnalyticsSummaryResponse.parse({
      dailySpend,
      monthlySpend,
      receiptCount: rows.length,
      topCategory: categories[0]?.name ?? "No purchases yet",
      categories,
      monthlyTrend,
    }),
  );
});

router.get("/analytics/merchant", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const allRows = await db
    .select()
    .from(receiptsTable)
    .where(eq(receiptsTable.merchantUserId, userId))
    .orderBy(desc(receiptsTable.purchasedAt));
  const rows = allRows.filter((row) => row.purchasedAt >= month);

  const todayRows = rows.filter((row) => row.purchasedAt >= today);
  const todaySales = todayRows.reduce(
    (sum, row) => sum + toNumber(row.total),
    0,
  );
  const monthlySales = rows.reduce(
    (sum, row) => sum + toNumber(row.total),
    0,
  );
  const cardRows = rows.filter(isCardPaymentRecord);
  const todayCardRows = todayRows.filter(isCardPaymentRecord);
  const todayCardSales = todayCardRows.reduce(
    (sum, row) => sum + toNumber(row.total),
    0,
  );
  const monthlyCardSales = cardRows.reduce(
    (sum, row) => sum + toNumber(row.total),
    0,
  );
  const paperlessRows = rows.filter((row) => !row.paperReceiptRequested);
  const receiptsPerRollEstimate = 80;
  const costPerRollEstimate = 0.55;
  const maintenancePerReceiptEstimate = 0.0016;
  const rollsAvoided = paperlessRows.length / receiptsPerRollEstimate;
  const paperCostSaved = rollsAvoided * costPerRollEstimate;
  const printerMaintenanceSaved =
    paperlessRows.length * maintenancePerReceiptEstimate;
  const totalOperatingCostSaved = paperCostSaved + printerMaintenanceSaved;
  const firstReceiptByCustomer = new Map<
    string,
    (typeof allRows)[number]
  >();
  for (const row of allRows) {
    if (!row.customerId) continue;
    const current = firstReceiptByCustomer.get(row.customerId);
    if (!current || row.purchasedAt < current.purchasedAt) {
      firstReceiptByCustomer.set(row.customerId, row);
    }
  }
  const newCustomerReceipts = [...firstReceiptByCustomer.values()].filter(
    (row) => row.purchasedAt >= month,
  );
  const ecoBillAttributedNewCustomers = newCustomerReceipts.filter(
    (row) => row.discoverySource === "green-map",
  ).length;

  const week = new Date(now);
  week.setDate(week.getDate() - 7);
  const weeklyRows = allRows.filter((row) => row.purchasedAt >= week);
  const digitalReceiptTrend = Array.from({ length: 7 }, (_, index) => {
    const dayStart = new Date(today);
    dayStart.setDate(today.getDate() - (6 - index));
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    return {
      day: dayStart.toLocaleDateString("en-US", { weekday: "short" }),
      receipts: allRows.filter(
        (row) =>
          !row.paperReceiptRequested &&
          row.purchasedAt >= dayStart &&
          row.purchasedAt < dayEnd,
      ).length,
    };
  });
  const productNames = new Map<string, string>();
  const productReceiptCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  for (const row of weeklyRows) {
    const products = [
      ...new Set(
        row.items
          .map((item) => item.name.trim())
          .filter(Boolean)
          .map((name) => {
            const key = name.toLocaleLowerCase("en-US");
            if (!productNames.has(key)) productNames.set(key, name);
            return key;
          }),
      ),
    ].sort();
    for (const product of products) {
      productReceiptCounts.set(
        product,
        (productReceiptCounts.get(product) ?? 0) + 1,
      );
    }
    for (let i = 0; i < products.length; i += 1) {
      for (let j = i + 1; j < products.length; j += 1) {
        const key = `${products[i]}\u0000${products[j]}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }
  const strongestPair = [...pairCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])[0];
  let productAssociation = null;
  if (strongestPair) {
    const [pairKey, pairReceiptCount] = strongestPair;
    const [left, right] = pairKey.split("\u0000") as [string, string];
    const leftCount = productReceiptCounts.get(left) ?? pairReceiptCount;
    const rightCount = productReceiptCounts.get(right) ?? pairReceiptCount;
    const [productAKey, productBKey, productAReceiptCount] =
      leftCount <= rightCount
        ? [left, right, leftCount]
        : [right, left, rightCount];
    productAssociation = {
      productA: productNames.get(productAKey) ?? productAKey,
      productB: productNames.get(productBKey) ?? productBKey,
      pairReceiptCount,
      productAReceiptCount,
      associationRate: Number(
        ((pairReceiptCount / productAReceiptCount) * 100).toFixed(1),
      ),
    };
  }

  res.json(
    GetMerchantOverviewResponse.parse({
      todaySales,
      todayReceiptCount: todayRows.length,
      monthlySales,
      todayCardSales,
      todayCashSales: todaySales - todayCardSales,
      monthlyCardSales,
      monthlyCashSales: monthlySales - monthlyCardSales,
      todayCardReceiptCount: todayCardRows.length,
      monthlyCardReceiptCount: cardRows.length,
      treesSaved: rows.length / 8500,
      monthlyDigitalReceipts: paperlessRows.length,
      rollsAvoided: Number(rollsAvoided.toFixed(1)),
      paperCostSaved: Number(paperCostSaved.toFixed(2)),
      printerMaintenanceSaved: Number(printerMaintenanceSaved.toFixed(2)),
      totalOperatingCostSaved: Number(totalOperatingCostSaved.toFixed(2)),
      receiptsPerRollEstimate,
      costPerRollEstimate,
      newCustomersThisMonth: newCustomerReceipts.length,
      ecoBillAttributedNewCustomers,
      attributionTrackingActive: allRows.some(
        (row) => row.discoverySource === "green-map",
      ),
      digitalReceiptTrend,
      productAssociation,
      recentReceipts: rows.slice(0, 5).map(presentReceipt),
    }),
  );
});

router.get("/impact", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, userId))
    .limit(1);

  const condition =
    profile?.role === "customer" && profile.customerId
      ? eq(receiptsTable.customerId, profile.customerId)
      : eq(receiptsTable.merchantUserId, userId);

  const [summary] = await db
    .select({
      receipts: sql<number>`count(*)::int`,
      digitalOnlyReceipts: sql<number>`count(*) filter (where ${receiptsTable.paperReceiptRequested} = false)::int`,
      paperSaved: sql<number>`coalesce(sum(${receiptsTable.paperSavedGrams}), 0)::float`,
      lastReceiptAt: sql<Date | null>`max(${receiptsTable.purchasedAt}) filter (where ${receiptsTable.paperReceiptRequested} = false)`,
    })
    .from(receiptsTable)
    .where(condition);

  const receipts = summary?.receipts ?? 0;
  const digitalOnlyReceipts = summary?.digitalOnlyReceipts ?? 0;
  const paperSaved = summary?.paperSaved ?? 0;
  const lastReceiptAt = summary?.lastReceiptAt
    ? new Date(summary.lastReceiptAt)
    : null;
  const streak = await getCustomerStreak(userId, profile);
  const effectiveGrowthReceipts = digitalOnlyReceipts * streak.growthMultiplier;
  const daysSinceLastReceipt = lastReceiptAt
    ? Math.floor((Date.now() - lastReceiptAt.getTime()) / 86_400_000)
    : Number.POSITIVE_INFINITY;
  const treeStage =
    effectiveGrowthReceipts >= 50
      ? "forest"
      : effectiveGrowthReceipts >= 25
        ? "tree"
        : effectiveGrowthReceipts >= 10
          ? "sapling"
          : effectiveGrowthReceipts >= 1
            ? "sprout"
            : "seed";
  const nextStageAt =
    effectiveGrowthReceipts < 1
      ? 1
      : effectiveGrowthReceipts < 10
        ? 10
        : effectiveGrowthReceipts < 25
          ? 25
          : 50;
  const treeHealth =
    daysSinceLastReceipt <= 2
      ? "thriving"
      : daysSinceLastReceipt <= 6
        ? "healthy"
        : daysSinceLastReceipt <= 13
          ? "resting"
          : "wilting";
  res.json(
    GetImpactSummaryResponse.parse({
      receipts,
      digitalOnlyReceipts,
      paperSaved,
      treesSaved: digitalOnlyReceipts / 50,
      waterSavedLiters: digitalOnlyReceipts * 0.5,
      co2Avoided: digitalOnlyReceipts * 0.007,
       ecoPoints: digitalOnlyReceipts * 10 + streak.currentStreak * 5,
      treeStage,
      treeHealth,
      nextStageAt,
       ...streak,
      lastReceiptAt: lastReceiptAt?.toISOString() ?? null,
    }),
  );
});

export default router;