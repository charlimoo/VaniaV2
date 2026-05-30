import csv
import json
from decimal import Decimal

from django.contrib import admin
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Count, Sum
from django.http import HttpResponse
from django.utils import timezone

from .models import Invoice


class ExportAllWhenNoSelectionMixin:
    export_all_when_no_selection_actions = ()

    def response_action(self, request, queryset):
        try:
            action_index = int(request.POST.get("index", 0))
        except ValueError:
            action_index = 0

        actions_from_post = request.POST.getlist("action")
        action_name = actions_from_post[action_index] if action_index < len(actions_from_post) else ""
        selected = request.POST.getlist(admin.helpers.ACTION_CHECKBOX_NAME)
        select_across = request.POST.get("select_across") == "1"

        if (
            action_name in self.export_all_when_no_selection_actions
            and not selected
            and not select_across
        ):
            actions = self.get_actions(request)
            action = actions.get(action_name)
            if action:
                action_func, _, _ = action
                return action_func(self, request, self.model._default_manager.all())

        return super().response_action(request, queryset)


def _csv_response(filename):
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response.write("\ufeff")
    return response


def _write_csv(filename, headers, rows):
    response = _csv_response(filename)
    writer = csv.writer(response)
    writer.writerow(headers)
    for row in rows:
        writer.writerow([_cell(value) for value in row])
    return response


def _cell(value):
    if value is None:
        return ""
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, (dict, list, tuple)):
        return json.dumps(value, ensure_ascii=False, default=str)
    return value


def _dt(value):
    if not value:
        return ""
    if timezone.is_aware(value):
        value = timezone.localtime(value)
    return value.strftime("%Y-%m-%d %H:%M:%S")


def _related(obj, name):
    try:
        return getattr(obj, name)
    except ObjectDoesNotExist:
        return None


def _money(value):
    if value is None:
        return ""
    if isinstance(value, Decimal):
        return format(value, "f")
    return value


def _product_details(invoice):
    product = invoice.content_object
    if not product:
        return {
            "type": "",
            "name": "",
            "description": "",
            "plan": "",
            "plan_slug": "",
            "credits": "",
            "price": "",
        }

    linked_plan = getattr(product, "linked_plan", None)
    return {
        "type": product._meta.verbose_name.title(),
        "name": getattr(product, "name", str(product)),
        "description": getattr(product, "description", ""),
        "plan": getattr(linked_plan, "name", ""),
        "plan_slug": getattr(linked_plan, "slug", ""),
        "credits": _money(getattr(product, "credit_amount", "")),
        "price": _money(getattr(product, "price", "")),
    }


def _purchase_summary(invoices):
    parts = []
    for invoice in invoices:
        product = _product_details(invoice)
        discount = getattr(invoice.discount_code, "code", "") if invoice.discount_code_id else ""
        parts.append(
            " | ".join(
                filter(
                    None,
                    [
                        f"id={invoice.id}",
                        f"status={invoice.status}",
                        f"date={_dt(invoice.created_at)}",
                        f"paid_at={_dt(invoice.payment_date)}" if invoice.payment_date else "",
                        f"item={product['name']}" if product["name"] else "",
                        f"plan={product['plan']}" if product["plan"] else "",
                        f"subtotal={_money(invoice.subtotal_amount)}",
                        f"discount={_money(invoice.discount_amount)}",
                        f"discount_code={discount}" if discount else "",
                        f"tax={_money(invoice.tax_amount)}",
                        f"total={_money(invoice.total_amount)}",
                        f"ref={invoice.transaction_ref_id}" if invoice.transaction_ref_id else "",
                    ],
                )
            )
        )
    return "\n".join(parts)


def _latest_context_entries(user, limit=10):
    entries = []
    queryset = (
        user.context_entries.filter(is_active=True)
        .select_related("definition")
        .order_by("-created_at")[:limit]
    )
    for entry in queryset:
        entries.append(
            {
                "key": entry.definition.key,
                "source": entry.source,
                "created_at": _dt(entry.created_at),
                "data": entry.data,
            }
        )
    return entries


def export_users_csv(queryset):
    headers = [
        "user_id",
        "phone_number",
        "full_name",
        "email",
        "national_code",
        "role",
        "expert_profession",
        "medical_license",
        "is_active",
        "is_staff",
        "is_verified_doctor",
        "is_expert_verified",
        "expert_verified_at",
        "expert_verification_meta",
        "date_joined",
        "last_login",
        "profile_skin_type",
        "active_plan",
        "active_plan_slug",
        "plan_balance",
        "paid_balance",
        "total_balance",
        "daily_free_used",
        "wallet_updated_at",
        "invoices_count",
        "paid_invoices_count",
        "total_paid_amount",
        "total_discount_amount",
        "latest_purchase_at",
        "latest_paid_purchase_at",
        "latest_purchase_item",
        "latest_purchase_status",
        "context_entries_count",
        "latest_context_entries",
        "purchase_history",
    ]

    rows = []
    users = queryset.select_related("role", "expert_profession", "wallet__active_plan", "profile")
    for user in users:
        invoices = list(
            user.invoices.select_related("discount_code", "content_type")
            .order_by("-created_at")
        )
        paid_invoices = [invoice for invoice in invoices if invoice.status == Invoice.Status.PAID]
        latest_invoice = invoices[0] if invoices else None
        latest_paid_invoice = paid_invoices[0] if paid_invoices else None
        latest_product = _product_details(latest_invoice) if latest_invoice else {}
        wallet = _related(user, "wallet")
        active_plan = getattr(wallet, "active_plan", None) if wallet else None
        profile = _related(user, "profile")
        total_paid = sum((invoice.total_amount for invoice in paid_invoices), Decimal("0.00"))
        total_discount = sum((invoice.discount_amount for invoice in invoices), Decimal("0.00"))

        rows.append(
            [
                user.pk,
                user.phone_number,
                user.full_name,
                user.email,
                user.national_code,
                getattr(user.role, "name", ""),
                getattr(user.expert_profession, "name", ""),
                user.medical_license,
                user.is_active,
                user.is_staff,
                user.is_verified_doctor,
                user.is_expert_verified,
                _dt(user.expert_verified_at),
                user.expert_verification_meta,
                _dt(user.date_joined),
                _dt(user.last_login),
                getattr(profile, "skin_type", ""),
                getattr(active_plan, "name", ""),
                getattr(active_plan, "slug", ""),
                _money(getattr(wallet, "balance_plan", "")),
                _money(getattr(wallet, "balance_paid", "")),
                _money(getattr(wallet, "total_balance", "")),
                _money(getattr(wallet, "daily_free_used", "")),
                _dt(getattr(wallet, "updated_at", None)),
                len(invoices),
                len(paid_invoices),
                _money(total_paid),
                _money(total_discount),
                _dt(getattr(latest_invoice, "created_at", None)),
                _dt(getattr(latest_paid_invoice, "payment_date", None)),
                latest_product.get("name", ""),
                getattr(latest_invoice, "status", ""),
                user.context_entries.filter(is_active=True).count(),
                _latest_context_entries(user),
                _purchase_summary(invoices),
            ]
        )

    return _write_csv("users-and-purchases.csv", headers, rows)


def export_purchases_csv(queryset):
    headers = [
        "invoice_id",
        "user_id",
        "phone_number",
        "full_name",
        "email",
        "national_code",
        "status",
        "created_at",
        "payment_date",
        "item_type",
        "item_name",
        "item_description",
        "linked_plan",
        "linked_plan_slug",
        "credit_amount",
        "catalog_price",
        "subtotal_amount",
        "discount_code",
        "discount_percent",
        "discount_amount",
        "tax_rate",
        "tax_amount",
        "total_amount",
        "transaction_ref_id",
        "card_number",
        "authority",
    ]

    rows = []
    invoices = queryset.select_related("user", "discount_code", "content_type").order_by("-created_at")
    for invoice in invoices:
        product = _product_details(invoice)
        discount = invoice.discount_code
        rows.append(
            [
                invoice.id,
                invoice.user_id,
                invoice.user.phone_number,
                invoice.user.full_name,
                invoice.user.email,
                invoice.user.national_code,
                invoice.status,
                _dt(invoice.created_at),
                _dt(invoice.payment_date),
                product["type"],
                product["name"],
                product["description"],
                product["plan"],
                product["plan_slug"],
                product["credits"],
                product["price"],
                _money(invoice.subtotal_amount),
                getattr(discount, "code", ""),
                getattr(discount, "percent", ""),
                _money(invoice.discount_amount),
                _money(invoice.tax_rate),
                _money(invoice.tax_amount),
                _money(invoice.total_amount),
                invoice.transaction_ref_id,
                invoice.card_number,
                invoice.authority,
            ]
        )

    return _write_csv("purchases.csv", headers, rows)


def export_discount_codes_csv(queryset):
    headers = [
        "code",
        "percent",
        "max_amount_per_usage",
        "max_fund",
        "used_fund",
        "remaining_fund",
        "expiry_date",
        "is_active",
        "invoices_count",
        "paid_invoices_count",
        "pending_invoices_count",
        "waiting_approval_invoices_count",
        "cancelled_invoices_count",
        "total_discount_all_invoices",
        "total_discount_paid_invoices",
        "total_revenue_paid_invoices",
        "first_used_at",
        "last_used_at",
    ]

    rows = []
    for discount in queryset.order_by("code"):
        invoices = Invoice.objects.filter(discount_code=discount)
        paid = invoices.filter(status=Invoice.Status.PAID)
        first_invoice = invoices.order_by("created_at").first()
        last_invoice = invoices.order_by("-created_at").first()
        all_discount = invoices.aggregate(total=Sum("discount_amount"))["total"] or Decimal("0.00")
        paid_discount = paid.aggregate(total=Sum("discount_amount"))["total"] or Decimal("0.00")
        paid_revenue = paid.aggregate(total=Sum("total_amount"))["total"] or Decimal("0.00")
        remaining_fund = ""
        if discount.max_fund is not None:
            remaining_fund = max(Decimal("0.00"), discount.max_fund - discount.used_fund)

        status_counts = invoices.values("status").annotate(count=Count("id"))
        counts_by_status = {item["status"]: item["count"] for item in status_counts}

        rows.append(
            [
                discount.code,
                discount.percent,
                _money(discount.max_amount_per_usage),
                _money(discount.max_fund),
                _money(discount.used_fund),
                _money(remaining_fund),
                _dt(discount.expiry_date),
                discount.is_active,
                invoices.count(),
                paid.count(),
                counts_by_status.get(Invoice.Status.PENDING, 0),
                counts_by_status.get(Invoice.Status.WAITING_APPROVAL, 0),
                counts_by_status.get(Invoice.Status.CANCELLED, 0),
                _money(all_discount),
                _money(paid_discount),
                _money(paid_revenue),
                _dt(getattr(first_invoice, "created_at", None)),
                _dt(getattr(last_invoice, "created_at", None)),
            ]
        )

    return _write_csv("discount-codes.csv", headers, rows)
