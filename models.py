from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Sector(db.Model):
    __tablename__ = "sectors"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    display_order = db.Column(db.Integer, nullable=False, default=0)
    is_storage = db.Column(db.Integer, nullable=False, default=0)
    position_coefficient = db.Column(db.Float, nullable=False, default=1.0)

    sss_config = db.relationship("SSSSectorConfig", back_populates="sector", uselist=False)
    sss_funds = db.relationship("SSSFund", back_populates="sector")
    personal_funds = db.relationship("PersonalFund", back_populates="sector")
    daily_investments = db.relationship("DailyInvestment", back_populates="sector")


class SSSSectorConfig(db.Model):
    __tablename__ = "sss_sector_configs"

    id = db.Column(db.Integer, primary_key=True)
    sector_id = db.Column(db.Integer, db.ForeignKey("sectors.id"), unique=True, nullable=False)
    position_level = db.Column(db.Float, nullable=False, default=10.0)
    full_position = db.Column(db.Float, nullable=False, default=0)

    sector = db.relationship("Sector", back_populates="sss_config")


class SSSFund(db.Model):
    __tablename__ = "sss_funds"

    id = db.Column(db.Integer, primary_key=True)
    sector_id = db.Column(db.Integer, db.ForeignKey("sectors.id"), nullable=False)
    code = db.Column(db.String(20), nullable=False, default="")
    name = db.Column(db.String(200), nullable=False, default="")
    current_amount = db.Column(db.Float, nullable=False, default=0)

    sector = db.relationship("Sector", back_populates="sss_funds")


class PersonalFund(db.Model):
    __tablename__ = "personal_funds"

    id = db.Column(db.Integer, primary_key=True)
    sector_id = db.Column(db.Integer, db.ForeignKey("sectors.id"), nullable=False)
    code = db.Column(db.String(20), nullable=False, default="")
    name = db.Column(db.String(200), nullable=False, default="")
    current_amount = db.Column(db.Float, nullable=False, default=0)

    sector = db.relationship("Sector", back_populates="personal_funds")


class PersonalSetting(db.Model):
    __tablename__ = "personal_settings"

    id = db.Column(db.Integer, primary_key=True, default=1)
    total_budget = db.Column(db.Float, nullable=False, default=50000)


class DailyInvestment(db.Model):
    __tablename__ = "daily_investments"

    id = db.Column(db.Integer, primary_key=True)
    sector_id = db.Column(db.Integer, db.ForeignKey("sectors.id"), nullable=False)
    personal_fund_id = db.Column(db.Integer, db.ForeignKey("personal_funds.id"), nullable=True)
    daily_amount = db.Column(db.Float, nullable=False, default=0)
    fund_label = db.Column(db.String(300), nullable=False, default="")
    is_active = db.Column(db.Integer, nullable=False, default=1)
    # 定投周期: daily / weekly / biweekly / monthly
    cycle = db.Column(db.String(20), nullable=False, default="daily")
    # 执行日: 0=周一 ~ 4=周五 (daily 时忽略)
    cycle_day = db.Column(db.Integer, nullable=True)

    sector = db.relationship("Sector", back_populates="daily_investments")


class InvestmentRecord(db.Model):
    __tablename__ = "investment_records"

    id = db.Column(db.Integer, primary_key=True)
    sector_id = db.Column(db.Integer, db.ForeignKey("sectors.id"), nullable=False)
    trade_date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Float, nullable=False)

    __table_args__ = (
        db.UniqueConstraint("sector_id", "trade_date", name="uq_sector_trade_date"),
    )
