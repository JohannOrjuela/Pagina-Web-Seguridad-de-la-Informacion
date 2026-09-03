from typing import Literal

from pydantic import BaseModel, Field


CipherMode = Literal["auto", "caesar", "affine", "vigenere"]
EncryptionCipher = Literal["caesar", "affine", "vigenere"]


class AnalysisRequest(BaseModel):
    ciphertext: str = Field(min_length=1, max_length=25_000)
    mode: CipherMode = "auto"


class FrequencyItem(BaseModel):
    letter: str
    count: int
    percentage: float


class Candidate(BaseModel):
    cipher: str
    key: str
    plaintext: str
    score: float
    detail: str


class LengthCandidate(BaseModel):
    length: int
    average_ic: float
    kasiski_hits: int


class AnalysisResponse(BaseModel):
    normalized_text: str
    length: int
    coincidence_index: float
    classification: str
    explanation: str
    frequencies: list[FrequencyItem]
    candidates: list[Candidate]
    key_lengths: list[LengthCandidate]


class EncryptionRequest(BaseModel):
    plaintext: str = Field(min_length=1, max_length=25_000)
    cipher: EncryptionCipher
    shift: int | None = None
    multiplier: int | None = None
    offset: int | None = None
    keyword: str | None = Field(default=None, max_length=64)


class EncryptionResponse(BaseModel):
    normalized_text: str
    ciphertext: str
    cipher: str
    key: str
    length: int
