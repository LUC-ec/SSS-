"""交易日检测与定投自动执行逻辑。"""

from datetime import date, timedelta
from chinese_calendar import is_workday
from models import db, DailyInvestment, PersonalFund, InvestmentRecord, Sector


def is_trading_day(d: date) -> bool:
    return is_workday(d)


def _match_cycle(inv, d: date) -> bool:
    """判断某定投在给定日期是否应该执行。"""
    if inv.cycle == "daily":
        return True

    # cycle_day: 0=周一 ~ 4=周五
    if inv.cycle_day is None:
        return False

    weekday = d.weekday()  # 0=周一 ~ 6=周日
    if weekday != inv.cycle_day:
        return False  # 不是指定的周几

    if inv.cycle == "weekly":
        return True
    elif inv.cycle == "biweekly":
        # 以 ISO 周数奇偶判断，隔周执行
        _, week_num, _ = d.isocalendar()
        return week_num % 2 == 0
    elif inv.cycle == "monthly":
        # 每月中所有等于该周几的交易日都执行
        return True

    return False


def get_pending_dates() -> list[date]:
    today = date.today()
    active_investments = DailyInvestment.query.filter_by(is_active=1).all()
    if not active_investments:
        return []

    # 收集所有未覆盖的日期（任一定投在该日期应执行但未执行）
    all_pending = set()
    for inv in active_investments:
        if inv.daily_amount <= 0:
            continue

        records = InvestmentRecord.query.filter_by(sector_id=inv.sector_id).all()
        covered = {r.trade_date for r in records}

        start = today - timedelta(days=60)
        current = start
        while current <= today:
            if is_trading_day(current) and _match_cycle(inv, current) and current not in covered:
                all_pending.add(current)
            current += timedelta(days=1)
    return sorted(all_pending)


def process_pending_investments() -> int:
    today = date.today()
    active_investments = DailyInvestment.query.filter_by(is_active=1).all()
    if not active_investments:
        return 0

    total_created = 0

    for inv in active_investments:
        if inv.daily_amount <= 0:
            continue

        last_record = InvestmentRecord.query.filter_by(
            sector_id=inv.sector_id
        ).order_by(InvestmentRecord.trade_date.desc()).first()

        start_date = last_record.trade_date + timedelta(days=1) if last_record else today - timedelta(days=60)

        current = start_date
        while current <= today:
            if is_trading_day(current) and _match_cycle(inv, current):
                existing = InvestmentRecord.query.filter_by(
                    sector_id=inv.sector_id, trade_date=current
                ).first()
                if not existing:
                    rec = InvestmentRecord(
                        sector_id=inv.sector_id,
                        trade_date=current,
                        amount=inv.daily_amount,
                    )
                    db.session.add(rec)

                    pf = None
                    if inv.personal_fund_id:
                        pf = db.session.get(PersonalFund, inv.personal_fund_id)
                    if not pf:
                        pf = PersonalFund.query.filter_by(sector_id=inv.sector_id).first()
                    if pf:
                        pf.current_amount += inv.daily_amount

                    total_created += 1
            current += timedelta(days=1)

    if total_created > 0:
        db.session.commit()

    return total_created
