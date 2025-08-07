#!/usr/bin/env python3
import sys
import requests
from pathlib import Path
from rich.console import Console
from rich.table import Table

def load_pyvars(path="pyvars.txt"):
    env = {}
    p = Path(path)
    if not p.exists():
        print(f"Error: '{path}' not found.")
        sys.exit(1)
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"): continue
        if "=" not in line: continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env

cfg = load_pyvars()
BASE_URL           = cfg.get("BASE_URL", "http://localhost:3000")
ADMIN_EMAIL        = cfg["ADMIN_EMAIL"]
ADMIN_PASSWORD     = cfg["ADMIN_PASSWORD"]
ADMIN_NAME         = cfg.get("ADMIN_NAME", "Admin")
CUSTOMER_EMAIL     = cfg["CUSTOMER_EMAIL"]
CUSTOMER_PASSWORD  = cfg["CUSTOMER_PASSWORD"]
CUSTOMER_NAME      = cfg.get("CUSTOMER_NAME", "Customer")

console = Console()

def signup_user(email, password, name, role):
    return requests.post(f"{BASE_URL}/api/auth/signup",
                         json={"email": email, "password": password, "name": name, "role": role})

def get_csrf_token(s):
    r = s.get(f"{BASE_URL}/api/auth/csrf")
    r.raise_for_status()
    return r.json().get("csrfToken")

def login_session(email, password):
    s = requests.Session()
    token = get_csrf_token(s)
    r = s.post(f"{BASE_URL}/api/auth/callback/credentials",
               data={"csrfToken": token, "email": email, "password": password},
               allow_redirects=False)
    if r.status_code not in (200, 302):
        raise RuntimeError(f"{email} login failed: {r.status_code} {r.text}")
    return s

def ensure_session(email, password, name, role):
    try:
        sess = login_session(email, password)
        console.print(f"[yellow]→[/yellow] Logged in as {role} ({email}), skipping signup")
        return sess
    except:
        console.print(f"[blue]→[/blue] No account for {email}, signing up as {role}")
        resp = signup_user(email, password, name, role)
        if resp.status_code not in (200, 201, 409):
            console.print(f"[red]✖ Signup {role} failed: {resp.status_code} {resp.text}")
            sys.exit(1)
        if resp.status_code == 201:
            console.print(f"[green]✔[/green] Signed up {role} ({email})")
        return login_session(email, password)

def run(sess, method, path, **kwargs):
    return sess.request(method, f"{BASE_URL}{path}", **kwargs)

def result_mark(status, expected):
    return "[green]✔[/green]" if status in expected else f"[red]✖ ({status})[/red]"

# 1) Sessions
console.print("[bold]1) Ensuring Admin & Customer…[/bold]")
admin_sess    = ensure_session(ADMIN_EMAIL,   ADMIN_PASSWORD,   ADMIN_NAME,    "ADMIN")
customer_sess = ensure_session(CUSTOMER_EMAIL, CUSTOMER_PASSWORD, CUSTOMER_NAME, "CUSTOMER")

# 2) Create product
console.print("\n[bold]2) Creating test product…[/bold]")
prod_resp = run(admin_sess, "POST", "/api/products",
                json={"name":"TestProd","price":1.23,"imageUrl":"#"})
if prod_resp.status_code not in (200, 201):
    console.print(f"[red]✖[/red] Create product failed: {prod_resp.status_code} {prod_resp.text}")
    sys.exit(1)
pid = prod_resp.json().get("id")
console.print(f"[green]✔[/green] Product created with ID: {pid}")

# 3) Add to cart and create order BEFORE product deletion
cart_resp = run(customer_sess, "POST", "/api/cart",
                json={"productId": pid, "quantity": 1})
if cart_resp.status_code not in (200, 201):
    console.print(f"[red]✖[/red] Add to cart failed: {cart_resp.status_code} {cart_resp.text}")
    sys.exit(1)
cart_item_id = cart_resp.json().get("id")

order_resp = run(customer_sess, "POST", "/api/orders",
                 json={"items":[{"productId": pid, "quantity": 2}]})
if order_resp.status_code not in (200, 201):
    console.print(f"[red]✖[/red] Create order failed: {order_resp.status_code} {order_resp.text}")
    sys.exit(1)
order_id = order_resp.json().get("id")

# 4) Test matrix with expected statuses
tests = [
    # Public reads
    ("GET",    "/api/products",                admin_sess,    {},                 {200}),
    ("GET",    "/api/products",                customer_sess, {},                 {200}),

    # Product detail + update (admin)
    ("GET",    f"/api/products/{pid}",         admin_sess,    {},                 {200}),
    ("PATCH",  f"/api/products/{pid}",         admin_sess,    {"json":{"price":2.34}}, {200}),

    # Customer forbidden product mutations (expected 403)
    ("POST",   "/api/products",                customer_sess, {"json":{"name":"Bad","price":9.99}}, {403}),
    ("PATCH",  f"/api/products/{pid}",         customer_sess, {"json":{"price":9.99}}, {403}),
    ("DELETE", f"/api/products/{pid}",         customer_sess, {},                 {403}),

    # Cart (customer)
    ("GET",    "/api/cart",                    customer_sess, {},                 {200}),
    ("PATCH",  f"/api/cart/{cart_item_id}",    customer_sess, {"json":{"quantity":5}}, {200}),
    ("DELETE", f"/api/cart/{cart_item_id}",    customer_sess, {},                 {200}),

    # Orders (customer)
    ("GET",    "/api/orders",                  customer_sess, {},                 {200}),
    ("GET",    f"/api/orders/{order_id}",      customer_sess, {},                 {200}),

    # Admin: shipments & receipts
    ("POST",   f"/api/shipments/{order_id}",   admin_sess,    {"json":{"carrier":"DHL","trackingNumber":"XYZ123"}}, {200,201}),
    ("PATCH",  f"/api/shipments/{order_id}",   admin_sess,    {"json":{"status":"in_transit"}}, {200}),
    ("POST",   f"/api/receipts/{order_id}",    admin_sess,    {"json":{"pdfUrl":"https://ex.com/r.pdf"}}, {200,201}),

    # Finally: Admin delete product (should succeed)
    ("DELETE", f"/api/products/{pid}",         admin_sess,    {},                 {200}),
]

table = Table(title="API Test Results", show_lines=True)
table.add_column("Method", style="bold")
table.add_column("Endpoint")
table.add_column("User")
table.add_column("Expected")
table.add_column("Result", justify="center")

for method, path, sess, kwargs, expected in tests:
    try:
        resp = run(sess, method, path, **kwargs)
        status = resp.status_code
    except Exception:
        status = None
    user = "ADMIN" if sess is admin_sess else "CUSTOMER"
    table.add_row(method, path, user, ",".join(map(str, sorted(expected))), result_mark(status, expected))

console.print(table)
