"""Safe provider errors shared by the application and model adapters."""

class ModelFailure(RuntimeError):
    def __init__(self, code: str, provider_status: int | None = None):
        super().__init__(code)
        self.code = code
        self.provider_status = provider_status

    @property
    def transient(self) -> bool:
        return self.code in {"model_unavailable", "model_connect"}
