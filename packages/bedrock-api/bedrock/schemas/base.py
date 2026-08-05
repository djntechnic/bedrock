"""
Module:  base.py
Layer:   api/schemas
Desc:    Base schema definitions for the API layer. Includes the universal
         ApiResponse envelope used by all route handlers.
"""
from typing import Generic, TypeVar, Optional
from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """
    Universal response envelope for all API endpoints.
    Ensures a consistent JSON structure for the frontend.
    """
    status: str
    message: Optional[str] = None
    data: Optional[T] = None
