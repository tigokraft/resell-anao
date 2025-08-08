#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
import requests
from typing import Dict, Any, Optional, Tuple
from tabulate import tabulate

# -----------------------------
# Load pyvars.txt
# -----------------------------
VARS_PATH = os.path.join(os.path.dirname(__file__), "pyvars.txt")
if not os.path.exists(VARS_PATH):
    print("pyvars.txt not found next to tester.py")
    sys.exit(1)

cfg: Dict[str, str] = {}
with open(VARS_PATH) as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        cfg[k.strip()] = v.strip()

BASE = cfg.get("BASE_URL", "http://localhost:3000").rstrip("/")

ADMIN_EMAIL = cfg.get("ADMIN_EMAIL", "admin@vexo.com")
ADMIN_PASSWORD = cfg.get("ADMIN_PASSWORD", "adminpass")
ADMIN_NAME = cfg.get("ADMIN_NAME", "Alice Admin")

CUSTOMER_EMAIL = cfg.get("CUSTOMER_EMAIL", "joe@vexo.com")
CUSTOMER_PASSWORD = cfg.get("CUSTOMER_PASSWORD", "joepass")
CUSTOMER_NAME = cfg.get("CUSTOMER_NAME", "Joe Customer")

S = {"ADMIN": requests.Session(), "CUSTOMER": requests.Session()}

# -----------------------------
# Small helpers
# -----------------------------
def j(resp: requests.Response) -> Any:
    try:
        return resp.json()
    except Exception:
        return None

def unwrap(payload: Any) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload["data"]
    return payload

def expected_ok(code: int, expected) -> bool:
    if isinstance(expected, (list, tuple, set)):
        return code in expected
    return code == expected

def row(method: str, endpoint: str, user: str, expected, ok: bool, code: int) -> list:
    exp = ",".join(map(str, expected)) if isinstance(expected, (list, tuple, set)) else str(expected)
    return [method, endpoint, user, exp, "✔" if ok else f"✖ ({code})"]

# -----------------------------
# Auth diagnostics & login
# -----------------------------
def providers() -> Dict[str, Any]:
    try:
        r = requests.get(f"{BASE}/api/auth/providers")
        return j(r) or {}
    except Exception:
        return {}

def get_csrf(sess: requests.Session) -> Tuple[Optional[str], str]:
    r = sess.get(f"{BASE}/api/auth/csrf", allow_redirects=False)
    if r.status_code != 200:
        return None, f"CSRF {r.status_code}: {r.text[:200]}"
    data = j(r)
    if not isinstance(data, dict):
        return None, f"CSRF not JSON: {r.text[:200]}"
    token = data.get("csrfToken") or data.get("csrf_token")
    if not token:
        return None, f"No csrfToken in response: {data}"
    return token, ""

def check_session(sess: requests.Session) -> Tuple[bool, str]:
    r = sess.get(f"{BASE}/api/auth/session", allow_redirects=False)
    if r.status_code != 200:
        return False, f"session {r.status_code}: {r.text[:200]}"
    data = j(r)
    if not isinstance(data, dict) or not data.get("user"):
        return False, f"no user in session: {data}"
    return True, "ok"

def signup_user(email: str, password: str, role: str, name: str) -> bool:
    r = requests.post(f"{BASE}/api/auth/signup", json={
        "email": email, "password": password, "role": role, "name": name
    })
    if r.status_code in (200, 201):
        return True
    data = j(r)
    msg = ""
    if isinstance(data, dict):
        err = data.get("error")
        if isinstance(err, dict):
            msg = (err.get("message") or "").lower()
        elif isinstance(err, str):
            msg = err.lower()
    else:
        msg = (r.text or "").lower()
    return ("exists" in msg) or ("unique" in msg) or ("409" in msg)

def login_credentials_verbose(role: str, email: str, password: str) -> Tuple[bool, str]:
    s = S[role]

    # show providers so we know credentials is enabled
    prov = providers()
    creds_enabled = any(k == "credentials" for k in prov.keys())
    print(f"→ Providers found: {list(prov.keys()) or 'NONE'} (credentials enabled: {creds_enabled})")

    # Try 1: CSRF + form-encoded + redirect=false
    token, err = get_csrf(s)
    if not token:
        return False, f"Cannot fetch CSRF: {err}"
    form = {
        "csrfToken": token,
        "email": email,
        "password": password,
        "redirect": "false",
        "callbackUrl": "/",
    }
    r1 = s.post(
        f"{BASE}/api/auth/callback/credentials",
        data=form,
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        allow_redirects=False,
    )
    loc1 = r1.headers.get("Location")
    print(f"→ Attempt#1 status={r1.status_code} location={loc1}")
    ok, msg = check_session(s)
    if ok: return True, "ok (form redirect=false)"

    # Try 2: same but allow redirects (to see where it goes)
    r2 = s.post(
        f"{BASE}/api/auth/callback/credentials",
        data=form,
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        allow_redirects=True,
    )
    print(f"→ Attempt#2 status={r2.status_code} final_url={r2.url}")
    ok, msg = check_session(s)
    if ok: return True, "ok (form w/ redirects)"

    # Try 3: JSON fallback
    r3 = s.post(
        f"{BASE}/api/auth/callback/credentials?json=true",
        json={"email": email, "password": password},
        headers={"Accept": "application/json"},
        allow_redirects=False,
    )
    loc3 = r3.headers.get("Location")
    print(f"→ Attempt#3 status={r3.status_code} location={loc3}")
    ok, msg = check_session(s)
    if ok: return True, "ok (json fallback)"

    # Final check
    ok, msg = check_session(s)
    if ok:
        return True, "ok (already logged in)"
    return False, f"CredentialsSignin (last statuses: {r1.status_code}/{r2.status_code}/{r3.status_code})"

def ensure_account(role: str, email: str, password: str, name: str) -> bool:
    # Always try to create (idempotent)
    created = signup_user(email, password, role, name)
    if not created:
        print(f"✖ {role} signup failed (server refused).")
        return False
    ok, msg = login_credentials_verbose(role, email, password)
    if not ok:
        print(f"✖ {role} login failed: {msg}")
        print("\nTroubleshooting tips:")
        print("  1) Check your server log during those attempts — NextAuth prints the exact error (e.g., CredentialsSignin).")
        print("  2) Ensure .env has NEXTAUTH_URL matching BASE_URL in pyvars.txt, and NEXTAUTH_SECRET is set. Restart dev server.")
        print("  3) In app/api/auth/[...nextauth]/route.ts, confirm credentials field names are 'email' and 'password'.")
        print("  4) In authorize(), log the incoming credentials to ensure it receives them, and compare with bcrypt correctly.")
        return False
    print(f"✔ {role} ready: {email}")
    return True

# -----------------------------
# Generic API call
# -----------------------------
def call(role: str, method: str, path: str, expected, json_body=None) -> Tuple[bool, requests.Response]:
    fn = getattr(S[role], method.lower())
    r = fn(f"{BASE}{path}", json=json_body)
    return expected_ok(r.status_code, expected), r

# -----------------------------
# Full API battery
# -----------------------------
def run_suite():
    results = []
    ids: Dict[str, str] = {}

    # 2) Categories
    print("\n2) Categories…")
    ok, r = call("ADMIN", "POST", "/api/categories", [200, 201], {"name": "Test Category"})
    if ok:
        payload = unwrap(j(r))
        if isinstance(payload, dict):
            ids["categoryId"] = payload.get("id")
    ok_g, r_g = call("CUSTOMER", "GET", "/api/categories", 200)
    results.append(row("GET", "/api/categories", "CUSTOMER", 200, ok_g, r_g.status_code))

    if "categoryId" in ids:
        ok_p, r_p = call("ADMIN", "PATCH", f"/api/categories/{ids['categoryId']}", 200, {"name": "Test Cat Renamed"})
        results.append(row("PATCH", f"/api/categories/{ids['categoryId']}", "ADMIN", 200, ok_p, r_p.status_code))

    # 3) Product (stock + category)
    print("\n3) Product…")
    prod_body = {
        "name": "Vexo Tee",
        "description": "Y2K glass tee",
        "price": 19.99,
        "stock": 5,
        "categoryId": ids.get("categoryId")
    }
    ok, r = call("ADMIN", "POST", "/api/products", [200, 201], prod_body)
    if not ok:
        print(f"✖ Failed to create product: {r.status_code} {r.text}")
        sys.exit(1)
    prod = unwrap(j(r))
    ids["productId"] = prod["id"]

    ok_l, r_l = call("CUSTOMER", "GET", "/api/products", 200)
    results.append(row("GET", "/api/products", "CUSTOMER", 200, ok_l, r_l.status_code))

    ok_u, r_u = call("ADMIN", "PATCH", f"/api/products/{ids['productId']}", 200, {"stock": 7, "price": 21.5})
    results.append(row("PATCH", f"/api/products/{ids['productId']}", "ADMIN", 200, ok_u, r_u.status_code))

    ok_forb, r_forb = call("CUSTOMER", "POST", "/api/products", 403, {"name": "Nope", "price": 1})
    results.append(row("POST", "/api/products", "CUSTOMER", 403, ok_forb, r_forb.status_code))

    # 4) Wishlist
    print("\n4) Wishlist…")
    ok_w_add, r_w_add = call("CUSTOMER", "POST", "/api/wishlist", [200, 201], {"productId": ids["productId"]})
    results.append(row("POST", "/api/wishlist", "CUSTOMER", "200,201", ok_w_add, r_w_add.status_code))

    ok_w_get, r_w_get = call("CUSTOMER", "GET", "/api/wishlist", 200)
    results.append(row("GET", "/api/wishlist", "CUSTOMER", 200, ok_w_get, r_w_get.status_code))
    if ok_w_get:
        wl = unwrap(j(r_w_get)) or []
        if isinstance(wl, list) and wl:
            wid = wl[0].get("id")
            if wid:
                ok_w_del, r_w_del = call("CUSTOMER", "DELETE", f"/api/wishlist/{wid}", 200)
                results.append(row("DELETE", f"/api/wishlist/{wid}", "CUSTOMER", 200, ok_w_del, r_w_del.status_code))

    # 5) Cart & Order
    print("\n5) Cart & Order…")
    ok_c_add, r_c_add = call("CUSTOMER", "POST", "/api/cart", [200, 201], {"productId": ids["productId"], "quantity": 2})
    if ok_c_add:
        item = unwrap(j(r_c_add))
        if isinstance(item, dict) and item.get("id"):
            ids["cartItemId"] = item["id"]

    ok_c_get, r_c_get = call("CUSTOMER", "GET", "/api/cart", 200)
    results.append(row("GET", "/api/cart", "CUSTOMER", 200, ok_c_get, r_c_get.status_code))

    if "cartItemId" in ids:
        ok_c_patch, r_c_patch = call("CUSTOMER", "PATCH", f"/api/cart/{ids['cartItemId']}", 200, {"quantity": 1})
        results.append(row("PATCH", f"/api/cart/{ids['cartItemId']}", "CUSTOMER", 200, ok_c_patch, r_c_patch.status_code))

        ok_c_del, r_c_del = call("CUSTOMER", "DELETE", f"/api/cart/{ids['cartItemId']}", 200)
        results.append(row("DELETE", f"/api/cart/{ids['cartItemId']}", "CUSTOMER", 200, ok_c_del, r_c_del.status_code))

    ok_o_new, r_o_new = call("CUSTOMER", "POST", "/api/orders", [200, 201], {"items": [{"productId": ids["productId"], "quantity": 1}]})
    if not ok_o_new:
        print(f"✖ Failed to create order: {r_o_new.status_code} {r_o_new.text}")
        sys.exit(1)
    order = unwrap(j(r_o_new))
    ids["orderId"] = order["id"]

    ok_o_list, r_o_list = call("CUSTOMER", "GET", "/api/orders", 200)
    results.append(row("GET", "/api/orders", "CUSTOMER", 200, ok_o_list, r_o_list.status_code))

    ok_o_get, r_o_get = call("CUSTOMER", "GET", f"/api/orders/{ids['orderId']}", 200)
    results.append(row("GET", f"/api/orders/{ids['orderId']}", "CUSTOMER", 200, ok_o_get, r_o_get.status_code))

    ok_o_cancel, r_o_cancel = call("CUSTOMER", "POST", f"/api/orders/cancel/{ids['orderId']}", 200)
    results.append(row("POST", f"/api/orders/cancel/{ids['orderId']}", "CUSTOMER", 200, ok_o_cancel, r_o_cancel.status_code))

    ok_o2_new, r_o2_new = call("CUSTOMER", "POST", "/api/orders", [200, 201], {"items": [{"productId": ids["productId"], "quantity": 1}]})
    if ok_o2_new:
        order2 = unwrap(j(r_o2_new))
        if isinstance(order2, dict):
            ids["orderId2"] = order2["id"]

    # 6) Shipments & Receipts (admin)
    print("\n6) Shipments & Receipts…")
    if "orderId2" in ids:
        ok_s_new, r_s_new = call("ADMIN", "POST", f"/api/shipments/{ids['orderId2']}", [200, 201],
                                 {"carrier": "UPS", "trackingNumber": "TEST123"})
        results.append(row("POST", f"/api/shipments/{ids['orderId2']}", "ADMIN", "200,201", ok_s_new, r_s_new.status_code))

        ok_s_upd, r_s_upd = call("ADMIN", "PATCH", f"/api/shipments/{ids['orderId2']}", 200, {"status": "in_transit"})
        results.append(row("PATCH", f"/api/shipments/{ids['orderId2']}", "ADMIN", 200, ok_s_upd, r_s_upd.status_code))

        ok_r_new, r_r_new = call("ADMIN", "POST", f"/api/receipts/{ids['orderId2']}", [200, 201],
                                 {"pdfUrl": "https://example.com/r.pdf"})
        results.append(row("POST", f"/api/receipts/{ids['orderId2']}", "ADMIN", "200,201", ok_r_new, r_r_new.status_code))

    # 7) Admin stats
    print("\n7) Admin stats…")
    ok_stats, r_stats = call("ADMIN", "GET", "/api/admin/stats", 200)
    results.append(row("GET", "/api/admin/stats", "ADMIN", 200, ok_stats, r_stats.status_code))

    # Summary
    print("\n" + " API Test Results ".center(79, " "))
    print(tabulate(results, headers=["Method", "Endpoint", "User", "Expected", "Result"], tablefmt="fancy_grid"))

def main():
    print("1) Ensuring Admin & Customer…")
    if not ensure_account("ADMIN", ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME): sys.exit(1)
    if not ensure_account("CUSTOMER", CUSTOMER_EMAIL, CUSTOMER_PASSWORD, CUSTOMER_NAME): sys.exit(1)
    run_suite()

if __name__ == "__main__":
    # Ensure .env has:
    #   NEXTAUTH_URL=<same as BASE_URL in pyvars.txt>
    #   NEXTAUTH_SECRET=<random string>
    # Restart dev server after changing.
    main()
