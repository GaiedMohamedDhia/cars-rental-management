"""Small shared formatting helpers for resilience output."""


def semantic_value(value: object | None, *, missing: str = "Not Measured") -> object:
    return missing if value is None or value == "" else value


__all__ = ["semantic_value"]
