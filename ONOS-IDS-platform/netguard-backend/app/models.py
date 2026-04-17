import enum, uuid
from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, Enum,
    Float, ForeignKey, Integer, SmallInteger, String, Text, func, ARRAY, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


# ── ENUMS ─────────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    viewer = "viewer"

class AlertSeverity(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"
    info = "info"

class AlertStatus(str, enum.Enum):
    open = "open"
    acknowledged = "acknowledged"
    resolved = "resolved"
    false_positive = "false_positive"

class DeviceStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    unknown = "unknown"

class FlowAction(str, enum.Enum):
    allow = "allow"
    drop = "drop"
    redirect = "redirect"
    mirror = "mirror"


# ── MODELS ────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(64), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(Text, nullable=False)
    role = Column(Enum(UserRole, name="user_role"), nullable=False, default=UserRole.viewer)
    is_active = Column(Boolean, nullable=False, default=True)
    is_locked = Column(Boolean, nullable=False, default=False)
    failed_attempts = Column(SmallInteger, nullable=False, default=0)
    mfa_enabled = Column(Boolean, nullable=False, default=False)
    mfa_secret = Column(Text, nullable=True)
    mfa_backup_codes = Column(ARRAY(Text), nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    last_login_ip = Column(INET, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(Text, nullable=False, unique=True)
    device_info = Column(Text, nullable=True)
    ip_address = Column(INET, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user = relationship("User", back_populates="refresh_tokens")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    username = Column(String(64), nullable=True)
    action = Column(String(128), nullable=False)
    ip_address = Column(INET, nullable=True)
    user_agent = Column(Text, nullable=True)
    success = Column(Boolean, nullable=False, default=True)
    details = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Device(Base):
    __tablename__ = "devices"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    onos_id = Column(String(128), unique=True, nullable=True)
    name = Column(String(128), nullable=False)
    type = Column(String(64), nullable=True)
    ip_address = Column(INET, nullable=True)
    status = Column(Enum(DeviceStatus, name="device_status"), nullable=False, default=DeviceStatus.unknown)
    manufacturer = Column(String(128), nullable=True)
    sw_version = Column(String(64), nullable=True)
    ports = Column(JSONB, default=list)
    location = Column(String(255), nullable=True)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    alerts = relationship("Alert", back_populates="device")
    flow_rules = relationship("FlowRule", back_populates="device")


class FlowRule(Base):
    __tablename__ = "flow_rules"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    flow_id = Column(String(128), unique=True, nullable=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=True)
    onos_device_id = Column(String(128), nullable=True)
    priority = Column(Integer, nullable=False, default=100)
    is_permanent = Column(Boolean, default=True)
    timeout = Column(Integer, default=0)
    action = Column(Enum(FlowAction, name="flow_action"), nullable=False, default=FlowAction.allow)
    match_criteria = Column(JSONB, nullable=False, default=dict)
    instructions = Column(JSONB, nullable=False, default=dict)
    bytes = Column(BigInteger, default=0)
    packets = Column(BigInteger, default=0)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    device = relationship("Device", back_populates="flow_rules")


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(Enum(AlertSeverity, name="alert_severity"), nullable=False, default=AlertSeverity.medium)
    status = Column(Enum(AlertStatus, name="alert_status"), nullable=False, default=AlertStatus.open)
    source_ip = Column(INET, nullable=True)
    destination_ip = Column(INET, nullable=True)
    source_port = Column(Integer, nullable=True)
    destination_port = Column(Integer, nullable=True)
    protocol = Column(String(32), nullable=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    mitre_tactic = Column(String(128), nullable=True)
    mitre_technique = Column(String(128), nullable=True)
    acknowledged_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    raw_payload = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    device = relationship("Device", back_populates="alerts")
    ai_detections = relationship("AIDetection", back_populates="alert", cascade="all, delete-orphan")


class AIDetection(Base):
    __tablename__ = "ai_detections"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_id = Column(UUID(as_uuid=True), ForeignKey("alerts.id", ondelete="CASCADE"), nullable=True)
    model_name = Column(String(128), nullable=False)
    attack_type = Column(String(128), nullable=True)
    confidence = Column(Float, nullable=True)
    is_anomaly = Column(Boolean, nullable=False)
    features = Column(JSONB, default=dict)
    explanation = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    alert = relationship("Alert", back_populates="ai_detections")

class DeviceConfig(Base):
    __tablename__ = "device_configs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=True)
    onos_device_id = Column(String(128), nullable=False)
    config_type = Column(String(64), nullable=False)  # ports, vlans, flows, ip
    config_data = Column(JSONB, nullable=False, default=dict)
    applied_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    applied_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LinkState(Base):
    __tablename__ = "link_states"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    src_device = Column(String(128), nullable=False)
    src_port = Column(String(32), nullable=False)
    dst_device = Column(String(128), nullable=False)
    dst_port = Column(String(32), nullable=False)
    is_enabled = Column(Boolean, nullable=False, default=True)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text, nullable=True)

class Incident(Base):
    __tablename__ = "incidents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(32), nullable=False, default="medium")
    status = Column(String(32), nullable=False, default="open")
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    alert_count = Column(Integer, default=0)
    source_ips = Column(ARRAY(Text), nullable=True)
    attack_types = Column(ARRAY(Text), nullable=True)
    mitre_tactics = Column(ARRAY(Text), nullable=True)
    mitre_techniques = Column(ARRAY(Text), nullable=True)
    first_seen = Column(DateTime(timezone=True), server_default=func.now())
    last_seen = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    alerts = relationship("IncidentAlert", back_populates="incident", cascade="all, delete-orphan")


class IncidentAlert(Base):
    __tablename__ = "incident_alerts"
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), primary_key=True)
    alert_id = Column(UUID(as_uuid=True), ForeignKey("alerts.id", ondelete="CASCADE"), primary_key=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    incident = relationship("Incident", back_populates="alerts")
    alert = relationship("Alert")


class SIEMRule(Base):
    __tablename__ = "siem_rules"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(128), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    condition_type = Column(String(64), nullable=False)
    threshold = Column(Integer, nullable=False, default=1)
    time_window_minutes = Column(Integer, nullable=False, default=10)
    severity_filter = Column(String(32), nullable=True)
    action = Column(String(64), nullable=False, default="create_incident")
    incident_severity = Column(String(32), nullable=False, default="high")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SIEMEvent(Base):
    __tablename__ = "siem_events"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    event_type = Column(String(64), nullable=False)
    source = Column(String(64), nullable=False)
    severity = Column(String(32), nullable=False, default="info")
    title = Column(String(255), nullable=False)
    details = Column(JSONB, default=dict)
    source_ip = Column(INET, nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    alert_id = Column(UUID(as_uuid=True), ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True)
    processed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ThreatIntel(Base):
    __tablename__ = "threat_intel"
    __table_args__ = (UniqueConstraint("ip_address", "source", name="uq_threat_intel_ip_source"),)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ip_address = Column(INET, nullable=False)
    source = Column(String(64), nullable=False)
    abuse_score = Column(Integer, default=0)
    total_reports = Column(Integer, default=0)
    country_code = Column(String(8), nullable=True)
    isp = Column(String(255), nullable=True)
    domain = Column(String(255), nullable=True)
    usage_type = Column(String(128), nullable=True)
    is_whitelisted = Column(Boolean, default=False)
    is_tor = Column(Boolean, default=False)
    is_vpn = Column(Boolean, default=False)
    is_malicious = Column(Boolean, default=False)
    categories = Column(ARRAY(Text), nullable=True)
    last_reported = Column(DateTime(timezone=True), nullable=True)
    raw_data = Column(JSONB, default=dict)
    enriched_at = Column(DateTime(timezone=True), server_default=func.now())

class VulnerabilityScan(Base):
    __tablename__ = "vulnerability_scans"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=True)
    onos_device_id = Column(String(128), nullable=True)
    scan_type = Column(String(64), nullable=False)
    risk_score = Column(Integer, default=0)
    open_ports = Column(JSONB, default=list)
    vulnerabilities = Column(JSONB, default=list)
    cves = Column(JSONB, default=list)
    recommendations = Column(JSONB, default=list)
    scanned_at = Column(DateTime(timezone=True), server_default=func.now())
    scanned_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)