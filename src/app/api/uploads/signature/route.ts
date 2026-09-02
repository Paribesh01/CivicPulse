import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { signUpload, UPLOAD_FOLDER } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

/// Hands the browser a short-lived signature so it can upload one photo
/// straight to Cloudinary. Sign-in is required: an open signing endpoint is an
/// open door to someone else's storage bill.
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const signed = signUpload({ folder: UPLOAD_FOLDER });
  if (!signed) {
    return NextResponse.json(
      { error: "Photo storage is not configured", configured: false },
      { status: 503 },
    );
  }

  return NextResponse.json({
    configured: true,
    folder: UPLOAD_FOLDER,
    ...signed,
  });
}
