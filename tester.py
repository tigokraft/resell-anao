import requests
from tabulate import tabulate

BASE_URL = "http://localhost:3000/api"

ADMIN_EMAIL = "admin@vexo.com"
ADMIN_PASS = "admin123"
CUSTOMER_EMAIL = "joe@vexo.com"
CUSTOMER_PASS = "joe123"

sessions = {
    "ADMIN": requests.Session(),
    "CUSTOMER": requests.Session()
}

def login_or_signup(role, email, password):
    # Try login
    r = sessions[role].post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if r.status_code == 200:
        print(f"→ Logged in as {role} ({email}), skipping signup")
        return True
    
    # Signup if not exists
    r = sessions[role].post(f"{BASE_URL}/auth/signup", json={
        "email": email,
        "password": password,
        "role": role
    })
    if r.status_code == 201:
        print(f"✔ {role} signed up: {email}")
        return True
    else:
        print(f"✖ Signup {role} failed: {r.status_code} {r.text}")
        return False

def run_test(method, endpoint, role, expected_codes, payload=None):
    if isinstance(expected_codes, int):
        expected_codes = [expected_codes]
    
    func = getattr(sessions[role], method.lower())
    r = func(f"{BASE_URL}{endpoint}", json=payload)
    return (r.status_code in expected_codes, r.status_code, r.text)

if __name__ == "__main__":
    print("1) Ensuring Admin & Customer…")
    login_or_signup("ADMIN", ADMIN_EMAIL, ADMIN_PASS)
    login_or_signup("CUSTOMER", CUSTOMER_EMAIL, CUSTOMER_PASS)

    print("\n2) Creating test product…")
    ok, code, text = run_test("POST", "/products", "ADMIN", [200, 201], {
        "name": "Test Product",
        "price": "19.99",
        "description": "Test description"
    })
    if not ok:
        print(f"✖ Failed to create product: {code} {text}")
        exit(1)
    product_id = requests.utils.json.loads(text)["id"]
    print(f"✔ Product created with ID: {product_id}")

    tests = [
        ("GET", "/products", "ADMIN", 200),
        ("GET", "/products", "CUSTOMER", 200),
        ("GET", f"/products/{product_id}", "ADMIN", 200),
        ("PATCH", f"/products/{product_id}", "ADMIN", 200, {"price": "29.99"}),
        ("POST", "/products", "CUSTOMER", 403, {"name": "Bad", "price": "1.00"}),
        ("PATCH", f"/products/{product_id}", "CUSTOMER", 403, {"price": "9.99"}),
        ("DELETE", f"/products/{product_id}", "CUSTOMER", 403),

        # Cart
        ("POST", "/cart", "CUSTOMER", 200, {"productId": product_id, "quantity": 1}),
        ("GET", "/cart", "CUSTOMER", 200),
        ("PATCH", f"/cart/{{item_id}}", "CUSTOMER", 200, {"quantity": 2}),
        ("DELETE", f"/cart/{{item_id}}", "CUSTOMER", 200),

        # Orders
        ("POST", "/orders", "CUSTOMER", 200),
        ("GET", "/orders", "CUSTOMER", 200),
        ("GET", "/orders/{{order_id}}", "CUSTOMER", 200),

        # Shipments & Receipts
        ("POST", "/shipments/{{order_id}}", "ADMIN", [200, 201], {"carrier": "UPS", "trackingNumber": "TRACK123"}),
        ("PATCH", "/shipments/{{order_id}}", "ADMIN", 200, {"status": "in_transit"}),
        ("POST", "/receipts/{{order_id}}", "ADMIN", [200, 201])
    ]

    results = []
    for method, endpoint, role, expected, payload in [t if len(t) == 5 else (*t, None) for t in tests]:
        ok, code, _ = run_test(method, endpoint, role, expected, payload)
        results.append([method, endpoint, role, expected, "✔" if ok else f"✖ ({code})"])

    print(tabulate(results, headers=["Method", "Endpoint", "User", "Expected", "Result"], tablefmt="grid"))
