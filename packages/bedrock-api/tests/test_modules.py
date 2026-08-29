import pytest
import uuid
from fastapi.testclient import TestClient

from conftest import build_app
from bedrock.services import user_service as us
from bedrock.core.schema_catalog import Tables as T

app = build_app()

@pytest.fixture(autouse=True)
def _use_real_auth_guards(real_auth_guards):
    yield

@pytest.fixture(scope="module")
def client():
    return TestClient(app)

def _mint(role: str) -> tuple[us.UserRecord, str]:
    email = f"admusr-{role}-{uuid.uuid4().hex[:8]}@test.example.com"
    user = us.create_user(email=email, password="pw-strong-123", default_role=role)
    for other in ("member", "viewer", "admin"):
        if other != role:
            us.revoke_role(user.user_id, other)
    return user, us.create_access_token(user.user_id)

from bedrock.core.database import db

def test_list_all_modules(client, platform_db):
    _admin, admin_tok = _mint("admin")
    
    db.execute(
        f"""
        INSERT OR IGNORE INTO {T.AUTH_MODULES} 
            (module_id, slug, label, description, sort_order, is_core) 
        VALUES 
            (1001, 'test-module-1', 'Test 1', 'Desc 1', 10, 1),
            (1002, 'test-module-2', 'Test 2', 'Desc 2', 20, 0)
        """
    )
    
    r = client.get("/api/v1/modules", headers={"Authorization": f"Bearer {admin_tok}"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    
    found = [m for m in data if m["slug"] in ('test-module-1', 'test-module-2')]
    assert len(found) == 2
    
    mod1 = next(m for m in found if m["slug"] == 'test-module-1')
    assert mod1["label"] == "Test 1"
    assert mod1["description"] == "Desc 1"
    assert mod1["sort_order"] == 10
    assert mod1["is_core"] is True
    
    mod2 = next(m for m in found if m["slug"] == 'test-module-2')
    assert mod2["label"] == "Test 2"
    assert mod2["is_core"] is False
