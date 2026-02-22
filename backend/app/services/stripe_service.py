"""
Stripe billing service – handles customers, subscriptions, webhooks, and usage tracking.
All billing state is stored in Firestore (collections: subscriptions, usage_events,
enterprise_requests). SQLite is not used by this module.
"""

from datetime import datetime, timezone

import stripe
from firebase_admin import firestore

from app.core.config import settings
from app.core.security import ensure_firebase_initialized
from app.models.schemas import PLAN_FEATURES

# ── Firestore client ─────────────────────────────────────────────────

def _fs():
    """Return an initialised Firestore client."""
    ensure_firebase_initialized()
    return firestore.client()


# ── Stripe initialisation ────────────────────────────────────────────

def init_stripe() -> None:
    stripe.api_key = settings.STRIPE_SECRET_KEY


# ── Price‑ID resolution ──────────────────────────────────────────────

_PRICE_MAP: dict[tuple[str, str], str] = {}


def _build_price_map() -> None:
    global _PRICE_MAP
    _PRICE_MAP = {
        ("starter", "monthly"): settings.STRIPE_PRICE_STARTER_MONTHLY,
        ("starter", "annual"):  settings.STRIPE_PRICE_STARTER_ANNUAL,
        ("pro",     "monthly"): settings.STRIPE_PRICE_PRO_MONTHLY,
        ("pro",     "annual"):  settings.STRIPE_PRICE_PRO_ANNUAL,
    }


def get_price_id(plan: str, interval: str) -> str:
    if not _PRICE_MAP:
        _build_price_map()
    price_id = _PRICE_MAP.get((plan, interval))
    if not price_id:
        raise ValueError(f"No Stripe price configured for {plan}/{interval}")
    return price_id


# ── Customer management ──────────────────────────────────────────────

def create_or_get_customer(user_id: str, email: str) -> str:
    """Return existing Stripe customer_id for *user_id* or create one."""
    fs = _fs()
    doc_ref = fs.collection("subscriptions").document(user_id)
    doc = doc_ref.get()

    if doc.exists:
        data = doc.to_dict()
        if data.get("stripe_customer_id"):
            return data["stripe_customer_id"]

    customer = stripe.Customer.create(
        email=email,
        metadata={"comply_user_id": user_id},
    )
    now = datetime.now(timezone.utc).isoformat()
    doc_ref.set(
        {
            "stripe_customer_id": customer.id,
            "plan": "free",
            "status": "inactive",
            "created_at": now,
            "updated_at": now,
        },
        merge=True,
    )
    return customer.id


# ── Optimistic write after creating the Stripe subscription ──────────

def update_pending_subscription(
    user_id: str,
    subscription_id: str,
    plan: str,
    billing_interval: str,
) -> None:
    """Persist the chosen plan optimistically before the webhook confirms."""
    fs = _fs()
    fs.collection("subscriptions").document(user_id).set(
        {
            "stripe_subscription_id": subscription_id,
            "plan": plan,
            "billing_interval": billing_interval,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        merge=True,
    )


# ── Stripe subscription creation (Elements flow) ─────────────────────

def create_subscription(customer_id: str, price_id: str) -> dict:
    """Create an incomplete Stripe subscription and return its client_secret."""
    subscription = stripe.Subscription.create(
        customer=customer_id,
        items=[{"price": price_id}],
        payment_behavior="default_incomplete",
        payment_settings={
            "save_default_payment_method": "on_subscription",
            # Restrict to card only – excludes Klarna, Amazon Pay, etc.
            "payment_method_types": ["card"],
        },
        expand=["latest_invoice.confirmation_secret"],
    )
    return {
        "subscription_id": subscription["id"],
        "client_secret": subscription["latest_invoice"]["confirmation_secret"]["client_secret"],
    }


# ── Cancellation ─────────────────────────────────────────────────────

def cancel_subscription(user_id: str) -> None:
    fs = _fs()
    doc = fs.collection("subscriptions").document(user_id).get()
    if not doc.exists:
        return
    sub_id = doc.to_dict().get("stripe_subscription_id")
    if sub_id:
        stripe.Subscription.cancel(sub_id)
    fs.collection("subscriptions").document(user_id).set(
        {
            "status": "canceled",
            "plan": "free",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        merge=True,
    )


# ── Webhook handling ─────────────────────────────────────────────────

def handle_webhook_event(payload: bytes, sig_header: str) -> None:
    event = stripe.Webhook.construct_event(
        payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
    )
    handler = _WEBHOOK_HANDLERS.get(event["type"])
    if handler:
        handler(event["data"]["object"])


def _find_user_doc_by_customer(customer_id: str):
    """Return (doc_ref, doc_snapshot) for the subscription doc matching customer_id."""
    fs = _fs()
    docs = (
        fs.collection("subscriptions")
        .where("stripe_customer_id", "==", customer_id)
        .limit(1)
        .stream()
    )
    for doc in docs:
        return doc.reference, doc
    return None, None


def _on_subscription_created_or_updated(subscription) -> None:
    customer_id = subscription["customer"]
    doc_ref, _ = _find_user_doc_by_customer(customer_id)
    if not doc_ref:
        return

    # NOTE: subscription.items is a method in newer SDK versions;
    # use bracket access subscription["items"]["data"] instead.
    price_id = None
    try:
        items_data = subscription["items"]["data"]
        if items_data:
            price_id = items_data[0]["price"]["id"]
    except (KeyError, IndexError, TypeError):
        pass

    plan = _price_id_to_plan(price_id)
    interval = _price_id_to_interval(price_id)
    status = subscription["status"]
    # current_period_end was removed in Stripe API v2; use bracket access with fallback
    raw_period_end = subscription.get("current_period_end") or subscription.get("billing_cycle_anchor")
    period_end = (
        datetime.fromtimestamp(raw_period_end, tz=timezone.utc).isoformat()
        if raw_period_end
        else None
    )

    doc_ref.set(
        {
            "stripe_subscription_id": subscription["id"],
            "plan": plan,
            "status": status,
            "current_period_end": period_end,
            "billing_interval": interval,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        merge=True,
    )


def _on_subscription_deleted(subscription) -> None:
    customer_id = subscription["customer"]
    doc_ref, _ = _find_user_doc_by_customer(customer_id)
    if not doc_ref:
        return
    doc_ref.set(
        {
            "status": "canceled",
            "plan": "free",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        merge=True,
    )


def _on_invoice_payment_failed(invoice) -> None:
    customer_id = invoice["customer"]
    doc_ref, _ = _find_user_doc_by_customer(customer_id)
    if not doc_ref:
        return
    doc_ref.set(
        {
            "status": "past_due",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        merge=True,
    )


_WEBHOOK_HANDLERS = {
    "customer.subscription.created": _on_subscription_created_or_updated,
    "customer.subscription.updated": _on_subscription_created_or_updated,
    "customer.subscription.deleted": _on_subscription_deleted,
    "invoice.payment_failed": _on_invoice_payment_failed,
}


# ── Reverse price‑ID lookups ─────────────────────────────────────────

def _price_id_to_plan(price_id) -> str:
    if not _PRICE_MAP:
        _build_price_map()
    for (plan, _interval), pid in _PRICE_MAP.items():
        if pid == price_id:
            return plan
    return "free"


def _price_id_to_interval(price_id):
    if not _PRICE_MAP:
        _build_price_map()
    for (_plan, interval), pid in _PRICE_MAP.items():
        if pid == price_id:
            return interval
    return None


# ── Subscription query ───────────────────────────────────────────────

def get_user_subscription(user_id: str) -> dict:
    fs = _fs()
    doc = fs.collection("subscriptions").document(user_id).get()
    if not doc.exists:
        return {
            "plan": "free",
            "status": "inactive",
            "current_period_end": None,
            "billing_interval": None,
            "features": get_features_for_plan("free"),
        }
    data = doc.to_dict()
    plan = data.get("plan", "free") if data.get("status") in ("active", "trialing") else "free"
    return {
        "plan": plan,
        "status": data.get("status", "inactive"),
        "current_period_end": data.get("current_period_end"),
        "billing_interval": data.get("billing_interval"),
        "features": get_features_for_plan(plan),
    }


def confirm_subscription(user_id: str) -> dict:
    """Check the subscription status directly against Stripe and update Firestore.

    This is called after the frontend confirms payment, so we don't need to
    wait for the webhook to arrive.  Returns the updated subscription dict.
    """
    fs = _fs()
    doc_ref = fs.collection("subscriptions").document(user_id)
    doc = doc_ref.get()
    if not doc.exists:
        return get_user_subscription(user_id)

    data = doc.to_dict()
    sub_id = data.get("stripe_subscription_id")
    if not sub_id:
        return get_user_subscription(user_id)

    # Fetch the live subscription object from Stripe
    try:
        stripe_sub = stripe.Subscription.retrieve(sub_id)
    except Exception:
        return get_user_subscription(user_id)

    # Derive plan / interval from the price ID on the subscription
    # NOTE: stripe_sub.items is a method in newer SDK versions;
    # use bracket access stripe_sub["items"]["data"] instead.
    price_id = None
    try:
        items_data = stripe_sub["items"]["data"]
        if items_data:
            price_id = items_data[0]["price"]["id"]
    except (KeyError, IndexError, TypeError):
        pass

    plan = _price_id_to_plan(price_id)
    interval = _price_id_to_interval(price_id)
    status = stripe_sub["status"]
    # current_period_end was removed in Stripe API v2; use bracket access with fallback
    raw_period_end = stripe_sub.get("current_period_end") or stripe_sub.get("billing_cycle_anchor")
    period_end = (
        datetime.fromtimestamp(raw_period_end, tz=timezone.utc).isoformat()
        if raw_period_end
        else None
    )

    doc_ref.set(
        {
            "plan": plan,
            "status": status,
            "current_period_end": period_end,
            "billing_interval": interval,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        merge=True,
    )

    resolved_plan = plan if status in ("active", "trialing") else "free"
    return {
        "plan": resolved_plan,
        "status": status,
        "current_period_end": period_end,
        "billing_interval": interval,
        "features": get_features_for_plan(resolved_plan),
    }


def get_features_for_plan(plan: str) -> dict:
    return PLAN_FEATURES.get(plan, PLAN_FEATURES["free"])


# ── Enterprise contact ────────────────────────────────────────────────

def record_enterprise_contact(name: str, email: str, company: str, message: str) -> None:
    fs = _fs()
    fs.collection("enterprise_requests").add(
        {
            "name": name,
            "email": email,
            "company": company,
            "message": message,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )


# ── Usage tracking (flat billing – recorded for analytics) ───────────

def record_usage(
    user_id: str,
    event_type: str,
    quantity: float = 1.0,
    metadata: dict | None = None,
) -> None:
    fs = _fs()
    fs.collection("usage_events").add(
        {
            "user_id": user_id,
            "event_type": event_type,
            "quantity": quantity,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )


def get_usage_summary(user_id: str, period_start: str, period_end: str) -> dict:
    fs = _fs()
    docs = (
        fs.collection("usage_events")
        .where("user_id", "==", user_id)
        .where("created_at", ">=", period_start)
        .where("created_at", "<=", period_end)
        .stream()
    )

    summary: dict[str, float] = {
        "agent_runs": 0,
        "infra_scans": 0,
        "pull_requests": 0,
        "legal_tokens": 0.0,
    }
    type_map = {
        "agent_run":       "agent_runs",
        "infra_scan":      "infra_scans",
        "pull_request":    "pull_requests",
        "legal_reasoning": "legal_tokens",
    }
    for doc in docs:
        data = doc.to_dict()
        key = type_map.get(data.get("event_type", ""))
        if key:
            summary[key] += data.get("quantity", 0)

    return {
        **summary,
        "period_start": period_start,
        "period_end":   period_end,
    }
