from __future__ import annotations
from datetime import datetime
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator
from ipaddress import IPv4Address, IPv6Address
from typing import Union

class LoginRequest(BaseModel):
    identifier: str
    password: str
    rememberMe: bool = True

class MFAVerifyRequest(BaseModel):
    mfa_token: str
    code: str = Field(..., min_length=6, max_length=8)

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    mfa_required: bool = False
    mfa_token: Optional[str] = None

class RefreshRequest(BaseModel):
    refresh_token: str

class MFASetupResponse(BaseModel):
    secret: str
    uri: str
    qr_code_base64: str
    backup_codes: list[str]

class MFAConfirmRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: str = "viewer"

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Au moins une majuscule requise")
        if not any(c.isdigit() for c in v):
            raise ValueError("Au moins un chiffre requis")
        return v

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    id: UUID
    username: str
    email: str
    role: str
    is_active: bool
    is_locked: bool
    mfa_enabled: bool
    last_login: Optional[datetime]
    created_at: datetime
    model_config = {"from_attributes": True}

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

class DeviceResponse(BaseModel):
    id: UUID
    onos_id: Optional[str]
    name: str
    type: Optional[str]
    ip_address: Optional[str] = None
    status: str
    manufacturer: Optional[str]
    sw_version: Optional[str]
    location: Optional[str]
    last_seen: Optional[datetime]
    updated_at: datetime

    model_config = {
        "from_attributes": True,
        "json_encoders": {IPv4Address: str},
    }

    @field_validator("ip_address", mode="before")
    @classmethod
    def ip_to_str(cls, v):
        return str(v) if v is not None else None


class AlertResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    severity: str
    status: str
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    source_port: Optional[int]
    destination_port: Optional[int]
    protocol: Optional[str]
    mitre_tactic: Optional[str]
    mitre_technique: Optional[str]
    created_at: datetime
    acknowledged_at: Optional[datetime]
    resolved_at: Optional[datetime]

    model_config = {
        "from_attributes": True,
        "json_encoders": {IPv4Address: str},
    }

    @field_validator("source_ip", "destination_ip", mode="before")
    @classmethod
    def ip_to_str(cls, v):
        return str(v) if v is not None else None

class AlertStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None

class FlowRuleCreate(BaseModel):
    onos_device_id: str
    priority: int = Field(100, ge=0, le=65535)
    is_permanent: bool = True
    timeout: int = 0
    action: str = "allow"
    match_criteria: dict[str, Any] = {}
    instructions: dict[str, Any] = {}

class FlowRuleResponse(BaseModel):
    id: UUID
    flow_id: Optional[str]
    onos_device_id: Optional[str]
    priority: int
    action: str
    match_criteria: dict
    instructions: dict
    bytes: int
    packets: int
    created_at: datetime
    model_config = {"from_attributes": True}

class AIDetectionResponse(BaseModel):
    id: UUID
    alert_id: Optional[UUID]
    model_name: str
    attack_type: Optional[str]
    confidence: Optional[float]
    is_anomaly: bool
    explanation: Optional[dict]
    created_at: datetime
    model_config = {"from_attributes": True}

class DashboardStats(BaseModel):
    total_alerts: int
    open_alerts: int
    critical_alerts: int
    total_devices: int
    active_devices: int
    total_flows: int
    anomalies_24h: int
    alerts_by_severity: dict[str, int]
class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None