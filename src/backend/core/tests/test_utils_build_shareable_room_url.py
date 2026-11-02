"""
Test the build_shareable_room_url util function.
"""

from core.utils import build_shareable_room_url


def test_build_shareable_room_url_appends_silent_login_false():
    """The generated URL should disable silent OIDC login."""
    url = build_shareable_room_url("https://example.com", "abc-defg-hij")

    assert url == "https://example.com/abc-defg-hij?silentLogin=false"
