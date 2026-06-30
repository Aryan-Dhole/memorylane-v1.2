import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from utils.supabase_client import supabase, get_user_id_from_auth
from services import s3_service

logger = logging.getLogger(__name__)
router = APIRouter()

class JoinRequest(BaseModel):
    studio_name: str
    studio_website: Optional[str] = None
    studio_location: Optional[str] = None

class ProfileUpdateRequest(BaseModel):
    studio_name: Optional[str] = None
    studio_logo_s3: Optional[str] = None
    studio_website: Optional[str] = None
    studio_location: Optional[str] = None

@router.post("/join")
def join_photographer_portal(req: JoinRequest, authorization: Optional[str] = Header(None)):
    """
    Onboards logged-in user as a photographer.
    """
    user_id = get_user_id_from_auth(authorization)
    
    try:
        supabase.table("profiles").update({
            "is_photographer": True,
            "studio_name": req.studio_name,
            "studio_website": req.studio_website,
            "studio_location": req.studio_location
        }).eq("id", user_id).execute()
        
        return {"status": "success", "message": "Onboarded successfully to photographer portal."}
    except Exception as e:
        logger.error("Failed to onboard photographer: %s", e)
        raise HTTPException(status_code=500, detail="Failed to register photographer details.")

@router.get("/profile")
def get_photographer_profile(authorization: Optional[str] = Header(None)):
    """
    Retrieves photographer portal business profile.
    """
    user_id = get_user_id_from_auth(authorization)
    
    profile_res = supabase.table("profiles").select("*").eq("id", user_id).execute()
    if not profile_res.data:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    profile = profile_res.data[0]
    
    logo_url = ""
    if profile.get("studio_logo_s3"):
        logo_url = s3_service.generate_download_url(profile["studio_logo_s3"])
        
    return {
        "is_photographer": profile.get("is_photographer", False),
        "studio_name": profile.get("studio_name") or "",
        "studio_logo_s3": profile.get("studio_logo_s3") or "",
        "studio_logo_url": logo_url,
        "studio_website": profile.get("studio_website") or "",
        "studio_location": profile.get("studio_location") or ""
    }

@router.patch("/profile")
def update_photographer_profile(req: ProfileUpdateRequest, authorization: Optional[str] = Header(None)):
    """
    Updates photographer branding and studio parameters.
    """
    user_id = get_user_id_from_auth(authorization)
    
    update_data = {}
    if req.studio_name is not None:
        update_data["studio_name"] = req.studio_name
    if req.studio_logo_s3 is not None:
        update_data["studio_logo_s3"] = req.studio_logo_s3
    if req.studio_website is not None:
        update_data["studio_website"] = req.studio_website
    if req.studio_location is not None:
        update_data["studio_location"] = req.studio_location
        
    if not update_data:
        raise HTTPException(status_code=400, detail="No parameters provided to update")
        
    try:
        supabase.table("profiles").update(update_data).eq("id", user_id).execute()
        return {"status": "success", "message": "Photographer profile updated successfully."}
    except Exception as e:
        logger.error("Failed to patch photographer settings: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save profile settings.")
