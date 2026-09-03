from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .crypto import (
    analyze_candidates,
    classify,
    coincidence_index,
    frequencies,
    normalize_text,
)
from .schemas import AnalysisRequest, AnalysisResponse


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

