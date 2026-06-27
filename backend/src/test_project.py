"""Quick test for project endpoints."""
import httpx

# Test statuses endpoint (no auth required)
r = httpx.get("http://localhost:8000/api/projects/statuses")
print(f"GET /api/projects/statuses: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    print(f"  Statuses count: {len(data)}")
    for s in data:
        print(f"  - {s['id']}: {s['code']} ({s['name']})")
else:
    print(f"  Error: {r.text}")

# Test list endpoint (requires auth)
r = httpx.get("http://localhost:8000/api/projects")
print(f"\nGET /api/projects (no auth): {r.status_code}")
print(f"  Expected 401: {r.status_code == 401}")

print("\nDone!")
