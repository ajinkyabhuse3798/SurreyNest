# Coding Conventions

> Claude Code must follow these conventions consistently.
> This is the single source of truth for code style decisions.

---

## Python Backend Conventions

### File headers
Every Python file starts with a module docstring:
```python
"""
Module description here.

Longer description if needed. Explains purpose and key exports.
"""
```

### Imports order (enforced by ruff)
```python
# 1. Standard library
import logging
from datetime import datetime, timedelta
from typing import Optional, List

# 2. Third-party
import pandas as pd
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 3. Local
from app.config import settings
from app.models.property import Property
from app.schemas.property import PropertyResponse
```

### Function signatures — always typed
```python
# ✅ Correct
def get_property_by_uprn(db: Session, uprn: str) -> Optional[Property]:
    """
    Fetch a property record by UPRN.
    
    Args:
        db: Database session from get_db dependency
        uprn: Unique Property Reference Number
        
    Returns:
        Property ORM object or None if not found
        
    Raises:
        Nothing — returns None on not found
    """
    return db.query(Property).filter(Property.uprn == uprn).first()

# ❌ Wrong — no types, no docstring
def get_property(db, uprn):
    return db.query(Property).filter(Property.uprn == uprn).first()
```

### Error handling in routes
```python
# ✅ Correct — specific HTTP exceptions with detail messages
@router.get("/properties/{uprn}")
async def get_property(uprn: str, db: Session = Depends(get_db)):
    property = property_service.get_by_uprn(db, uprn)
    if not property:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Property with UPRN {uprn} not found"
        )
    return property

# ❌ Wrong — bare except, generic error
@router.get("/properties/{uprn}")
async def get_property(uprn: str, db: Session = Depends(get_db)):
    try:
        return db.query(Property).filter(Property.uprn == uprn).first()
    except:
        return {"error": "something went wrong"}
```

### Logging
```python
# ✅ Correct — module-level logger
logger = logging.getLogger(__name__)

def run_pipeline():
    logger.info("Starting EPC pipeline")
    try:
        rows = load_and_clean()
        logger.info("EPC pipeline completed", extra={"rows_processed": len(rows)})
    except Exception as e:
        logger.error("EPC pipeline failed", exc_info=True)
        raise

# ❌ Wrong — print statements
def run_pipeline():
    print("Starting EPC pipeline")
    rows = load_and_clean()
    print(f"Done: {len(rows)} rows")
```

### Config access — always through settings
```python
# ✅ Correct
from app.config import settings
secret = settings.SECRET_KEY
db_url = settings.DATABASE_URL

# ❌ Wrong — direct env access in business logic
import os
secret = os.environ.get("SECRET_KEY")
```

### SQLAlchemy — always use ORM, never raw SQL strings
```python
# ✅ Correct — parameterised ORM query
properties = db.query(Property)\
    .filter(Property.postcode == postcode)\
    .limit(20)\
    .all()

# ✅ Also correct — parameterised text() for complex queries
from sqlalchemy import text
result = db.execute(
    text("SELECT uprn FROM properties WHERE postcode = :postcode"),
    {"postcode": postcode}
)

# ❌ NEVER — SQL injection risk
result = db.execute(f"SELECT * FROM properties WHERE postcode = '{postcode}'")
```

---

## JavaScript / React Frontend Conventions

### Component structure
```jsx
// ✅ Correct — consistent structure
import { useState, useEffect } from 'react';
import { ScoreBadge } from '../components/ScoreBadge';
import { useProperties } from '../hooks/useProperties';

/**
 * PropertyCard component.
 * Shows a summary card for a single property with scores.
 * 
 * @param {Object} props
 * @param {Object} props.property - Property data from API
 * @param {Function} props.onSelect - Called when card is clicked
 */
export function PropertyCard({ property, onSelect }) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div 
      className={`card ${isHovered ? 'card-hovered' : ''}`}
      onClick={() => onSelect(property.uprn)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Component content */}
    </div>
  );
}
```

### API calls — always in services, never directly in components
```jsx
// ✅ Correct — API call in service layer
// src/services/propertyApi.js
export async function searchProperties(postcode, radiusMetres) {
  const response = await api.get('/properties', {
    params: { postcode, radius: radiusMetres }
  });
  return response.data;
}

// In component: use the service
const results = await searchProperties('GU2 7XH', 500);

// ❌ Wrong — fetch/axios directly in component
const results = await fetch(`http://localhost:8000/properties?postcode=${postcode}`);
```

### Error handling in components
```jsx
// ✅ Correct — user-friendly errors, loading states
function SearchResults() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState([]);
  
  const search = async (postcode) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchProperties(postcode, 500);
      setProperties(data);
    } catch (err) {
      setError('Search failed. Please try again or check the postcode.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <Spinner />;
  if (error) return <ErrorMessage message={error} />;
  return <PropertyList properties={properties} />;
}
```

### Tailwind classes — use consistent colour system
```jsx
// Score colours — always use scoreHelpers.js, never hardcode
import { scoreToColour } from '../utils/scoreHelpers';

// scoreToColour returns: 'text-green-600', 'text-amber-500', or 'text-red-600'
// Background: 'bg-green-50', 'bg-amber-50', 'bg-red-50'
// Border: 'border-green-500', 'border-amber-500', 'border-red-500'
```

### Component naming
- **Pages:** PascalCase, descriptive noun — `PropertyDetail.jsx`, `SearchResults.jsx`
- **Components:** PascalCase, noun or noun phrase — `ScoreBadge.jsx`, `ReviewForm.jsx`
- **Hooks:** camelCase, starts with 'use' — `useAuth.js`, `useProperties.js`
- **Services:** camelCase, ends with 'Api' or 'Service' — `propertyApi.js`, `authApi.js`
- **Utils:** camelCase, descriptive — `formatters.js`, `scoreHelpers.js`

---

## Database Conventions

### Migrations — always Alembic, never manual SQL
```bash
# Create new migration
alembic revision --autogenerate -m "add is_verified to users table"

# Run migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1
```

### Never modify data directly in production
All schema changes go through Alembic migrations.
All data changes go through application code or explicit admin scripts.

### Upsert pattern for pipelines
```python
# ✅ Correct — upsert, never DROP + recreate
from sqlalchemy.dialects.postgresql import insert

stmt = insert(Property).values(**property_data)
stmt = stmt.on_conflict_do_update(
    index_elements=['uprn'],
    set_={
        'address': stmt.excluded.address,
        'energy_rating': stmt.excluded.energy_rating,
        'updated_at': datetime.utcnow()
    }
)
db.execute(stmt)
db.commit()
```

---

## Testing Conventions

### Test naming
```python
# Pattern: test_{what}_{condition}_{expected_result}
def test_register_with_valid_data_returns_201():
def test_register_with_duplicate_email_returns_400():
def test_login_with_wrong_password_returns_401():
def test_get_property_with_unknown_uprn_returns_404():
```

### Test structure (Arrange-Act-Assert)
```python
def test_register_with_valid_data_returns_201(client):
    # Arrange
    payload = {"email": "test@surrey.ac.uk", "password": "SecurePass123"}
    
    # Act
    response = client.post("/auth/register", json=payload)
    
    # Assert
    assert response.status_code == 201
    assert "id" in response.json()
    assert "email" in response.json()
    assert "password" not in response.json()  # Never returned
    assert "hashed_password" not in response.json()  # Never returned
```

### Test data — use fixtures, never hardcode real postcodes/UPRNs
```python
# conftest.py
@pytest.fixture
def test_property_data():
    return {
        "uprn": "TEST_UPRN_001",
        "address": "1 Test Street, Guildford",
        "postcode": "GU1 1AA",
        "lat": 51.2362,
        "lng": -0.5704,
        "property_type": "Flat",
        "floor_area_m2": 45.0,
        "num_rooms": 2,
        "energy_rating": "C"
    }
```

---

## Security Conventions

### Password handling — passlib only
```python
from passlib.context import CryptContext

# Defined once in auth_service.py
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

### JWT — python-jose only, settings from config
```python
from jose import jwt, JWTError
from app.config import settings

def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=settings.ACCESS_TOKEN_EXPIRE_DAYS)
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
```

### Input validation — Pydantic schema first, always
Before any DB operation, the request must pass through a Pydantic schema.
If no schema exists for an endpoint, create one before writing the handler.

---

## What Claude Code Should Never Do

1. **Never use `print()` in backend code** — use `logging` module
2. **Never hardcode secrets, credentials, or API keys** — always config/env
3. **Never write raw SQL string concatenation** — always ORM or `text()` with params
4. **Never skip error handling in API routes** — always raise `HTTPException`
5. **Never commit to main directly** — use feature branches
6. **Never hard-delete reviews** — always soft-delete via `is_flagged=True`
7. **Never bypass the postcode cache** — always check DB cache before calling Postcodes.io
8. **Never use `fetch()` directly in React components** — always use `src/services/api.js`
9. **Never store real rent target values in code** — read from VOA data or DB
10. **Never add new dependencies without updating requirements.txt / package.json**
