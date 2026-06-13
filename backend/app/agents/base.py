from abc import ABC, abstractmethod
from app.services.logging_service import AgentLogger

class BaseAgent(ABC):
    name = "Base Agent"

    def __init__(self, logger: AgentLogger):
        self.logger = logger

    def log(self, status: str, message: str) -> None:
        self.logger.add(self.name, status, message)

    @abstractmethod
    def run(self, context: dict) -> dict:
        raise NotImplementedError
