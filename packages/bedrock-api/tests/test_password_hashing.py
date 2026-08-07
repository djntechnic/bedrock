"""
Module:  test_password_hashing.py
Layer:   bedrock-api/tests
Desc:    Direct tests for `hash_password` / `verify_password`.

         These existed only implicitly before: every auth test hashes a
         password on its way to testing something else, so when the bcrypt
         backend broke, 23 tests across four files went red at once and every
         one of them reported a misleading cause — a 409 on registration, or
         "password cannot be longer than 72 bytes" for a five-character
         password.

         The point of this file is the diagnosis. A failure here says the
         hashing backend is broken, in one test, in the file named after it.
"""
from __future__ import annotations

import pytest

from bedrock.services.user_service import hash_password, verify_password


class TestRoundTrip:
    def test_hash_then_verify(self):
        hashed = hash_password("correct horse battery staple")
        assert verify_password("correct horse battery staple", hashed) is True

    def test_wrong_password_fails(self):
        hashed = hash_password("correct horse battery staple")
        assert verify_password("wrong", hashed) is False

    def test_hash_is_not_the_plaintext(self):
        assert hash_password("hunter2") != "hunter2"

    def test_hashes_are_salted(self):
        """Two hashes of one password must differ, or the salt is not applied."""
        assert hash_password("hunter2") != hash_password("hunter2")

    def test_uses_bcrypt(self):
        assert hash_password("hunter2").startswith("$2")


class TestBackendIsUsable:
    """The bcrypt backend must actually work, not just import.

    passlib traps a version-detection failure and carries on, so an
    incompatible bcrypt is invisible until the first hash. That is how a
    dependency resolution turned into 23 failures reporting a length error on
    a short password.
    """

    @pytest.mark.parametrize(
        "password",
        ["a", "short", "a normal length password", "ünïcödé pässwörd", "x" * 64],
    )
    def test_ordinary_passwords_hash(self, password):
        assert verify_password(password, hash_password(password)) is True

    def test_no_version_detection_fallback(self):
        """passlib must have identified the backend rather than guessed.

        When detection fails passlib leaves the backend in the degraded state
        that triggers the over-length probe. Asserting the version is readable
        catches the incompatibility at its source rather than downstream.
        """
        import bcrypt

        assert hasattr(bcrypt, "__about__"), (
            "passlib 1.7.x reads bcrypt.__about__.__version__; this bcrypt "
            "removed it, so passlib cannot detect the backend and every hash "
            "will fail. See the pin in pyproject.toml."
        )


class TestVerifyIsDefensive:
    """`verify_password` swallows malformed stored hashes rather than raising."""

    @pytest.mark.parametrize("stored", ["", "not-a-hash", "$2b$12$tooshort"])
    def test_malformed_hash_returns_false(self, stored):
        assert verify_password("hunter2", stored) is False
