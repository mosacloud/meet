"""Unit tests for the Authentication Backends."""

from types import SimpleNamespace
from unittest import mock

from django.contrib.sessions.middleware import SessionMiddleware
from django.core.exceptions import ImproperlyConfigured, SuspiciousOperation
from django.test import RequestFactory

import pytest

from core import models
from core.authentication.backends import (
    PICTURE_MAX_LENGTH,
    OIDCAuthenticationBackend,
    sanitize_picture_claim,
)
from core.factories import UserFactory
from core.services import marketing

pytestmark = pytest.mark.django_db


def test_authentication_getter_existing_user(monkeypatch):
    """
    If an existing user matches, the user should be returned.
    """

    klass = OIDCAuthenticationBackend()
    db_user = UserFactory(email="foo@mail.com")

    def get_userinfo_mocked(*args):
        return {"sub": db_user.sub, "email": "some@mail.com"}

    def get_existing_user(*args):
        return db_user

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)
    monkeypatch.setattr(
        OIDCAuthenticationBackend, "get_existing_user", get_existing_user
    )

    user = klass.get_or_create_user(
        access_token="test-token", id_token=None, payload=None
    )

    assert user == db_user


@pytest.mark.parametrize(
    "sub",
    [
        # NUL (U+0000) passes str.isascii() but PostgreSQL text fields
        # cannot store or compare it (DataError)
        "auth0|abc\x00def",
        # lone surrogates cannot be encoded to UTF-8 for the DB lookup
        # (UnicodeEncodeError), which runs before any model validation
        "bad\ud800sub",
        # plainly invalid subs would otherwise escape as ValidationError
        # on user creation, which mozilla-django-oidc does not catch
        "\u00e9milie",
        "a" * 256,
        # ASCII control characters are rejected by policy
        "tab\tsub",
        "del\x7fsub",
    ],
)
def test_authentication_getter_invalid_sub_rejected_cleanly(monkeypatch, sub):
    """
    Subs that can never be persisted should be rejected with
    SuspiciousOperation (turned into a clean authentication failure by
    mozilla-django-oidc) instead of leaking DataError, UnicodeEncodeError
    or ValidationError as a server error.
    """
    klass = OIDCAuthenticationBackend()

    def get_userinfo_mocked(*args):
        return {"sub": sub, "email": "john@example.com"}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    with pytest.raises(
        SuspiciousOperation,
        match="User info contained an invalid sub claim",
    ):
        klass.get_or_create_user(access_token="test-token", id_token=None, payload=None)

    assert models.User.objects.exists() is False


def test_authentication_getter_numeric_sub(monkeypatch):
    """
    Some providers serialize the sub as a JSON number. It should keep working
    (CharField coerces it to a string on save) and must not crash the early
    sub checks in get_existing_user.
    """
    klass = OIDCAuthenticationBackend()

    def get_userinfo_mocked(*args):
        return {"sub": 12345, "email": "john@example.com"}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user(
        access_token="test-token", id_token=None, payload=None
    )

    assert user.sub == "12345"
    assert models.User.objects.count() == 1


def test_authentication_getter_new_user_auth0_pipe_sub(monkeypatch):
    """
    A first login with an Auth0-style sub containing a pipe ("provider|user-id")
    should create the user instead of raising a ValidationError.
    Regression test for https://github.com/suitenumerique/meet/issues/[XXX].
    """
    klass = OIDCAuthenticationBackend()

    def get_userinfo_mocked(*args):
        return {"sub": "auth0|644c0bc8f1874ef6d339fb34", "email": "john@example.com"}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user(
        access_token="test-token", id_token=None, payload=None
    )

    assert user.sub == "auth0|644c0bc8f1874ef6d339fb34"
    assert user.email == "john@example.com"
    assert models.User.objects.count() == 1


def test_authentication_getter_existing_user_auth0_pipe_sub(monkeypatch):
    """
    A returning user with an Auth0-style pipe sub should be matched by sub,
    not duplicated or rejected.
    """
    klass = OIDCAuthenticationBackend()
    db_user = UserFactory(sub="auth0|644c0bc8f1874ef6d339fb34")

    def get_userinfo_mocked(*args):
        return {"sub": db_user.sub}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user(
        access_token="test-token", id_token=None, payload=None
    )

    assert user == db_user
    assert models.User.objects.count() == 1


def test_authentication_getter_new_user_no_email(monkeypatch):
    """
    If no user matches, a user should be created.
    User's info doesn't contain an email, created user's email should be empty.
    """
    klass = OIDCAuthenticationBackend()

    def get_userinfo_mocked(*args):
        return {"sub": "123"}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user(
        access_token="test-token", id_token=None, payload=None
    )

    assert user.sub == "123"
    assert user.email is None
    assert user.has_usable_password() is False
    assert models.User.objects.count() == 1


def test_authentication_getter_new_user_with_email(monkeypatch):
    """
    If no user matches, a user should be created.
    User's info contains an email, created user's email should be filled.
    """
    klass = OIDCAuthenticationBackend()

    email = "meet@example.com"

    def get_userinfo_mocked(*args):
        return {"sub": "123", "email": email}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user(
        access_token="test-token", id_token=None, payload=None
    )

    assert user.sub == "123"
    assert user.email == email
    assert user.full_name is None
    assert user.short_name is None
    assert user.has_usable_password() is False
    assert models.User.objects.count() == 1


@pytest.mark.parametrize("email", [None, "johndoe@foo.com"])
def test_authentication_getter_new_user_with_names(monkeypatch, email):
    """
    If no user matches, a user should be created.
    User's info contains name-related field, created user's full and short names should be filled,
    whether the email is filled
    """
    klass = OIDCAuthenticationBackend()

    def get_userinfo_mocked(*args):
        return {"sub": "123", "given_name": "John", "usual_name": "Doe", "email": email}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user(
        access_token="test-token", id_token=None, payload=None
    )

    assert user.sub == "123"
    assert user.email == email
    assert user.full_name == "John Doe"
    assert user.short_name == "John"
    assert user.has_usable_password() is False
    assert models.User.objects.count() == 1


def test_models_oidc_user_getter_invalid_token(django_assert_num_queries, monkeypatch):
    """The user's info doesn't contain a sub."""
    klass = OIDCAuthenticationBackend()

    def get_userinfo_mocked(*args):
        return {
            "test": "123",
        }

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    with (
        django_assert_num_queries(0),
        pytest.raises(
            SuspiciousOperation,
            match="Claims verification failed",
        ),
    ):
        klass.get_or_create_user(access_token="test-token", id_token=None, payload=None)

    assert models.User.objects.exists() is False


def test_models_oidc_user_getter_empty_sub(django_assert_num_queries, monkeypatch):
    """The user's info contains a sub, but it's an empty string."""
    klass = OIDCAuthenticationBackend()

    def get_userinfo_mocked(*args):
        return {"test": "123", "sub": ""}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    with (
        django_assert_num_queries(0),
        pytest.raises(
            SuspiciousOperation,
            match="User info contained no recognizable user identification",
        ),
    ):
        klass.get_or_create_user(access_token="test-token", id_token=None, payload=None)

    assert models.User.objects.exists() is False


def test_authentication_get_inactive_user(monkeypatch):
    """Test an exception is raised when attempting to authenticate inactive user."""

    klass = OIDCAuthenticationBackend()
    db_user = UserFactory(is_active=False)

    def get_userinfo_mocked(*args):
        return {"sub": db_user.sub}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    with (
        pytest.raises(
            SuspiciousOperation,
            match="User account is disabled",
        ),
    ):
        klass.get_or_create_user(access_token="test-token", id_token=None, payload=None)


def test_finds_user_by_sub(django_assert_num_queries):
    """Should return user when found by sub, and email is matching."""

    klass = OIDCAuthenticationBackend()
    db_user = UserFactory(email="foo@mail.com")

    with django_assert_num_queries(1):
        user = klass.get_existing_user(db_user.sub, db_user.email)

    assert user == db_user


def test_finds_user_when_email_fallback_disabled(django_assert_num_queries, settings):
    """Should not return a user when not found by sub, and email fallback is disabled."""

    settings.OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION = False

    klass = OIDCAuthenticationBackend()
    db_user = UserFactory(email="foo@mail.com")

    with django_assert_num_queries(1):
        user = klass.get_existing_user("wrong-sub", db_user.email)

    assert user is None


def test_finds_user_when_email_is_none(django_assert_num_queries, settings):
    """Should not return a user when not found by sub, and email is empty."""

    settings.OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION = True

    klass = OIDCAuthenticationBackend()
    UserFactory(email="foo@mail.com")

    empty_email = ""

    with django_assert_num_queries(1):
        user = klass.get_existing_user("wrong-sub", empty_email)

    assert user is None


def test_finds_user_by_email(django_assert_num_queries, settings):
    """Should return user when found by email, and sub is not matching."""

    settings.OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION = True

    klass = OIDCAuthenticationBackend()
    db_user = UserFactory(email="foo@mail.com")

    with django_assert_num_queries(2):
        user = klass.get_existing_user("wrong-sub", db_user.email)

    assert user == db_user


def test_finds_user_case_insensitive_email(django_assert_num_queries, settings):
    """Should match email case-insensitively when falling back to email."""
    settings.OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION = True

    klass = OIDCAuthenticationBackend()
    db_user = UserFactory(email="foo@mail.com")

    with django_assert_num_queries(2):
        user = klass.get_existing_user("wrong-sub", "FOO@MAIL.COM")

    assert user == db_user


def test_finds_user_multiple_users_same_email(django_assert_num_queries, settings):
    """Should handle multiple users with same email appropriately."""

    settings.OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION = True

    klass = OIDCAuthenticationBackend()
    email = "foo@mail.com"
    UserFactory(email=email)
    UserFactory(email=email)  # Second user with same email

    with (
        django_assert_num_queries(2),
        pytest.raises(
            SuspiciousOperation,
            match="Multiple user accounts share a common email.",
        ),
    ):
        klass.get_existing_user("wrong-sub", email)


def test_finds_user_whitespace_email(django_assert_num_queries, settings):
    """Should not match emails with whitespace."""

    settings.OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION = True
    settings.OIDC_CREATE_USER = False

    klass = OIDCAuthenticationBackend()
    UserFactory(email="foo@mail.com")

    with django_assert_num_queries(2):
        user = klass.get_existing_user("wrong-sub", " foo@mail.com ")

    assert user is None


@pytest.mark.parametrize(
    "email",
    [
        "john.doe@ｅxample.com",  # Fullwidth character in domain
        "john.doe@еxample.com",  # Cyrillic 'е' in domain
        "john.doe@exаmple.com",  # Cyrillic 'а' (a) in domain
    ],
)
def test_authentication_getter_existing_user_email_tricky(email, monkeypatch, settings):
    """Test email matching security against visually similar but non-ASCII domains.

    Validates that emails with Unicode characters that visually resemble ASCII
    (homoglyphs) are treated as distinct from their ASCII counterparts for security,
    per RFC compliance requirements for hostnames.
    """

    settings.OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION = True

    klass = OIDCAuthenticationBackend()
    db_user = UserFactory(email="john.doe@example.com")

    def get_userinfo_mocked(*args):
        return {"sub": "123", "email": email}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user(
        access_token="test-token", id_token=None, payload=None
    )

    assert user != db_user


@pytest.mark.parametrize(
    "given_name, usual_name, email",
    [
        ("Jack", "Doe", "john.doe@example.com"),
        ("John", "Duy", "john.doe@example.com"),
        ("John", "Doe", "jack.duy@example.com"),
        ("Jack", "Duy", "jack.duy@example.com"),
    ],
)
def test_authentication_getter_existing_user_change_fields(
    given_name, usual_name, email, django_assert_num_queries, monkeypatch
):
    """It should update the email or name fields on the user when they change."""

    klass = OIDCAuthenticationBackend()
    user = UserFactory(
        full_name="John Doe", short_name="John", email="john.doe@example.com"
    )

    def get_userinfo_mocked(*args):
        return {
            "sub": user.sub,
            "email": email,
            "given_name": given_name,
            "usual_name": usual_name,
        }

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    old_updated_at = user.updated_at

    # One and only one additional update query when a field has changed
    # Note: .save() triggers uniqueness validation queries for unique fields,
    # adding extra SELECT queries before the UPDATE:
    #   - unique=True on 'sub'
    #   - unique=True on 'admin_email'
    #   - partial unique index 'unique_email_when_sub_is_null'
    # Plus one more UPDATE for the explicit `updated_at` bump (see
    # `update_user_if_needed`'s docstring).
    with django_assert_num_queries(6):
        authenticated_user = klass.get_or_create_user(
            access_token="test-token", id_token=None, payload=None
        )

    assert user == authenticated_user
    user.refresh_from_db()
    assert user.email == email
    assert user.full_name == f"{given_name:s} {usual_name:s}"
    assert user.short_name == given_name
    assert user.updated_at > old_updated_at


@pytest.mark.parametrize(
    "user_info, expected_name",
    [
        ({"given_name": "John", "family_name": "Doe"}, "John Doe"),
        (
            {"given_name": "John", "middle_name": "M", "family_name": "Doe"},
            "John M Doe",
        ),
        ({"family_name": "Doe"}, "Doe"),
        ({"given_name": "", "family_name": ""}, None),
        ({}, None),
    ],
)
def test_compute_full_name(user_info, expected_name, settings):
    """Test full name computation from OIDC user info fields."""
    settings.OIDC_USERINFO_FULLNAME_FIELDS = [
        "given_name",
        "middle_name",
        "family_name",
    ]
    klass = OIDCAuthenticationBackend()
    assert klass.compute_full_name(user_info) == expected_name


def test_compute_full_name_no_fields(settings):
    """Test full name computation with empty field configuration."""
    settings.OIDC_USERINFO_FULLNAME_FIELDS = []
    klass = OIDCAuthenticationBackend()
    assert klass.compute_full_name({"given_name": "John"}) is None


@pytest.mark.parametrize(
    "user_info, expected_language",
    [
        ({"locale": "nl"}, "nl-nl"),
        ({"locale": "nl-NL"}, "nl-nl"),
        ({"locale": "FR-fr"}, "fr-fr"),
        # "en" doesn't double up like the others: the supported code is "en-us".
        ({"locale": "en"}, "en-us"),
        ({"locale": "pt-BR"}, None),  # unsupported language
        ({"locale": ""}, None),
        ({"locale": ["nl"]}, None),  # non-string claim
        ({}, None),
    ],
)
def test_compute_language(user_info, expected_language):
    """Test language resolution from the OIDC "locale" claim."""
    klass = OIDCAuthenticationBackend()
    assert klass.compute_language(user_info) == expected_language


def test_get_extra_claims_includes_language_when_supported():
    """The "language" extra claim is only present for a supported locale."""
    klass = OIDCAuthenticationBackend()
    assert (
        klass.get_extra_claims({"locale": "nl", "given_name": "John"})["language"]
        == "nl-nl"
    )
    assert "language" not in klass.get_extra_claims({"locale": "xx"})
    assert "language" not in klass.get_extra_claims({})


def test_compute_language_confirms_supported_english_locale():
    """A confirmed "en"/"en-us" locale must be recorded as IdP-confirmed in the session."""
    klass = OIDCAuthenticationBackend()
    klass.request = SimpleNamespace(session={})

    language = klass.compute_language({"locale": "en"})

    assert language == "en-us"
    assert (
        klass.request.session[OIDCAuthenticationBackend.LANGUAGE_CONFIRMED_SESSION_KEY]
        is True
    )


@pytest.mark.parametrize(
    "user_info",
    [
        {},  # no locale claim at all
        {"locale": "pt-BR"},  # unsupported locale
        {"locale": ["nl"]},  # rejected, non-string locale
    ],
)
def test_compute_language_clears_confirmation_for_absent_or_rejected_locale(
    user_info,
):
    """A previously confirmed session locale must clear to False on a missing/rejected claim."""
    klass = OIDCAuthenticationBackend()
    klass.request = SimpleNamespace(
        session={OIDCAuthenticationBackend.LANGUAGE_CONFIRMED_SESSION_KEY: True}
    )

    klass.compute_language(user_info)

    assert (
        klass.request.session[OIDCAuthenticationBackend.LANGUAGE_CONFIRMED_SESSION_KEY]
        is False
    )


def test_compute_language_skips_session_write_without_request():
    """No request (e.g. calling compute_language directly) must not raise."""
    klass = OIDCAuthenticationBackend()
    assert klass.compute_language({"locale": "nl"}) == "nl-nl"


@pytest.mark.parametrize(
    "claims",
    [
        {"email": "john.doe@example.com"},  # Same data - no change needed
        {"email": ""},  # Empty strings should not override
        {"non_related_field": "foo"},  # Unrelated fields should be ignored
        {},  # Empty claims should not affect user
        {"email": None},  # None values should be ignored
    ],
)
def test_update_user_when_no_update_needed(django_assert_num_queries, claims):
    """Test that user attributes remain unchanged when claims don't require updates."""

    user = UserFactory(
        full_name="John Doe", short_name="John", email="john.doe@example.com"
    )

    klass = OIDCAuthenticationBackend()

    with django_assert_num_queries(0):
        klass.update_user_if_needed(user, claims)

    user.refresh_from_db()

    assert user.email == "john.doe@example.com"


@mock.patch.object(OIDCAuthenticationBackend, "signup_to_marketing_email")
def test_marketing_signup_new_user_enabled(mock_signup, monkeypatch, settings):
    """Test marketing signup for new user with settings enabled."""
    settings.SIGNUP_NEW_USER_TO_MARKETING_EMAIL = True

    klass = OIDCAuthenticationBackend()
    email = "test@example.com"

    def get_userinfo_mocked(*args):
        return {"sub": "123", "email": email}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user("test-token", None, None)

    assert user.email == email
    mock_signup.assert_called_once_with(email)


@mock.patch.object(OIDCAuthenticationBackend, "signup_to_marketing_email")
def test_marketing_signup_new_user_disabled(mock_signup, monkeypatch, settings):
    """Test no marketing signup for new user with settings disabled."""
    settings.SIGNUP_NEW_USER_TO_MARKETING_EMAIL = False

    klass = OIDCAuthenticationBackend()
    email = "test@example.com"

    def get_userinfo_mocked(*args):
        return {"sub": "123", "email": email}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user("test-token", None, None)

    assert user.email == email
    mock_signup.assert_not_called()


@mock.patch.object(OIDCAuthenticationBackend, "signup_to_marketing_email")
def test_marketing_signup_new_user_default_disabled(mock_signup, monkeypatch):
    """Test no marketing signup for new user with settings by default disabled."""

    klass = OIDCAuthenticationBackend()
    email = "test@example.com"

    def get_userinfo_mocked(*args):
        return {"sub": "123", "email": email}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user("test-token", None, None)

    assert user.email == email
    mock_signup.assert_not_called()


@pytest.mark.parametrize(
    "is_signup_enabled",
    [True, False],
)
@mock.patch.object(OIDCAuthenticationBackend, "signup_to_marketing_email")
def test_marketing_signup_existing_user(
    mock_signup, monkeypatch, settings, is_signup_enabled
):
    """Test no marketing signup for existing user regardless of settings."""

    settings.SIGNUP_NEW_USER_TO_MARKETING_EMAIL = is_signup_enabled

    klass = OIDCAuthenticationBackend()
    db_user = UserFactory(email="test@example.com")

    def get_userinfo_mocked(*args):
        return {"sub": db_user.sub, "email": db_user.email}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user("test-token", None, None)
    assert user == db_user
    mock_signup.assert_not_called()


@mock.patch("core.authentication.backends.get_marketing_service")
def test_signup_to_marketing_email_success(mock_marketing):
    """Test successful marketing signup."""

    email = "test@example.com"

    # Call the method
    OIDCAuthenticationBackend.signup_to_marketing_email(email)

    # Verify service interaction
    mock_service = mock_marketing.return_value
    mock_service.create_contact.assert_called_once()


@pytest.mark.parametrize(
    "error",
    [
        ImportError,
        ImproperlyConfigured,
    ],
)
@mock.patch("core.authentication.backends.get_marketing_service")
def test_marketing_signup_handles_service_initialization_errors(
    mock_marketing, error, settings
):
    """Tests errors that occur when trying to get/initialize the marketing service."""
    settings.SIGNUP_NEW_USER_TO_MARKETING_EMAIL = True

    mock_marketing.side_effect = error

    # Should not raise any exception
    OIDCAuthenticationBackend.signup_to_marketing_email("test@example.com")


@pytest.mark.parametrize(
    "error",
    [
        marketing.ContactCreationError,
        ImproperlyConfigured,
        ImportError,
    ],
)
@mock.patch("core.authentication.backends.get_marketing_service")
def test_marketing_signup_handles_contact_creation_errors(
    mock_marketing, error, settings
):
    """Tests errors that occur during the contact creation process."""

    settings.SIGNUP_NEW_USER_TO_MARKETING_EMAIL = True
    mock_marketing.return_value.create_contact.side_effect = error

    # Should not raise any exception
    OIDCAuthenticationBackend.signup_to_marketing_email("test@example.com")


def test_get_extra_claims_picks_up_picture():
    """get_extra_claims should expose a valid "picture" claim from user_info."""
    klass = OIDCAuthenticationBackend()
    user_info = {
        "given_name": "Foo",
        "usual_name": "Bar",
        "picture": "https://example.com/avatar.jpg",
    }

    assert (
        klass.get_extra_claims(user_info)["picture"] == "https://example.com/avatar.jpg"
    )


@pytest.mark.parametrize(
    "picture",
    [
        None,
        123,
        ["https://example.com/avatar.jpg"],
        "not-a-url",
        "https://" + "a" * 500 + ".com",
        "ftp://example.com/avatar.jpg",
    ],
)
def test_sanitize_picture_claim_rejects_invalid_values(picture):
    """
    An invalid "picture" claim (wrong type, malformed URL, non-http(s) scheme,
    or too long for the User.picture field) should be dropped rather than
    raised, so that a broken claim can't crash the login with a
    ValidationError from User.full_clean().
    """
    assert sanitize_picture_claim(picture) is None


def test_sanitize_picture_claim_accepts_valid_url():
    """A well-formed, appropriately-sized URL claim should be returned as-is."""
    url = "https://example.com/avatar.jpg"
    assert sanitize_picture_claim(url) == url


def test_sanitize_picture_claim_accepts_url_at_exact_max_length():
    """A URL exactly at PICTURE_MAX_LENGTH should be accepted, not rejected off-by-one."""
    base = "https://example.com/"
    url = base + "a" * (PICTURE_MAX_LENGTH - len(base))
    assert len(url) == PICTURE_MAX_LENGTH
    assert sanitize_picture_claim(url) == url


def test_update_user_if_needed_clears_stale_picture(django_assert_num_queries):
    """A previously stored picture should be cleared once the IdP stops sending it."""
    user = UserFactory(picture="https://example.com/old-pic.png")
    klass = OIDCAuthenticationBackend()
    old_updated_at = user.updated_at

    # save() -> full_clean() -> validate_unique() on the unique `sub` field adds
    # a SELECT + savepoint on top of the UPDATE itself, plus the SAVEPOINT/RELEASE
    # pair from the `transaction.atomic()` wrapping this clear-and-save.
    with django_assert_num_queries(6):  # clear picture
        klass.update_user_if_needed(user, {"email": user.email, "picture": None})

    user.refresh_from_db()
    assert user.picture is None
    assert user.updated_at > old_updated_at


def test_update_user_if_needed_skips_updated_at_bump_for_blocked_immutable_sub(
    django_assert_num_queries,
):
    """
    An attempted change to the immutable `sub` field is blocked (and logged)
    by the base class, not actually applied — `claim_changed` must exclude
    it too, otherwise `updated_at` gets a spurious bump for a user row the
    base class didn't touch.
    """
    user = UserFactory(sub="original-sub")
    klass = OIDCAuthenticationBackend()

    with django_assert_num_queries(0):
        klass.update_user_if_needed(user, {"sub": "attempted-new-sub"})

    user.refresh_from_db()
    assert user.sub == "original-sub"


def test_update_user_if_needed_keeps_picture_when_unchanged(django_assert_num_queries):
    """No extra query should be issued when the picture claim hasn't changed."""
    picture = "https://example.com/pic.png"
    user = UserFactory(picture=picture)
    klass = OIDCAuthenticationBackend()

    with django_assert_num_queries(0):
        klass.update_user_if_needed(user, {"email": user.email, "picture": picture})

    user.refresh_from_db()
    assert user.picture == picture


def test_update_user_if_needed_noop_when_claim_and_field_already_none(
    django_assert_num_queries,
):
    """No query (and no transaction) when a None claim matches an already-empty field."""
    user = UserFactory(picture=None)
    klass = OIDCAuthenticationBackend()

    with django_assert_num_queries(0):
        klass.update_user_if_needed(user, {"email": user.email, "picture": None})

    user.refresh_from_db()
    assert user.picture is None


def test_update_user_if_needed_updates_picture_to_new_value():
    """
    A picture claim that changes to a new, different value should be applied
    through the base class's regular set-and-save path (not the stale-clearing
    override, which only handles the claim going from a value to None).
    """
    user = UserFactory(picture="https://example.com/old.png")
    klass = OIDCAuthenticationBackend()

    klass.update_user_if_needed(
        user, {"email": user.email, "picture": "https://example.com/new.png"}
    )

    user.refresh_from_db()
    assert user.picture == "https://example.com/new.png"


def test_get_or_create_user_persists_locale_and_picture_for_new_user(monkeypatch):
    """
    A full login for a brand-new user with "locale" and "picture" claims in
    user_info should end up with both applied to the persisted User, exercising
    the real get_extra_claims -> create_user path rather than calling
    compute_language/sanitize_picture_claim/update_user_if_needed in isolation.
    """
    klass = OIDCAuthenticationBackend()

    def get_userinfo_mocked(*args):
        return {
            "sub": "new-user-sub",
            "email": "new.user@example.com",
            "locale": "nl-NL",
            "picture": "https://example.com/avatar.jpg",
        }

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user(
        access_token="test-token", id_token=None, payload=None
    )

    assert user.language == "nl-nl"
    assert user.picture == "https://example.com/avatar.jpg"


def test_get_or_create_user_persists_locale_and_picture_for_existing_user(
    monkeypatch,
):
    """Same as above, but for a returning user going through the update path."""
    db_user = UserFactory(sub="existing-user-sub", language="en-us", picture=None)
    klass = OIDCAuthenticationBackend()

    def get_userinfo_mocked(*args):
        return {
            "sub": db_user.sub,
            "email": db_user.email,
            "locale": "de",
            "picture": "https://example.com/new-avatar.jpg",
        }

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user(
        access_token="test-token", id_token=None, payload=None
    )

    assert user == db_user
    user.refresh_from_db()
    assert user.language == "de-de"
    assert user.picture == "https://example.com/new-avatar.jpg"


def _real_request_with_session():
    """A real Django session, as opposed to the `SimpleNamespace` stand-in used above."""
    request = RequestFactory().get("/")
    SessionMiddleware(lambda r: None).process_request(request)
    request.session.save()
    return request


def test_get_or_create_user_confirms_language_in_session_on_real_path(monkeypatch):
    """Exercises the session side-effect through the real `get_or_create_user` path."""
    klass = OIDCAuthenticationBackend()
    klass.request = _real_request_with_session()

    def get_userinfo_mocked(*args):
        return {"sub": "real-path-sub", "email": "new@example.com", "locale": "en"}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    klass.get_or_create_user(access_token="test-token", id_token=None, payload=None)

    assert (
        klass.request.session[OIDCAuthenticationBackend.LANGUAGE_CONFIRMED_SESSION_KEY]
        is True
    )


def test_get_or_create_user_clears_session_confirmation_on_real_path(monkeypatch):
    """A confirmed session flips back to False on a later login with a missing/rejected claim."""
    db_user = UserFactory(sub="real-path-existing-sub", language="nl-nl")
    klass = OIDCAuthenticationBackend()
    klass.request = _real_request_with_session()
    klass.request.session[OIDCAuthenticationBackend.LANGUAGE_CONFIRMED_SESSION_KEY] = (
        True
    )

    def get_userinfo_mocked(*args):
        return {"sub": db_user.sub, "email": db_user.email}  # no "locale" claim

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    klass.get_or_create_user(access_token="test-token", id_token=None, payload=None)

    assert (
        klass.request.session[OIDCAuthenticationBackend.LANGUAGE_CONFIRMED_SESSION_KEY]
        is False
    )


def test_get_or_create_user_clears_stale_picture_for_existing_user(monkeypatch):
    """
    A returning user whose IdP stops sending a "picture" claim should have it
    cleared, exercising the real get_extra_claims -> update_user_if_needed path
    (not calling update_user_if_needed directly with a hand-built claims dict).
    """
    db_user = UserFactory(
        sub="existing-user-sub", picture="https://example.com/old-avatar.jpg"
    )
    klass = OIDCAuthenticationBackend()

    def get_userinfo_mocked(*args):
        return {"sub": db_user.sub, "email": db_user.email}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user(
        access_token="test-token", id_token=None, payload=None
    )

    assert user == db_user
    user.refresh_from_db()
    assert user.picture is None
