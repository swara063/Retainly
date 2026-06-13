from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=4000)
    dataset_id: str | None = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[str] = []
