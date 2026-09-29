from fastapi import FastAPI

app = FastAPI(title="Ndanda API")


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "Ndanda API is running"}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}