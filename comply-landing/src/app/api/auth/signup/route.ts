import { NextRequest, NextResponse } from "next/server";
import { signUpSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signUpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // TODO: Check if email already exists in DB → 409 if so
    // TODO: Hash password with bcrypt/argon2
    // TODO: Store user in DB
    // TODO: Generate 6-digit OTP, set 5-minute expiry, store hash in DB
    // TODO: Send OTP via email (Resend / SendGrid / SES)

    // Stub: always succeed and signal OTP required
    return NextResponse.json(
      { success: true, requiresOtp: true, email },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
