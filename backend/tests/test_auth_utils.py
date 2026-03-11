"""Unit tests for auth utility functions (hash, verify, JWT tokens)."""
from datetime import timedelta

import pytest
from jose import ExpiredSignatureError

from app.auth import hash_password, verify_password, create_access_token, decode_access_token


def test_hash_verify_roundtrip():
    hashed = hash_password("Test1234")
    assert verify_password("Test1234", hashed) is True


def test_verify_wrong_password():
    hashed = hash_password("Test1234")
    assert verify_password("Wrong999", hashed) is False


def test_72_char_truncation():
    long_pw = "A" * 100
    hashed = hash_password(long_pw)
    assert verify_password(long_pw, hashed) is True
    # bcrypt truncates at 72 chars, so first 72 chars should also verify
    assert verify_password(long_pw[:72], hashed) is True


def test_create_decode_token_roundtrip():
    data = {"sub": "alice", "user_id": 42}
    token = create_access_token(data)
    payload = decode_access_token(token)
    assert payload["sub"] == "alice"
    assert payload["user_id"] == 42


def test_token_has_exp_claim():
    token = create_access_token({"sub": "test"})
    payload = decode_access_token(token)
    assert "exp" in payload


def test_token_custom_expiry():
    token = create_access_token({"sub": "test"}, expires_delta=timedelta(minutes=5))
    payload = decode_access_token(token)
    assert "exp" in payload


def test_expired_token_raises():
    token = create_access_token({"sub": "test"}, expires_delta=timedelta(seconds=-1))
    with pytest.raises(ExpiredSignatureError):
        decode_access_token(token)
