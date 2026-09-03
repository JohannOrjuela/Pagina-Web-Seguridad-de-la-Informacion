import math
import unicodedata
from collections import Counter, defaultdict

from .schemas import Candidate, FrequencyItem, LengthCandidate


ALPHABET = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"
MODULUS = len(ALPHABET)
INDEX = {letter: position for position, letter in enumerate(ALPHABET)}

# Spanish letter frequencies normalized over the 27-letter alphabet.
SPANISH_FREQUENCIES = {
    "A": 12.53, "B": 1.42, "C": 4.68, "D": 5.86, "E": 13.68,
    "F": 0.69, "G": 1.01, "H": 0.70, "I": 6.25, "J": 0.44,
    "K": 0.02, "L": 4.97, "M": 3.15, "N": 6.71, "Ñ": 0.31,
    "O": 8.68, "P": 2.51, "Q": 0.88, "R": 6.87, "S": 7.98,
    "T": 4.63, "U": 3.93, "V": 0.90, "W": 0.01, "X": 0.22,
    "Y": 0.90, "Z": 0.52,
}

COMMON_FRAGMENTS = (
    "QUE", "LOS", "LAS", "DEL", "CON", "POR", "PARA", "UNA", "COMO",
    "ESTA", "ACION", "MENTE", "EN", "DE", "LA", "EL",
)


def normalize_text(value: str) -> str:
    marker = "#"
    prepared = value.upper().replace("Ñ", marker)
    decomposed = unicodedata.normalize("NFD", prepared)
    unaccented = "".join(char for char in decomposed if unicodedata.category(char) != "Mn")
    restored = unaccented.replace(marker, "Ñ")
    return "".join(char for char in restored if char in INDEX)


def coincidence_index(text: str) -> float:
    length = len(text)
    if length < 2:
        return 0.0
    return sum(count * (count - 1) for count in Counter(text).values()) / (
        length * (length - 1)
    )


def frequencies(text: str) -> list[FrequencyItem]:
    counts = Counter(text)
    length = len(text) or 1
    return [
        FrequencyItem(
            letter=letter,
            count=counts.get(letter, 0),
            percentage=round(counts.get(letter, 0) * 100 / length, 3),
        )
        for letter in ALPHABET
    ]


def classify(index: float) -> tuple[str, str]:
    if index >= 0.06:
        return (
            "Monoalfabético probable",
            "El IC conserva el patrón del idioma; conviene probar César y Afín.",
        )
    if index <= 0.052:
        return (
            "Polialfabético probable",
            "El IC está aplanado; conviene estimar la longitud de una clave Vigenère.",
        )
    return (
        "Zona ambigua",
        "La longitud o distribución no permiten decidir solo con el IC; compara los ataques.",
    )


def _chi_squared(text: str) -> float:
    if not text:
        return float("inf")
    counts = Counter(text)
    total_reference = sum(SPANISH_FREQUENCIES.values())
    score = 0.0
    for letter in ALPHABET:
        expected = len(text) * SPANISH_FREQUENCIES[letter] / total_reference
        score += (counts.get(letter, 0) - expected) ** 2 / max(expected, 1e-9)
    fragment_bonus = sum(text.count(fragment) * len(fragment) for fragment in COMMON_FRAGMENTS)
    return score - fragment_bonus * 1.8


def _caesar_decrypt(text: str, shift: int) -> str:
    return "".join(ALPHABET[(INDEX[letter] - shift) % MODULUS] for letter in text)


def caesar_candidates(text: str, limit: int = 6) -> list[Candidate]:
    ranked = []
    for shift in range(1, MODULUS):
        plaintext = _caesar_decrypt(text, shift)
        ranked.append(
            Candidate(
                cipher="César",
                key=f"k = {shift}",
                plaintext=plaintext,
                score=round(_chi_squared(plaintext), 3),
                detail=f"Rotación inversa de {shift} posiciones.",
            )
        )
    return sorted(ranked, key=lambda item: item.score)[:limit]


def affine_candidates(text: str, limit: int = 6) -> list[Candidate]:
    ranked = []
    valid_multipliers = [value for value in range(MODULUS) if math.gcd(value, MODULUS) == 1]
    for multiplier in valid_multipliers:
        inverse = pow(multiplier, -1, MODULUS)
        for offset in range(MODULUS):
            plaintext = "".join(
                ALPHABET[(inverse * (INDEX[letter] - offset)) % MODULUS]
                for letter in text
            )
            ranked.append(
                Candidate(
                    cipher="Afín",
                    key=f"a = {multiplier}, b = {offset}",
                    plaintext=plaintext,
                    score=round(_chi_squared(plaintext), 3),
                    detail=f"Inverso modular de a: {inverse} (mod 27).",
                )
            )
    return sorted(ranked, key=lambda item: item.score)[:limit]


def _kasiski_hits(text: str, candidate_length: int) -> int:
    positions: dict[str, list[int]] = defaultdict(list)
    for size in (3, 4, 5):
        for position in range(len(text) - size + 1):
            positions[text[position : position + size]].append(position)
    hits = 0
    for occurrences in positions.values():
        if len(occurrences) < 2:
            continue
        for left, right in zip(occurrences, occurrences[1:]):
            if (right - left) % candidate_length == 0:
                hits += 1
    return hits


def estimate_key_lengths(text: str, maximum: int = 12) -> list[LengthCandidate]:
    results = []
    upper = min(maximum, max(2, len(text) // 8))
    for length in range(2, upper + 1):
        columns = [text[offset::length] for offset in range(length)]
        average_ic = sum(coincidence_index(column) for column in columns) / length
        results.append(
            LengthCandidate(
                length=length,
                average_ic=round(average_ic, 6),
                kasiski_hits=_kasiski_hits(text, length),
            )
        )
    return sorted(
        results,
        key=lambda item: (-(item.kasiski_hits * 0.012 + item.average_ic), item.length),
    )


def _column_shift(column: str) -> int:
    return min(range(MODULUS), key=lambda shift: _chi_squared(_caesar_decrypt(column, shift)))


def _vigenere_decrypt(text: str, shifts: list[int]) -> str:
    return "".join(
        ALPHABET[(INDEX[letter] - shifts[position % len(shifts)]) % MODULUS]
        for position, letter in enumerate(text)
    )


def vigenere_candidates(text: str, limit: int = 5) -> tuple[list[Candidate], list[LengthCandidate]]:
    lengths = estimate_key_lengths(text)
    ranked = []
    for item in lengths[:8]:
        shifts = [_column_shift(text[offset::item.length]) for offset in range(item.length)]
        key = "".join(ALPHABET[shift] for shift in shifts)
        plaintext = _vigenere_decrypt(text, shifts)
        adjusted_score = _chi_squared(plaintext) - item.kasiski_hits * 3
        ranked.append(
            Candidate(
                cipher="Vigenère",
                key=key,
                plaintext=plaintext,
                score=round(adjusted_score, 3),
                detail=f"Longitud {item.length}; IC medio por columnas {item.average_ic:.4f}.",
            )
        )
    return sorted(ranked, key=lambda item: item.score)[:limit], lengths[:6]


def analyze_candidates(text: str, mode: str, index: float) -> tuple[list[Candidate], list[LengthCandidate]]:
    if mode == "caesar":
        return caesar_candidates(text), []
    if mode == "affine":
        return affine_candidates(text), []
    if mode == "vigenere":
        return vigenere_candidates(text)

    if index >= 0.06:
        combined = caesar_candidates(text, 4) + affine_candidates(text, 4)
        return sorted(combined, key=lambda item: item.score)[:8], []

    return vigenere_candidates(text)

