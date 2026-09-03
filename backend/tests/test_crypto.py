from fastapi.testclient import TestClient

from app.crypto import (
    ALPHABET,
    affine_encrypt,
    caesar_encrypt,
    coincidence_index,
    normalize_text,
    vigenere_encrypt,
)
from app.main import app


client = TestClient(app)


def test_normalization_preserves_enye_and_removes_accents():
    assert normalize_text("¡Mañana habrá análisis!") == "MAÑANAHABRAANALISIS"


def test_spanish_alphabet_has_27_letters():
    assert len(ALPHABET) == 27


def test_coincidence_index_handles_short_text():
    assert coincidence_index("") == 0
    assert coincidence_index("A") == 0


def test_encryption_algorithms_return_compact_uppercase_text():
    text = normalize_text("Habla, mañana")
    assert caesar_encrypt(normalize_text("HABLA"), 5) == "MFGPF"
    for encrypted in (
        caesar_encrypt(text, 5),
        affine_encrypt(text, 5, 7),
        vigenere_encrypt(text, "NUBE"),
    ):
        assert encrypted == normalize_text(encrypted)
        assert len(encrypted) == len(text)


def test_encrypt_endpoint_normalizes_plaintext():
    response = client.post(
        "/api/v1/encrypt",
        json={"plaintext": "¡Habla, mañana!", "cipher": "caesar", "shift": 5},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["normalized_text"] == "HABLAMAÑANA"
    assert body["ciphertext"] == normalize_text(body["ciphertext"])


def test_encrypt_endpoint_rejects_invalid_keys():
    invalid_affine = client.post(
        "/api/v1/encrypt",
        json={"plaintext": "TEXTO", "cipher": "affine", "multiplier": 3, "offset": 7},
    )
    invalid_caesar = client.post(
        "/api/v1/encrypt",
        json={"plaintext": "TEXTO", "cipher": "caesar", "shift": 27},
    )
    assert invalid_affine.status_code == 422
    assert invalid_caesar.status_code == 422
