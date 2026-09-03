from app.crypto import ALPHABET, coincidence_index, normalize_text


def test_normalization_preserves_enye_and_removes_accents():
    assert normalize_text("¡Mañana habrá análisis!") == "MAÑANAHABRAANALISIS"


def test_spanish_alphabet_has_27_letters():
    assert len(ALPHABET) == 27


def test_coincidence_index_handles_short_text():
    assert coincidence_index("") == 0
    assert coincidence_index("A") == 0

