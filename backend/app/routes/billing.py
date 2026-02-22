"""
Billing API routes – Stripe checkout, subscription management, usage, enterprise contact.
"""

from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.deps import get_current_user
from app.models.schemas import (
    CreateCheckoutRequest,
    EnterpriseContactRequest,
    SubscriptionResponse,
    UsageSummary,
)
from app.services.stripe_service import (
    cancel_subscription,
    create_or_get_customer,
    create_subscription,
    get_price_id,
    get_usage_summary,
    get_user_subscription,
    handle_webhook_event,
    init_stripe,
    record_enterprise_contact,
    update_pending_subscription,
)
from app.core.config import settings

router = APIRouter()


# ── Public: publishable key ──────────────────────────────────────────

@router.get("/billing/config")
def billing_config():
    """Return the Stripe publishable key (public, no auth)."""
    return {"publishable_key": settings.STRIPE_PUBLISHABLE_KEY}


# ── Subscription CRUD ────────────────────────────────────────────────

@router.get("/billing/subscription")
def get_subscription(user: dict = Depends(get_current_user)):
    """Return the current user's subscription & feature flags."""
    init_stripe()
    sub = get_user_subscription(user["uid"])
    return sub


@router.post("/billing/create-subscription")
def create_checkout(body: CreateCheckoutRequest, user: dict = Depends(get_current_user)):
    """Create a Stripe subscription (incomplete) and return a client_secret for Elements."""
    init_stripe()
    email = user.get("email", "")
    customer_id = create_or_get_customer(user["uid"], email)

    try:
        price_id = get_price_id(body.plan, body.billing_interval)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    result = create_subscription(customer_id, price_id)

    # Persist the plan choice optimistically (webhook will confirm)
    update_pending_subscription(
        user["uid"], result["subscription_id"], body.plan, body.billing_interval
    )

    return result


@router.post("/billing/cancel")
def cancel(user: dict = Depends(get_current_user)):
    """Cancel the current user's subscription."""
    init_stripe()
    cancel_subscription(user["uid"])
    return {"status": "canceled"}


# ── Stripe webhooks (no auth – Stripe signs the request) ─────────────

@router.post("/billing/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        init_stripe()
        handle_webhook_event(payload, sig_header)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"status": "ok"}


# ── Usage summary ────────────────────────────────────────────────────

@router.get("/billing/usage")
def usage(user: dict = Depends(get_current_user)):
    """Return the current billing period's usage aggregates."""
    sub = get_user_subscription(user["uid"])
    now = datetime.now(timezone.utc)
    raw_period_end = sub.get("current_period_end")
    if raw_period_end:
        try:
            pe = datetime.fromisoformat(raw_period_end)
            period_start = (pe - timedelta(days=30)).isoformat()
            period_end = raw_period_end
        except Exception:
            period_start = (now - timedelta(days=30)).isoformat()
            period_end = now.isoformat()
    else:
        period_start = (now - timedelta(days=30)).isoformat()
        period_end = now.isoformat()

    return get_usage_summary(user["uid"], period_start, period_end)


# ── Enterprise contact form ──────────────────────────────────────────

@router.post("/billing/enterprise-contact", status_code=201)
def enterprise_contact(body: EnterpriseContactRequest):
    """Store an enterprise enquiry in Firestore (no auth required)."""
    record_enterprise_contact(
        name=body.name,
        email=body.email,
        company=body.company,
        message=body.message,
    )
    return {"status": "received"}
