from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from pathlib import Path

app = Flask(__name__)
CORS(app)

DB_PATH = Path(__file__).with_name("services.db")


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

    # Seed sample data if empty
    cur.execute("SELECT COUNT(*) AS c FROM services")
    if cur.fetchone()["c"] == 0:
        sample = [
            ("Ram Plumber", "Plumber", "Butwal", "9800000001", "Leak fixing, bathroom pipeline"),
            ("Sita Electric", "Electrician", "Butwal", "9800000002", "House wiring, inverter repair"),
            ("Hari Mechanic", "Mechanic", "Chitwan", "9800000003", "Bike servicing and emergency repair"),
            ("KTM Fiber Support", "Internet Technician", "Kathmandu", "9800000004", "Fiber internet setup & support"),
        ]
        cur.executemany("""
            INSERT INTO services (name, category, area, phone, description)
            VALUES (?, ?, ?, ?, ?)
        """, sample)

    conn.commit()
    conn.close()


# ---------------- API Routes ----------------
@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/meta")
def meta():
    conn = get_connection()
    categories = [r["category"] for r in conn.execute(
        "SELECT DISTINCT category FROM services ORDER BY category"
    ).fetchall()]
    areas = [r["area"] for r in conn.execute(
        "SELECT DISTINCT area FROM services ORDER BY area"
    ).fetchall()]
    conn.close()
    return jsonify({"categories": categories, "areas": areas})


@app.get("/api/services")
def list_services():
    category = request.args.get("category", "").strip()
    area = request.args.get("area", "").strip()
    q = request.args.get("q", "").strip().lower()

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

    sql += " ORDER BY id DESC"

    conn = get_connection()
    rows = conn.execute(sql, params).fetchall()
    conn.close()

    return jsonify([dict(r) for r in rows])


@app.post("/api/services")
def add_service():
    data = request.get_json(silent=True) or {}

    required = ["name", "category", "area", "phone"]
    missing = [k for k in required if not str(data.get(k, "")).strip()]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    name = data["name"].strip()
    category = data["category"].strip()
    area = data["area"].strip()
    phone = data["phone"].strip()
    description = str(data.get("description", "")).strip()

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO services (name, category, area, phone, description)
        VALUES (?, ?, ?, ?, ?)
    """, (name, category, area, phone, description))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()

    return jsonify({"message": "Service added successfully", "id": new_id}), 201


@app.put("/api/services/<int:service_id>")
def update_service(service_id):
    data = request.get_json(silent=True) or {}

    required = ["name", "category", "area", "phone"]
    missing = [k for k in required if not str(data.get(k, "")).strip()]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    name = data["name"].strip()
    category = data["category"].strip()
    area = data["area"].strip()
    phone = data["phone"].strip()
    description = str(data.get("description", "")).strip()

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE services
        SET name=?, category=?, area=?, phone=?, description=?
        WHERE id=?
    """, (name, category, area, phone, description, service_id))
    conn.commit()
    updated = cur.rowcount
    conn.close()

    if updated == 0:
        return jsonify({"error": "Service not found"}), 404

    return jsonify({"message": "Service updated"}), 200


@app.delete("/api/services/<int:service_id>")
def delete_service(service_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM services WHERE id = ?", (service_id,))
    conn.commit()
    deleted = cur.rowcount
    conn.close()

    if deleted == 0:
        return jsonify({"error": "Service not found"}), 404

    return jsonify({"message": "Service deleted"}), 200


# ------------------ Main ------------------
import os

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

