from flask import Flask, jsonify, request, render_template
from models import db, Sector, SSSFund, SSSSectorConfig, PersonalFund, PersonalSetting, DailyInvestment, InvestmentRecord
from calculator import compute_all, simulate_follow
from trading_calendar import process_pending_investments, is_trading_day, get_pending_dates
from sqlalchemy import func
import os, sys, webbrowser, threading, shutil

app = Flask(__name__)

# 打包后 _MEIPASS 存放只读资源（模板/静态），工作目录存放可写数据（数据库）
if getattr(sys, 'frozen', False):
    bundle_dir = sys._MEIPASS
    work_dir = os.path.dirname(sys.executable)
else:
    bundle_dir = os.path.abspath(os.path.dirname(__file__))
    work_dir = bundle_dir

# 将模板和静态文件路径指向 bundle（只读资源）
app.template_folder = os.path.join(bundle_dir, 'templates')
app.static_folder = os.path.join(bundle_dir, 'static')

db_path = os.path.join(work_dir, 'fund_tracker.db')
# 首次启动：从 bundle 复制种子数据库到工作目录
if getattr(sys, 'frozen', False) and not os.path.exists(db_path):
    shutil.copy(os.path.join(bundle_dir, 'fund_tracker.db'), db_path)

app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)


@app.route("/")
def index():
    return render_template("index.html")


# ── Sectors ──

@app.route("/api/sectors", methods=["GET"])
def api_sectors():
    sectors = Sector.query.order_by(Sector.display_order).all()
    return jsonify([{"id": s.id, "name": s.name, "display_order": s.display_order,
                     "is_storage": s.is_storage, "position_coefficient": s.position_coefficient} for s in sectors])


@app.route("/api/sectors/<int:sid>", methods=["PUT"])
def api_sector_update(sid):
    s = db.session.get(Sector, sid)
    if not s: return jsonify({"error": "not found"}), 404
    data = request.json
    if "position_coefficient" in data:
        s.position_coefficient = data["position_coefficient"]
    db.session.commit()
    return jsonify({"ok": True})


@app.route("/api/sectors", methods=["POST"])
def api_sector_create():
    data = request.json
    max_order = db.session.query(func.max(Sector.display_order)).scalar() or 0
    position_level = data.get("position_level", 10.0)
    s = Sector(name=data["name"], display_order=max_order + 1,
               is_storage=data.get("is_storage", 0),
               position_coefficient=data.get("position_coefficient", position_level * 0.1))
    db.session.add(s)
    db.session.flush()
    db.session.add(SSSSectorConfig(sector_id=s.id, position_level=position_level,
                                   full_position=data.get("full_position", 0)))
    db.session.commit()
    return jsonify({"ok": True, "id": s.id})


@app.route("/api/sectors/<int:sid>", methods=["DELETE"])
def api_sector_delete(sid):
    s = db.session.get(Sector, sid)
    if not s: return jsonify({"error": "not found"}), 404
    SSSFund.query.filter_by(sector_id=sid).delete()
    PersonalFund.query.filter_by(sector_id=sid).delete()
    SSSSectorConfig.query.filter_by(sector_id=sid).delete()
    DailyInvestment.query.filter_by(sector_id=sid).delete()
    InvestmentRecord.query.filter_by(sector_id=sid).delete()
    db.session.delete(s)
    db.session.commit()
    return jsonify({"ok": True})


# ── SSS Sector Config ──

@app.route("/api/sss-configs", methods=["GET"])
def api_sss_configs():
    configs = SSSSectorConfig.query.all()
    return jsonify({c.sector_id: {"id": c.id, "sector_id": c.sector_id,
                    "position_level": c.position_level, "full_position": c.full_position} for c in configs})


@app.route("/api/sss-configs/<int:sid>", methods=["PUT"])
def api_sss_config_update(sid):
    c = SSSSectorConfig.query.filter_by(sector_id=sid).first_or_404()
    data = request.json
    for field in ["position_level", "full_position"]:
        if field in data: setattr(c, field, data[field])
    db.session.commit()
    return jsonify({"ok": True})


# ── SSS Funds ──

@app.route("/api/sss-funds", methods=["GET"])
def api_sss_funds():
    funds = SSSFund.query.join(Sector).order_by(Sector.display_order, SSSFund.id).all()
    return jsonify([{"id": f.id, "sector_id": f.sector_id, "code": f.code,
                     "name": f.name, "current_amount": f.current_amount} for f in funds])


@app.route("/api/sss-funds/<int:fid>", methods=["PUT"])
def api_sss_fund_update(fid):
    f = db.session.get(SSSFund, fid)
    if not f: return jsonify({"error": "not found"}), 404
    data = request.json
    for field in ["code", "name", "current_amount"]:
        if field in data: setattr(f, field, data[field])
    db.session.commit()
    return jsonify({"ok": True})


@app.route("/api/sss-funds", methods=["POST"])
def api_sss_fund_create():
    data = request.json
    f = SSSFund(sector_id=data["sector_id"], code=data.get("code", ""),
                name=data.get("name", ""), current_amount=data.get("current_amount", 0))
    db.session.add(f)
    db.session.commit()
    return jsonify({"ok": True, "id": f.id})


@app.route("/api/sss-funds/<int:fid>", methods=["DELETE"])
def api_sss_fund_delete(fid):
    f = db.session.get(SSSFund, fid)
    if not f: return jsonify({"error": "not found"}), 404
    db.session.delete(f)
    db.session.commit()
    return jsonify({"ok": True})


# ── Personal Funds ──

@app.route("/api/personal-funds", methods=["GET"])
def api_personal_funds():
    funds = PersonalFund.query.join(Sector).order_by(Sector.display_order, PersonalFund.id).all()
    return jsonify([{"id": f.id, "sector_id": f.sector_id, "code": f.code,
                     "name": f.name, "current_amount": f.current_amount} for f in funds])


@app.route("/api/personal-funds/<int:fid>", methods=["PUT"])
def api_personal_fund_update(fid):
    f = db.session.get(PersonalFund, fid)
    if not f: return jsonify({"error": "not found"}), 404
    data = request.json
    for field in ["code", "name", "current_amount"]:
        if field in data: setattr(f, field, data[field])
    db.session.commit()
    return jsonify({"ok": True})


@app.route("/api/personal-funds", methods=["POST"])
def api_personal_fund_create():
    data = request.json
    f = PersonalFund(sector_id=data["sector_id"], code=data.get("code", ""),
                     name=data.get("name", ""), current_amount=data.get("current_amount", 0))
    db.session.add(f)
    db.session.commit()
    return jsonify({"ok": True, "id": f.id})


@app.route("/api/personal-funds/<int:fid>", methods=["DELETE"])
def api_personal_fund_delete(fid):
    f = db.session.get(PersonalFund, fid)
    if not f: return jsonify({"error": "not found"}), 404
    db.session.delete(f)
    db.session.commit()
    return jsonify({"ok": True})


# ── Settings ──

@app.route("/api/settings", methods=["GET"])
def api_settings():
    return jsonify({"total_budget": db.session.get(PersonalSetting, 1).total_budget})


@app.route("/api/settings", methods=["PUT"])
def api_settings_update():
    ps = db.session.get(PersonalSetting, 1)
    data = request.json
    if "total_budget" in data: ps.total_budget = data["total_budget"]
    db.session.commit()
    return jsonify({"ok": True})


# ── Calculations ──

@app.route("/api/calculations", methods=["GET"])
def api_calculations():
    return jsonify(compute_all())


@app.route("/api/calculations/simulate", methods=["POST"])
def api_simulate():
    return jsonify(simulate_follow(request.json.get("sss_buy_amount", 0)))


# ── Daily Investments ──

@app.route("/api/daily-investments", methods=["GET"])
def api_daily_investments():
    items = DailyInvestment.query.join(Sector).order_by(Sector.display_order).all()
    return jsonify([{"id": d.id, "sector_id": d.sector_id, "sector_name": d.sector.name,
                     "daily_amount": d.daily_amount, "fund_label": d.fund_label,
                     "personal_fund_id": d.personal_fund_id, "is_active": d.is_active,
                     "cycle": d.cycle, "cycle_day": d.cycle_day} for d in items])


@app.route("/api/daily-investments/<int:did>", methods=["PUT"])
def api_daily_investment_update(did):
    d = db.session.get(DailyInvestment, did)
    if not d: return jsonify({"error": "not found"}), 404
    data = request.json
    for field in ["daily_amount", "is_active", "cycle", "cycle_day"]:
        if field in data: setattr(d, field, data[field])
    db.session.commit()
    return jsonify({"ok": True})


@app.route("/api/daily-investments", methods=["POST"])
def api_daily_investment_create():
    data = request.json
    d = DailyInvestment(sector_id=data["sector_id"], daily_amount=data.get("daily_amount", 0),
                        fund_label=data.get("fund_label", ""),
                        personal_fund_id=data.get("personal_fund_id"),
                        is_active=data.get("is_active", 1),
                        cycle=data.get("cycle", "daily"),
                        cycle_day=data.get("cycle_day"))
    db.session.add(d)
    db.session.commit()
    return jsonify({"ok": True, "id": d.id})


@app.route("/api/daily-investments/<int:did>", methods=["DELETE"])
def api_daily_investment_delete(did):
    d = db.session.get(DailyInvestment, did)
    if not d: return jsonify({"error": "not found"}), 404
    db.session.delete(d)
    db.session.commit()
    return jsonify({"ok": True})


# ── Trading ──

@app.route("/api/trading/status", methods=["GET"])
def api_trading_status():
    from datetime import date
    today = date.today()
    records_today = InvestmentRecord.query.filter_by(trade_date=today).first()
    return jsonify({"today": str(today), "is_trading_day": is_trading_day(today),
                    "processed_today": records_today is not None,
                    "pending_dates": [str(d) for d in get_pending_dates()]})


@app.route("/api/trading/process", methods=["POST"])
def api_process_investments():
    return jsonify({"ok": True, "processed": process_pending_investments()})


@app.route("/api/investment-records", methods=["GET"])
def api_investment_records():
    records = InvestmentRecord.query.join(Sector, InvestmentRecord.sector_id == Sector.id)\
        .order_by(InvestmentRecord.trade_date.desc(), Sector.display_order).limit(100).all()
    return jsonify([{"id": r.id, "sector_name": db.session.get(Sector, r.sector_id).name,
                     "trade_date": str(r.trade_date), "amount": r.amount} for r in records])


# ── Seed ──

def seed():
    db.create_all()

    # 数据库迁移：为已存在的 daily_investments 表补齐新列
    with db.engine.connect() as conn:
        cols = [row[1] for row in conn.exec_driver_sql("PRAGMA table_info('daily_investments')").fetchall()]
        if "cycle" not in cols:
            conn.exec_driver_sql("ALTER TABLE daily_investments ADD COLUMN cycle VARCHAR(20) NOT NULL DEFAULT 'daily'")
        if "cycle_day" not in cols:
            conn.exec_driver_sql("ALTER TABLE daily_investments ADD COLUMN cycle_day INTEGER")

    if db.session.get(PersonalSetting, 1) is None:
        db.session.add(PersonalSetting(id=1, total_budget=0))
        db.session.commit()
    if Sector.query.count() > 0:
        return

    sectors_data = [("CPO", 1, 0, 0.70), ("航天", 2, 0, 0.45), ("存储", 3, 1, 1.00),
                    ("电网", 4, 0, 0.45), ("锂矿", 5, 0, 0.67)]
    for name, order, is_st, coef in sectors_data:
        db.session.add(Sector(name=name, display_order=order, is_storage=is_st, position_coefficient=coef))
    db.session.commit()
    sids = {s.name: s.id for s in Sector.query.all()}

    for name, pl, fp in [("CPO", 7.0, 2000000), ("航天", 4.5, 1000000), ("存储", 10.0, 818786),
                          ("电网", 4.5, 660000), ("锂矿", 6.7, 400000)]:
        db.session.add(SSSSectorConfig(sector_id=sids[name], position_level=pl, full_position=fp))
    db.session.commit()

    sss_fund_data = [
        ("CPO", "026211", "平安科技精选混合C", 253870), ("CPO", "008984", "财通科技创新混合C", 68551),
        ("CPO", "018291", "广发新兴成长灵活配置混合C", 49334), ("CPO", "011452", "华泰柏瑞质量成长混合C", 1041514),
        ("CPO", "024623", "华泰柏瑞中证全指自由现金流ETF联接C", 50000), ("CPO", "501205", "鹏华创新未来混合（LOF）C", 100000),
        ("航天", "025647", "平安高端装备混合C", 170000), ("航天", "024749", "博时中证卫星", 260000),
        ("航天", "015839", "广发招利混合", 40000), ("存储", "016874", "广发远见智选混合C", 818786),
        ("电网", "007049", "平安鑫安混合E", 330000), ("电网", "025793", "东方阿尔法科技甄选混合", 70000),
        ("锂矿", "290008", "泰信发展主题混合C", 323293),
    ]
    for sname, code, name, amt in sss_fund_data:
        db.session.add(SSSFund(sector_id=sids[sname], code=code, name=name, current_amount=amt))
    db.session.commit()

    db.session.commit()


if __name__ == "__main__":
    with app.app_context():
        seed()
        count = process_pending_investments()
        if count: print(f"  📊 已处理 {count} 笔定投")

    url = "http://127.0.0.1:5000"
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()

    print("\n  🧮 SSS五绝计算器已启动 → " + url + "\n")
    app.run(debug=False, host="127.0.0.1", port=5000)
