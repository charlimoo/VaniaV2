import jwt
from django.conf import settings
from users.models import CustomUser
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> CustomUser:
    """
    Validates the Django JWT token and returns the Django CustomUser object.
    This runs inside the FastAPI context but accesses the Django DB.
    """
    token = credentials.credentials
    try:
        # Decode using Django's SECRET_KEY
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("user_id")
        
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
            
        # Get the user from the shared Database
        user = CustomUser.objects.get(id=user_id)
        
        if not user.is_active:
            raise HTTPException(status_code=403, detail="User account is inactive")
            
        return user
        
    except (jwt.PyJWTError, CustomUser.DoesNotExist):
        raise HTTPException(status_code=401, detail="Could not validate credentials")