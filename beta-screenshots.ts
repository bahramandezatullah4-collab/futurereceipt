import { createHash, randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";

const SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
export const MAX_BETA_SCREENSHOT_BYTES = 2_000_000;

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function privateObjectDirectory(): string {
  const directory = process.env.PRIVATE_OBJECT_DIR?.trim().replace(/\/+$/, "");
  if (!directory) {
    throw new Error("Private App Storage is not configured");
  }
  return directory;
}

function bucketAndObject(fullPath: string): {
  bucketName: string;
  objectName: string;
} {
  const parts = fullPath.replace(/^\/+/, "").split("/");
  const bucketName = parts.shift();
  const objectName = parts.join("/");
  if (!bucketName || !objectName) {
    throw new Error("Invalid private object path");
  }
  return { bucketName, objectName };
}

function userFolder(userId: string): string {
  return createHash("sha256").update(userId).digest("hex");
}

function screenshotFile(userId: string, objectPath: string) {
  const folder = userFolder(userId);
  const pattern = new RegExp(
    `^/objects/feedback/${folder}/[0-9a-f-]{36}\\.jpg$`,
  );
  if (!pattern.test(objectPath)) {
    throw new Error("Invalid screenshot path");
  }

  const fullPath = `${privateObjectDirectory()}/${objectPath.slice(
    "/objects/".length,
  )}`;
  const { bucketName, objectName } = bucketAndObject(fullPath);
  return storage.bucket(bucketName).file(objectName);
}

export async function createBetaScreenshotUpload(
  userId: string,
): Promise<{ uploadURL: string; objectPath: string }> {
  const relativePath = `feedback/${userFolder(userId)}/${randomUUID()}.jpg`;
  const { bucketName, objectName } = bucketAndObject(
    `${privateObjectDirectory()}/${relativePath}`,
  );

  const response = await fetch(
    `${SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket_name: bucketName,
        object_name: objectName,
        method: "PUT",
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to create screenshot upload URL (${response.status})`);
  }

  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("signed_url" in payload) ||
    typeof payload.signed_url !== "string"
  ) {
    throw new Error("Storage returned an invalid upload URL");
  }

  return {
    uploadURL: payload.signed_url,
    objectPath: `/objects/${relativePath}`,
  };
}

export async function verifyBetaScreenshot(
  userId: string,
  objectPath: string,
): Promise<boolean> {
  const file = screenshotFile(userId, objectPath);
  const [metadata] = await file.getMetadata();
  return (
    metadata.contentType?.split(";")[0] === "image/jpeg" &&
    Number(metadata.size ?? 0) > 0 &&
    Number(metadata.size ?? 0) <= MAX_BETA_SCREENSHOT_BYTES
  );
}

export async function downloadBetaScreenshotForEmail(
  userId: string,
  objectPath: string,
): Promise<Buffer> {
  const file = screenshotFile(userId, objectPath);
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size ?? 0);
  if (
    metadata.contentType?.split(";")[0] !== "image/jpeg" ||
    size <= 0 ||
    size > MAX_BETA_SCREENSHOT_BYTES
  ) {
    throw new Error("Feedback screenshot is not a valid small JPEG image");
  }

  const [contents] = await file.download();
  if (contents.length === 0 || contents.length > MAX_BETA_SCREENSHOT_BYTES) {
    throw new Error("Feedback screenshot has an invalid size");
  }
  return contents;
}

export async function deleteBetaScreenshot(
  userId: string,
  objectPath: string,
): Promise<void> {
  const file = screenshotFile(userId, objectPath);
  await file.delete({ ignoreNotFound: true });
}
