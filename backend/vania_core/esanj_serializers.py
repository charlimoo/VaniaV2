from typing import Any

from rest_framework import serializers

from users.roles import CANONICAL_EXPERT_SLUG, CANONICAL_VISITOR_SLUG, normalize_role_slug
from .models import EsanjTestAccessRule, EsanjTestAttempt


def user_can_access_esanj_rule(user, rule: EsanjTestAccessRule) -> bool:
    if not rule or not rule.is_active:
        return False
    if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
        return True

    role_slug = normalize_role_slug(getattr(getattr(user, "role", None), "slug", None))
    if role_slug == CANONICAL_VISITOR_SLUG:
        return rule.allow_visitors

    if role_slug == CANONICAL_EXPERT_SLUG:
        if not rule.allow_experts:
            return False
        allowed_professions = set(rule.eligible_expert_professions.values_list("slug", flat=True))
        profession_slug = getattr(getattr(user, "expert_profession", None), "slug", None)
        return not allowed_professions or bool(profession_slug and profession_slug in allowed_professions)

    return False


def normalize_answers(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        raise serializers.ValidationError("answers must be an object keyed by question row.")
    output: dict[str, str] = {}
    for key, answer in value.items():
        try:
            row = int(key)
        except (TypeError, ValueError):
            raise serializers.ValidationError("answer keys must be question row numbers.")
        output[str(row)] = str(answer)
    return output


class EsanjTestRuleSerializer(serializers.ModelSerializer):
    is_available = serializers.SerializerMethodField()
    is_purchased = serializers.SerializerMethodField()
    eligible_expert_professions = serializers.SerializerMethodField()

    class Meta:
        model = EsanjTestAccessRule
        fields = (
            "id",
            "esanj_test_id",
            "title",
            "title_employee",
            "base_price",
            "is_available",
            "is_purchased",
            "allow_visitors",
            "allow_experts",
            "eligible_expert_professions",
            "last_synced_at",
        )

    def get_is_available(self, obj):
        request = self.context.get("request")
        return user_can_access_esanj_rule(getattr(request, "user", None), obj) if request else False

    def get_is_purchased(self, obj):
        paid_rule_ids = self.context.get("paid_rule_ids") or set()
        return obj.id in paid_rule_ids

    def get_eligible_expert_professions(self, obj):
        return list(obj.eligible_expert_professions.values_list("slug", flat=True))


class EsanjQuestionAnswerSerializer(serializers.Serializer):
    row = serializers.IntegerField()
    title = serializers.CharField()
    value = serializers.CharField()


class EsanjQuestionSerializer(serializers.Serializer):
    row = serializers.IntegerField()
    title = serializers.CharField()
    answers = EsanjQuestionAnswerSerializer(many=True)


class EsanjStartAttemptSerializer(serializers.Serializer):
    test_id = serializers.IntegerField(min_value=1, required=False)
    clinical_test_id = serializers.CharField(required=False, allow_blank=True, max_length=64)
    doctor_id = serializers.IntegerField(min_value=1, required=False)
    case_id = serializers.CharField(required=False, allow_blank=True, max_length=64)
    age = serializers.IntegerField(min_value=1, max_value=150)
    sex = serializers.ChoiceField(choices=EsanjTestAttempt.Sex.choices)

    def validate(self, attrs):
        if not attrs.get("test_id") and not attrs.get("clinical_test_id"):
            raise serializers.ValidationError("test_id or clinical_test_id is required.")
        return attrs


class EsanjSaveAnswersSerializer(serializers.Serializer):
    answers = serializers.JSONField()

    def validate_answers(self, value):
        return normalize_answers(value)


class EsanjSubmitAttemptSerializer(serializers.Serializer):
    answers = serializers.JSONField(required=False)

    def validate_answers(self, value):
        return normalize_answers(value)


class EsanjAttemptSerializer(serializers.ModelSerializer):
    progress = serializers.SerializerMethodField()
    questions_count = serializers.SerializerMethodField()
    result = serializers.SerializerMethodField()

    class Meta:
        model = EsanjTestAttempt
        fields = (
            "id",
            "clinical_test_id",
            "doctor_id",
            "case_id",
            "esanj_test_id",
            "test_title",
            "status",
            "age",
            "sex",
            "answers",
            "questionnaire",
            "questions_count",
            "progress",
            "result",
            "error_message",
            "started_at",
            "updated_at",
            "submitted_at",
            "completed_at",
        )

    def get_questions_count(self, obj):
        questions = obj.questionnaire.get("questions", []) if isinstance(obj.questionnaire, dict) else []
        return len(questions) if isinstance(questions, list) else 0

    def get_progress(self, obj):
        total = self.get_questions_count(obj)
        answered = len(obj.answers or {})
        return {"answered": answered, "total": total}

    def get_result(self, obj):
        if obj.status not in {EsanjTestAttempt.Status.COMPLETED, EsanjTestAttempt.Status.FAILED}:
            return None
        return {
            "json": obj.result_json or {},
            "grading": obj.grading_json or {},
        }
