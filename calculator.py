"""Core calculation engine."""

from models import db, Sector, SSSFund, SSSSectorConfig, PersonalFund, PersonalSetting


def compute_all():
    sectors = Sector.query.order_by(Sector.display_order).all()
    budget = db.session.get(PersonalSetting, 1).total_budget

    sss_fund_totals = {}
    sss_funds_by_sector = {}
    for f in SSSFund.query.all():
        sss_fund_totals[f.sector_id] = sss_fund_totals.get(f.sector_id, 0) + f.current_amount
        sss_funds_by_sector.setdefault(f.sector_id, []).append(f)

    personal_fund_totals = {}
    personal_funds_by_sector = {}
    for f in PersonalFund.query.all():
        personal_fund_totals[f.sector_id] = personal_fund_totals.get(f.sector_id, 0) + f.current_amount
        personal_funds_by_sector.setdefault(f.sector_id, []).append(f)

    sss_configs = {c.sector_id: c for c in SSSSectorConfig.query.all()}

    effective = {}
    for s in sectors:
        cfg = sss_configs.get(s.id)
        if cfg is None:
            effective[s.id] = 0
        elif s.is_storage:
            effective[s.id] = sss_fund_totals.get(s.id, 0)
        else:
            effective[s.id] = cfg.full_position

    sss_total = sum(effective.values())

    sector_results = []
    for s in sectors:
        cfg = sss_configs.get(s.id)
        eff = effective[s.id]
        sss_current = sss_fund_totals.get(s.id, 0)

        weight = eff / sss_total if sss_total > 0 else 0
        allocation = budget * weight
        target = allocation * s.position_coefficient
        personal_current = personal_fund_totals.get(s.id, 0)
        adjustment = target - personal_current

        sss_funds_list = [{"id": f.id, "code": f.code, "name": f.name, "current_amount": f.current_amount}
                          for f in sss_funds_by_sector.get(s.id, [])]
        personal_funds_list = [{"id": f.id, "code": f.code, "name": f.name, "current_amount": f.current_amount}
                               for f in personal_funds_by_sector.get(s.id, [])]

        sector_results.append({
            "sector_id": s.id, "sector_name": s.name, "is_storage": bool(s.is_storage),
            "position_coefficient": s.position_coefficient,
            "sss_current_amount": sss_current,
            "sss_position_level": cfg.position_level if cfg else 0,
            "sss_full_position": cfg.full_position if cfg else 0,
            "sss_effective_full": eff, "sss_weight": weight,
            "sss_funds": sss_funds_list,
            "personal_current_amount": personal_current,
            "personal_allocation": allocation, "target_amount": target,
            "adjustment": adjustment,
            "direction": "buy" if adjustment > 0.01 else ("sell" if adjustment < -0.01 else "hold"),
            "personal_funds": personal_funds_list,
        })

    total_target = sum(r["target_amount"] for r in sector_results)
    total_abs_adjustment = sum(abs(r["adjustment"]) for r in sector_results)
    adaptation_rate = max(0, 1 - total_abs_adjustment / total_target) if total_target > 0 else 0

    return {
        "sectors": sector_results,
        "summary": {
            "sss_total_full": sss_total, "personal_budget": budget,
            "ratio": budget / sss_total if sss_total > 0 else 0,
            "personal_total_current": sum(r["personal_current_amount"] for r in sector_results),
            "personal_total_target": total_target,
            "total_abs_adjustment": total_abs_adjustment,
            "adaptation_rate": adaptation_rate,
        },
    }


def simulate_follow(sss_buy_amount):
    data = compute_all()
    ratio = data["summary"]["ratio"]
    return {
        "ratio": ratio, "sss_buy_amount": sss_buy_amount,
        "personal_follow_total": sss_buy_amount * ratio,
        "breakdown": [{"sector_name": r["sector_name"], "follow_amount": sss_buy_amount * ratio * r["sss_weight"]}
                      for r in data["sectors"]],
    }
