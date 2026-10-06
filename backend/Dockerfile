FROM python:3.9-slim

# uv を導入
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /backend

# 依存関係を先にコピーしてキャッシュを有効化
COPY pyproject.toml uv.lock ./

# 本番依存関係のみインストール
RUN uv sync --frozen --no-dev

# アプリケーションをコピー
COPY . ./

# uv が作成した仮想環境を使用
ENV PATH="/backend/.venv/bin:$PATH"

CMD ["sh", "-c", "alembic upgrade head && exec uvicorn main:app --reload --host 0.0.0.0"]