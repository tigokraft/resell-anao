#!/usr/bin/env python3
import os
import sys
import requests
from pathlib import Path
from rich.console import Console
from rich.table import Table

# ─── Load vars from pyvars.txt ─────────────────────────────────────────────────

def load_pyvars(path="pyvars.txt"):
    env = {}
    p = Path(path)
    if not p.exists():
        print(f"Error: '{path}' not found.")
        sys.exit(1)
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"): continue
        if "=" not in line:
            print(f"Skipping invalid line: {line}")
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env

cfg = load_pyvars()

BASE_URL           = cfg.get("BASE_URL", "http://localhost:3000")
ADMIN_EMAIL        = cfg.get("ADMIN_EMAIL")
ADMIN_PASSWORD     = cfg.get("ADMIN_PASSWORD")
ADMIN_NAME         = cfg.get("ADMIN_NAME", "Admin")
CUSTOMER_EMAIL     = cfg.get("CUSTOMER_EMAIL")
CUSTOMER_PASSWORD  = cfg.get("CUSTOMER_PASSWORD")
CUSTOMER_NAME      = cfg.get("CUSTOMER_NAME", "Customer")

required = ["ADMIN_EMAIL","ADMIN_PASSWORD","CUSTOMER_EMAIL","CUSTOMER_PASSWORD"]
if any(not cfg.get(k) for k in required):
    print(f"Please set {', '.join(required)} in pyvars.txt")
    sys.exit(1)

console = Console()

# ─── Helpers ───────────────────────────────────────────────────────────────────

def signup_user(email, password, name, role):
    """Calls your /api/auth/signup endpoint to create a new user."""
    url = f"{BASE_URL}/api/auth/signup"
    payload = {"email": email, "password": password, "name": name, "role": role}
    r = requests.post(url, json=payload)
    return r.status_code, r.text

def get_csrf_token(session):
    r = session.get(f"{BASE_URL}/api/auth/csrf")
    r.raise_for_status()
    return r.json()["csrfToken"]

def login_session(email, password):
    s = requests.Session()
    token = get_csrf_token(s)
    data = {"csrfToken": token, "email": email, "password": password}
    r = s.post(f"{BASE_URL}/api/auth/callback/credentials", data=data, allow_redirects=False)
    if r.status_code not in (200, 302):
        raise RuntimeError(f"Login failed for {email}: {r.status_code} {r.text}")
    return s

def test_endpoint(sess, method, path, **kwargs):
    url = f"{BASE_URL}{path}"
    try:
        r = sess.request(method, url, **kwargs)
        ok = 200 <= r.status_code < 300
    except Exception:
        return False, None
    return ok, r.status_code

# ─── 1) Sign up Admin & Customer ────────────────────────────────────────────────

console.print("[bold]1) Signing up users…[/bold]")
for email, pwd, name, role in [
    (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, "ADMIN"),
    (CUSTOMER_EMAIL, CUSTOMER_PASSWORD, CUSTOMER_NAME, "CUSTOMER"),
]:
    code, text = signup_user(email, pwd, name, role)
    if code not in (200, 201):
        console.print(f"[red]✖[/red] Signup {role} ({email}) failed: {code} {text}")
        sys.exit(1)
    console.print(f"[green]✔[/green] {role} signed up: {email}")

# ─── 2) Log in sessions ───────────────────────────────────────────────────────────

console.print("\n[bold]2) Logging in…[/bold]")
try:
    admin_sess    = login_session(ADMIN_EMAIL, ADMIN_PASSWORD)
    customer_sess = login_session(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    console.print("[green]✔[/green] Admin session established")
    console.print("[green]✔[/green] Customer session established")
except Exception as e:
    console.print(f"[red]✖ Authentication error:[/red] {e}")
    sys.exit(1)

# ─── 3) Build & Run Tests ────────────────────────────────────────────────────────

# We'll store created IDs here
created = {}

# Define tests as tuples: (method, path, session, optional kwargs)
tests = [
    # PRODUCTS (public read)
    ("GET",    "/api/products",                admin_sess,    {}),
    ("GET",    "/api/products",                customer_sess, {}),

    # PRODUCTS CRUD (admin)
    ("POST",   "/api/products",                admin_sess,    {"json": {"name":"TestProd","price":1.23,"imageUrl":"#"}}),
]

# 1st run: create product to capture its ID
console.print("\n[bold]3) Testing endpoints…[/bold]")
ok, status = test_endpoint(*tests[-1][:3], **tests[-1][3])
if not ok:
    console.print(f"[red]✖ Failed to create product:[/red] {status}")
    sys.exit(1)
prod = admin_sess.post(f"{BASE_URL}/api/products", json={"name":"TestProd","price":1.23,"imageUrl":"#"}).json()
created["productId"] = prod["id"]

# Extend product tests
pid = created["productId"]
tests += [
    ("GET",    f"/api/products/{pid}",         admin_sess,    {}),
    ("PATCH",  f"/api/products/{pid}",         admin_sess,    {"json": {"price":2.34}}),
    ("DELETE", f"/api/products/{pid}",         admin_sess,    {}),
    ("POST",   "/api/products",                customer_sess, {"json": {"name":"Bad","price":9.99,"imageUrl":"#"}}),
    ("PATCH",  f"/api/products/{pid}",         customer_sess, {"json": {"price":9.99}}),
    ("DELETE", f"/api/products/{pid}",         customer_sess, {}),
]

# CART for customer
ok, _ = test_endpoint(customer_sess, "POST", "/api/cart", json={"productId": pid, "quantity": 1})
if not ok:
    console.print(f"[red]✖ Cart add failed (you may need at least one product)[/red]")
    sys.exit(1)
item = customer_sess.post(f"{BASE_URL}/api/cart", json={"productId": pid,"quantity":1}).json()
created["cartItemId"] = item["id"]

cid = created["cartItemId"]
tests += [
    ("GET",    "/api/cart",                    customer_sess, {}),
    ("PATCH",  f"/api/cart/{cid}",             customer_sess, {"json": {"quantity": 5}}),
    ("DELETE", f"/api/cart/{cid}",             customer_sess, {}),
]

# ORDERS
ok, _ = test_endpoint(customer_sess, "POST", "/api/orders", json={"items":[{"productId":pid,"quantity":2}]})
if not ok:
    console.print(f"[red]✖ Order creation failed[/red]")
    sys.exit(1)
order = customer_sess.post(f"{BASE_URL}/api/orders", json={"items":[{"productId":pid,"quantity":2}]}).json()
created["orderId"] = order["id"]

oid = created["orderId"]
tests += [
    ("GET",    "/api/orders",                  customer_sess, {}),
    ("GET",    f"/api/orders/{oid}",           customer_sess, {}),
    ("POST",   f"/api/shipments/{oid}",        admin_sess,    {"json": {"carrier":"DHL","trackingNumber":"XYZ123"}}),
    ("PATCH",  f"/api/shipments/{oid}",        admin_sess,    {"json": {"status":"in_transit"}}),
    ("POST",   f"/api/receipts/{oid}",         admin_sess,    {"json": {"pdfUrl":"https://ex.com/r.pdf"}}),
]

# ─── Render Results ─────────────────────────────────────────────────────────────

table = Table(title="API Test Results", show_lines=True)
table.add_column("Method", style="bold")
table.add_column("Endpoint")
table.add_column("User")
table.add_column("Result", justify="center")

for method, path, sess, kwargs in tests:
    ok, status = test_endpoint(sess, method, path, **kwargs)
    user = "ADMIN" if sess is admin_sess else "CUSTOMER"
    mark = "[green]✔[/green]" if ok else f"[red]✖ ({status})[/red]"
    table.add_row(method, path, user, mark)

console.print(table)
