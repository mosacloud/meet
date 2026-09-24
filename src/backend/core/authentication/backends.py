"""Authentication Backends for the Meet core app."""

import contextlib
import logging

from django.conf import settings
from django.core.exceptions import (
    ImproperlyConfigured,
    SuspiciousOperation,
    ValidationError,
)
from django.core.validators import URLValidator
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from lasuite.oidc_login.backends import (
    OIDCAuthenticationBackend as LaSuiteOIDCAuthenticationBackend,
)
from rest_framework.authentication import SessionAuthentication

from core.models import User
from core.services.marketing import (
    ContactCreationError,
    ContactData,
    get_marketing_service,
)
from core.validators import sub_validator

logger = logging.getLogger(__name__)

PICTURE_MAX_LENGTH = User._meta.get_field("picture").max_length  # noqa: SLF001
_validate_picture_url = URLValidator(schemes=["http", "https"])


def sanitize_picture_claim(picture):
    """
    Validate the OIDC "picture" claim before it reaches the User model.

    An unvalidated claim can crash the whole login with a 500: User.full_clean()
    runs the URLField validation on every save and raises an uncaught
    ValidationError for a malformed or oversized value.

    Args:
      picture: The raw "picture" claim from the userinfo response.

    Returns:
      str | None: The claim if it is a valid, appropriately-sized URL, else None.

    """
    if picture is None:
        return None
    if not isinstance(picture, str):
        logger.warning(
            "Rejected non-string OIDC 'picture' claim of type %r",
            type(picture).__name__,
        )
        return None
    if len(picture) > PICTURE_MAX_LENGTH:
        logger.warning(
            "Rejected OIDC 'picture' claim exceeding %d characters",
            PICTURE_MAX_LENGTH,
        )
        return None
    try:
        _validate_picture_url(picture)
    except ValidationError as exc:
        logger.warning("Rejected malformed OIDC 'picture' claim: %s", exc)
        return None
    return picture


class OIDCAuthenticationBackend(LaSuiteOIDCAuthenticationBackend):
    """Custom OpenID Connect (OIDC) Authentication Backend.

    This class overrides the default OIDC Authentication Backend to accommodate differences
    in the User and Identity models, and handles signed and/or encrypted UserInfo response.
    """

    # Claims that must be cleared on the user once they resolve to None — whether
    # because the IdP stopped sending them, or because the value it sent failed
    # validation (see `sanitize_picture_claim`) — rather than left stale (the base
    # `update_user_if_needed` only ever applies truthy claim values, so a claim
    # that becomes None is otherwise ignored).
    NULLABLE_CLAIM_FIELDS = ("picture",)

    def update_user_if_needed(self, user, claims):
        """
        Update user claims, additionally clearing stale nullable claims and
        bumping `updated_at` whenever anything actually changed.

        `updated_at` has auto_now=True, but Django only bumps it when it's in
        `update_fields` — and the base class's own save always passes an
        explicit `update_fields` built from the changed claim names, never
        including `updated_at`. So both branches below bump it explicitly.
        """
        # Computed up front: the base class's own update loop only ever applies
        # truthy claim values, so it never touches a field a claim is clearing to
        # None — safe to check before calling super().
        stale_fields = [
            field
            for field in self.NULLABLE_CLAIM_FIELDS
            if field in claims
            and claims[field] is None
            and getattr(user, field, None) is not None
        ]
        # Mirrors the base class's own "did anything actually change" check,
        # including its carve-out for an attempted change to an immutable
        # `sub` (logged there, but never actually applied/saved) — otherwise
        # this would count as a change and trigger a spurious `updated_at`
        # bump for a user row the base class didn't touch.
        claim_changed = any(
            claim_value and claim_value != getattr(user, key, None)
            for key, claim_value in claims.items()
            if hasattr(user, key)
            and not (
                key == self.OIDC_USER_SUB_FIELD
                and getattr(user, key, None)
                and self.OIDC_USER_SUB_FIELD_IMMUTABLE
            )
        )

        if not stale_fields:
            super().update_user_if_needed(user, claims)
            if claim_changed:
                # A queryset update avoids re-running full_clean()'s
                # uniqueness validation just to bump one timestamp column.
                now = timezone.now()
                type(user).objects.filter(pk=user.pk).update(updated_at=now)
                user.updated_at = now
            return

        # Only pay for a transaction (and its extra SAVEPOINT queries) when a
        # second save is actually about to happen, to keep the common
        # single-save path free of that overhead.
        with transaction.atomic():
            super().update_user_if_needed(user, claims)
            for field in stale_fields:
                setattr(user, field, None)
            user.save(update_fields=[*stale_fields, "updated_at"])

    def get_extra_claims(self, user_info):
        """
        Return extra claims from user_info.

        Args:
          user_info (dict): The user information dictionary.

        Returns:
          dict: A dictionary of extra claims.

        """
        extra_claims = {
            # Get user's full name from OIDC fields defined in settings
            "full_name": self.compute_full_name(user_info),
            "short_name": user_info.get(settings.OIDC_USERINFO_SHORTNAME_FIELD),
            "picture": sanitize_picture_claim(user_info.get("picture")),
        }

        language = self.compute_language(user_info)
        if language:
            extra_claims["language"] = language

        return extra_claims

    # Session key backing `language_confirmed_by_idp` on UserSerializer.
    # Session storage (not a User column) is deliberate: this is re-derived
    # on every login, so it doesn't need a migration or a persisted column.
    LANGUAGE_CONFIRMED_SESSION_KEY = "language_confirmed_by_idp"

    def compute_language(self, user_info):
        """
        Resolve a supported Django language code from the OIDC "locale" claim.

        The claim is a BCP47 tag (e.g. "nl", "nl-NL" or "en"); only its
        primary subtag is used, matched against the primary subtag of each
        code in `settings.LANGUAGES` (e.g. "en" -> "en-us", "nl" -> "nl-nl").
        Returns None when the claim is missing or not one of our supported
        languages, so an unrecognized/absent locale never overrides the
        user's existing preference (see `update_user_if_needed`, which skips
        falsy claim values).

        As a side effect, records in the session whether this login presented
        a usable locale claim (see `LANGUAGE_CONFIRMED_SESSION_KEY`) — lets
        the frontend tell a real "en-us" preference apart from a User row
        that never had a locale claim applied.
        """
        locale = user_info.get("locale")
        language = None

        if locale is None:
            pass
        elif not isinstance(locale, str):
            logger.warning(
                "Rejected non-string OIDC 'locale' claim of type %r",
                type(locale).__name__,
            )
        elif not locale:
            logger.info("Rejected empty OIDC 'locale' claim")
        else:
            lang_code = locale.split("-")[0].lower()
            supported_languages = {}
            for code, _name in settings.LANGUAGES:
                primary_subtag = code.split("-")[0]
                if primary_subtag in supported_languages:
                    logger.warning(
                        "settings.LANGUAGES has two codes sharing primary "
                        "subtag %r (%r, %r) — only the first is matched",
                        primary_subtag,
                        supported_languages[primary_subtag],
                        code,
                    )
                    continue
                supported_languages[primary_subtag] = code
            language = supported_languages.get(lang_code)
            if language is None:
                logger.info(
                    "OIDC 'locale' claim %r is not a supported language",
                    locale[:100],
                )

        session = getattr(getattr(self, "request", None), "session", None)
        if session is not None:
            session[self.LANGUAGE_CONFIRMED_SESSION_KEY] = language is not None

        return language

    def post_get_or_create_user(self, user, claims, is_new_user):
        """
        Post-processing after user creation or retrieval.

        Args:
          user (User): The user instance.
          claims (dict): The claims dictionary.
          is_new_user (bool): Indicates if the user was newly created.

        Returns:
        - None

        """
        email = claims["email"]
        if is_new_user and email and settings.SIGNUP_NEW_USER_TO_MARKETING_EMAIL:
            self.signup_to_marketing_email(email)

    @staticmethod
    def signup_to_marketing_email(email):
        """Pragmatic approach to newsletter signup during authentication flow.

        Details:
        1. Uses a very short timeout (1s) to prevent blocking the auth process
        2. Silently fails if the marketing service is down/slow to prioritize user experience
        3. Trade-off: May miss some signups but ensures auth flow remains fast

        Note: For a more robust solution, consider using Async task processing (Celery/Django-Q)
        """
        with contextlib.suppress(
            ContactCreationError, ImproperlyConfigured, ImportError
        ):
            marketing_service = get_marketing_service()
            contact_data = ContactData(
                email=email, attributes={"VISIO_SOURCE": ["SIGNIN"]}
            )
            marketing_service.create_contact(
                contact_data, timeout=settings.BREVO_API_TIMEOUT
            )

    def get_existing_user(self, sub, email):
        """Fetch existing user by sub or email."""

        sub = str(sub)

        try:
            sub_validator(sub)
        except ValidationError as err:
            raise SuspiciousOperation(
                "User info contained an invalid sub claim"
            ) from err

        if len(sub) > 255:
            raise SuspiciousOperation("User info contained an invalid sub claim")

        try:
            return User.objects.get(sub=sub)
        except User.DoesNotExist:
            if email and settings.OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION:
                try:
                    return User.objects.get(email__iexact=email)
                except User.DoesNotExist:
                    pass
                except User.MultipleObjectsReturned as e:
                    raise SuspiciousOperation(
                        "Multiple user accounts share a common email."
                    ) from e
        return None


class SessionAuthenticationWith401(SessionAuthentication):
    """
    Identical to DRF's SessionAuthentication, but returns a WWW-Authenticate
    header so unauthenticated requests get a 401 instead of a 403.

    The scheme is deliberately NOT 'Basic' — that would trigger the browser's
    native login popup. 'Session' is ignored by the browser's auth UI but is
    still truthy, so DRF keeps the status at 401.
    """

    def authenticate_header(self, request):
        return "Session"
