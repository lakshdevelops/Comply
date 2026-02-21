import { NextRequest, NextResponse } from "next/server";
import { otpSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = otpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { otp, email } = parsed.data;

    // TODO: Look up OTP for email in DB
    // TODO: Check OTP expiry (5-minute window)
    // TODO: Check attempt count (max 3 per session) → 429 if exceeded
    // TODO: Compare OTP hash, mark user as verified on match
    // TODO: Delete / invalidate OTP after use

    // Stub: accept "123456" as a valid OTP for demo purposes
    if (otp !== "123456") {
      return NextResponse.json(
        { error: "Invalid or expired verification code" },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true, email }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
