import math

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .crypto import (
    analyze_candidates,
    affine_encrypt,
    caesar_encrypt,
    classify,
    coincidence_index,
    frequencies,
    normalize_text,
    vigenere_encrypt,
)
from .schemas import AnalysisRequest, AnalysisResponse, EncryptionRequest, EncryptionResponse


app = FastAPI(
    title="CriptaLab API",
    version="1.0.0",
    description="Análisis didáctico de cifrados clásicos sobre el alfabeto español de 27 letras.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/analyze", response_model=AnalysisResponse)
def analyze(payload: AnalysisRequest) -> AnalysisResponse:
    normalized = normalize_text(payload.ciphertext)
    if len(normalized) < 2:
        raise HTTPException(
            status_code=422,
            detail="El criptograma debe contener al menos dos letras del alfabeto español.",
        )

    index = coincidence_index(normalized)
    classification, explanation = classify(index)
    candidates, key_lengths = analyze_candidates(normalized, payload.mode, index)
    return AnalysisResponse(
        normalized_text=normalized,
        length=len(normalized),
        coincidence_index=round(index, 6),
        classification=classification,
        explanation=explanation,
        frequencies=frequencies(normalized),
        candidates=candidates,
        key_lengths=key_lengths,
    )


@app.post("/api/v1/encrypt", response_model=EncryptionResponse)
def encrypt(payload: EncryptionRequest) -> EncryptionResponse:
    normalized = normalize_text(payload.plaintext)
    if not normalized:
        raise HTTPException(
            status_code=422,
            detail="El texto debe contener al menos una letra del alfabeto español.",
        )

    if payload.cipher == "caesar":
        if payload.shift is None or not 0 <= payload.shift < 27:
            raise HTTPException(status_code=422, detail="El desplazamiento k debe estar entre 0 y 26.")
        ciphertext = caesar_encrypt(normalized, payload.shift)
        cipher_name, key = "César", f"k = {payload.shift}"
    elif payload.cipher == "affine":
        if payload.multiplier is None or not 0 <= payload.multiplier < 27:
            raise HTTPException(status_code=422, detail="El multiplicador a debe estar entre 0 y 26.")
        if math.gcd(payload.multiplier, 27) != 1:
            raise HTTPException(status_code=422, detail="El multiplicador a debe ser coprimo con 27.")
        if payload.offset is None or not 0 <= payload.offset < 27:
            raise HTTPException(status_code=422, detail="El desplazamiento b debe estar entre 0 y 26.")
        ciphertext = affine_encrypt(normalized, payload.multiplier, payload.offset)
        cipher_name, key = "Afín", f"a = {payload.multiplier}, b = {payload.offset}"
    else:
        keyword = normalize_text(payload.keyword or "")
        if not keyword:
            raise HTTPException(status_code=422, detail="La palabra clave debe contener al menos una letra.")
        ciphertext = vigenere_encrypt(normalized, keyword)
        cipher_name, key = "Vigenère", keyword

    return EncryptionResponse(
        normalized_text=normalized,
        ciphertext=ciphertext,
        cipher=cipher_name,
        key=key,
        length=len(ciphertext),
    )
