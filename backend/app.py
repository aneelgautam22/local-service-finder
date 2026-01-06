from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from pathlib import Path
import os

app = Flask(__name__)
CORS(app)

DB_PATH = Path(__file__).with_name("services.db")

# ====== CONFIG ======
ADMIN_KEY = os.environ.get("ADMIN_KEY", "admin123")  # change later if you want


# ---------------- DB Helpers ----------------
def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            area TEXT NOT NULL,
            phone TEXT NOT NULL,
            description TEXT DEFAULT ''
        )
    """)

    cur.execute("SELECT COUNT(*) AS c FROM services")
    if cur.fetchone()["c"] == 0:
        sample = [
            ("Ram Plumber", "Plumber", "Butwal", "9800000001", "Leak fixing"),
            ("Sita Electric", "Electrician", "Butwal", "9800000002", "Wiring & repair"),
        ]
        cur.executemany("""
            INSERT INTO services (name, category, area, phone, description)
            VALUES (?, ?, ?, ?, ?)
        """, sample)

    conn.commit()
    conn.close()


# ---------------- SECURITY ----------------
def is_admin(req):
    return req.headers.get("X-ADMIN-KEY") == ADMIN_KEY


def admin_required():
    return jsonify({"error": "Read-only mode. Admin only."}), 403


# ---------------- API Routes ----------------
@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/meta")
def meta():
    conn = get_connection()
    categories = [r["category"] for r in conn.execute(
        "SELECT DISTINCT category FROM services ORDER BY category"
    )]
    areas = [r["area"] for r in conn.execute(
        "SELECT DISTINCT area FROM services ORDER BY area"
    )]
    conn.close()
    return jsonify({"categories": categories, "areas": areas})


@app.get("/api/services")
def list_services():
    category = request.args.get("category", "")
    area = request.args.get("area", "")
    q = request.args.get("q", "").lower()

    sql = "SELECT * FROM services WHERE 1=1"
    params = []

    if category:
        sql += " AND category = ?"
        params.append(category)

    if area:
        sql += " AND area = ?"
        params.append(area)

    if q:
        sql += " AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR phone LIKE ?)"
        like = f"%{q}%"
        params.extend([like, like, like])

    conn = get_connection()
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ---------------- WRITE (ADMIN ONLY) ----------------
@app.post("/api/services")
def add_service():
    if not is_admin(request):
        return admin_required()

    data = request.get_json() or {}
    for f in ["name", "category", "area", "phone"]:
        if not str(data.get(f, "")).strip():
            return jsonify({"error": f"{f} is required"}), 400

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO services (name, category, area, phone, description)
        VALUES (?, ?, ?, ?, ?)
    """, (
        data["name"].strip(),
        data["category"].strip(),
        data["area"].strip(),
        data["phone"].strip(),
        data.get("description", "").strip()
    ))
    conn.commit()
    conn.close()

    return jsonify({"message": "Service added"}), 201


@app.put("/api/services/<int:service_id>")
def update_service(service_id):
    if not is_admin(request):
        return admin_required()

    data = request.get_json() or {}
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE services
        SET name=?, category=?, area=?, phone=?, description=?
        WHERE id=?
    """, (
        data.get("name"),
        data.get("category"),
        data.get("area"),
        data.get("phone"),
        data.get("description", ""),
        service_id
    ))
    conn.commit()
    conn.close()

    return jsonify({"message": "Service updated"})


@app.delete("/api/services/<int:service_id>")
def delete_service(service_id):
    if not is_admin(request):
        return admin_required()

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM services WHERE id=?", (service_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "Service deleted"})


# ---------------- Main ----------------
if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
